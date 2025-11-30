/**
 * Migration Script: Update journal and commission override tradeIds to method-prefixed format
 *
 * Old format: tradeId = "123_456_0", calculationMethod = "fifo"
 * New format: tradeId = "fifo#123_456_0", rawTradeId = "123_456_0", calculationMethod = "fifo"
 *
 * This script:
 * 1. Scans TradeJournals table
 * 2. For each journal without rawTradeId (legacy format):
 *    - Creates a new entry with method-prefixed tradeId
 *    - Deletes the old entry
 * 3. Does the same for CommissionOverrides table
 */

const { DynamoDBClient, ScanCommand, PutItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const REGION = 'us-east-1';
const JOURNALS_TABLE = 'tiltedtrades-dev-TradeJournals';
const OVERRIDES_TABLE = 'tiltedtrades-dev-CommissionOverrides';

const client = new DynamoDBClient({ region: REGION });

// Dry run mode - set to false to actually perform the migration
const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--execute');

async function migrateJournals() {
    console.log(`\n=== Migrating TradeJournals Table (DRY_RUN: ${DRY_RUN}) ===\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    let lastEvaluatedKey = null;

    // Build a map of tradeId -> calculationMethod for override migration
    const journalMethodMap = new Map();

    do {
        const scanParams = {
            TableName: JOURNALS_TABLE,
            ExclusiveStartKey: lastEvaluatedKey
        };

        const result = await client.send(new ScanCommand(scanParams));
        const items = result.Items?.map(item => unmarshall(item)) || [];

        for (const journal of items) {
            // Store method mapping for override migration
            journalMethodMap.set(journal.tradeId, journal.calculationMethod || 'fifo');

            // Skip if already migrated (has rawTradeId)
            if (journal.rawTradeId) {
                skipped++;
                continue;
            }

            // Skip if tradeId is already prefixed
            if (journal.tradeId.startsWith('fifo#') || journal.tradeId.startsWith('perPosition#')) {
                skipped++;
                continue;
            }

            const rawTradeId = journal.tradeId;
            const calculationMethod = journal.calculationMethod || 'fifo';
            const newTradeId = `${calculationMethod}#${rawTradeId}`;

            console.log(`Migrating journal: ${rawTradeId} -> ${newTradeId} (${calculationMethod})`);

            if (!DRY_RUN) {
                try {
                    // Create new entry with method-prefixed tradeId
                    const newJournal = {
                        ...journal,
                        tradeId: newTradeId,
                        rawTradeId: rawTradeId
                    };

                    await client.send(new PutItemCommand({
                        TableName: JOURNALS_TABLE,
                        Item: marshall(newJournal, { removeUndefinedValues: true })
                    }));

                    // Delete old entry
                    await client.send(new DeleteItemCommand({
                        TableName: JOURNALS_TABLE,
                        Key: marshall({ userId: journal.userId, tradeId: rawTradeId })
                    }));

                    migrated++;
                } catch (err) {
                    console.error(`Error migrating journal ${rawTradeId}:`, err.message);
                    errors++;
                }
            } else {
                migrated++;
            }
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`\nJournals: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
    return { migrated, skipped, errors, journalMethodMap };
}

async function migrateOverrides(journalMethodMap) {
    console.log(`\n=== Migrating CommissionOverrides Table (DRY_RUN: ${DRY_RUN}) ===\n`);
    console.log(`Using journal method map with ${journalMethodMap.size} entries for calculationMethod lookup`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    let lastEvaluatedKey = null;

    do {
        const scanParams = {
            TableName: OVERRIDES_TABLE,
            ExclusiveStartKey: lastEvaluatedKey
        };

        const result = await client.send(new ScanCommand(scanParams));
        const items = result.Items?.map(item => unmarshall(item)) || [];

        for (const override of items) {
            // Skip if already migrated (has rawTradeId)
            if (override.rawTradeId) {
                skipped++;
                continue;
            }

            // Skip if tradeId is already prefixed
            if (override.tradeId.startsWith('fifo#') || override.tradeId.startsWith('perPosition#')) {
                skipped++;
                continue;
            }

            const rawTradeId = override.tradeId;
            // Look up calculationMethod from journal map (which has the correct method stored)
            const calculationMethod = journalMethodMap.get(rawTradeId) || override.calculationMethod || 'fifo';
            const newTradeId = `${calculationMethod}#${rawTradeId}`;

            console.log(`Migrating override: ${rawTradeId} -> ${newTradeId} (${calculationMethod})`);

            if (!DRY_RUN) {
                try {
                    // Create new entry with method-prefixed tradeId
                    const newOverride = {
                        ...override,
                        tradeId: newTradeId,
                        rawTradeId: rawTradeId
                    };

                    await client.send(new PutItemCommand({
                        TableName: OVERRIDES_TABLE,
                        Item: marshall(newOverride, { removeUndefinedValues: true })
                    }));

                    // Delete old entry
                    await client.send(new DeleteItemCommand({
                        TableName: OVERRIDES_TABLE,
                        Key: marshall({ userId: override.userId, tradeId: rawTradeId })
                    }));

                    migrated++;
                } catch (err) {
                    console.error(`Error migrating override ${rawTradeId}:`, err.message);
                    errors++;
                }
            } else {
                migrated++;
            }
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`\nOverrides: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
    return { migrated, skipped, errors };
}

async function main() {
    console.log('========================================');
    console.log('Journal/Override Migration Script');
    console.log('========================================');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'EXECUTE (making changes!)'}`);
    console.log('');

    if (!DRY_RUN) {
        console.log('WARNING: This will modify data in DynamoDB!');
        console.log('Waiting 5 seconds... (Ctrl+C to cancel)');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const journalStats = await migrateJournals();
    const overrideStats = await migrateOverrides(journalStats.journalMethodMap);

    console.log('\n========================================');
    console.log('Migration Summary');
    console.log('========================================');
    console.log(`Journals: ${journalStats.migrated} migrated, ${journalStats.skipped} skipped, ${journalStats.errors} errors`);
    console.log(`Overrides: ${overrideStats.migrated} migrated, ${overrideStats.skipped} skipped, ${overrideStats.errors} errors`);

    if (DRY_RUN) {
        console.log('\nThis was a DRY RUN. To execute the migration, run:');
        console.log('  node migrate-journals.js --execute');
    }
}

main().catch(console.error);
