/**
 * Script to delete all DynamoDB data for a specific user
 * Run with: node delete_user_data.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const userId = '7468f488-2061-7080-5426-fe456e3b700c';
const region = 'us-east-1';

async function deleteTable(tableName, keyAttributes) {
    console.log(`\n=== Deleting from ${tableName} ===`);

    // Query all items
    const queryFile = path.join(__dirname, `query_${tableName}.json`);
    const projection = keyAttributes.join(', ');

    // Write expression attribute values to a file for Windows compatibility
    const exprFile = path.join(__dirname, 'expr_values.json');
    fs.writeFileSync(exprFile, JSON.stringify({ ':uid': { S: userId } }));

    console.log('Querying items...');
    execSync(`aws dynamodb query --table-name ${tableName} --key-condition-expression "userId = :uid" --expression-attribute-values file://${exprFile.replace(/\\/g, '/')} --projection-expression "${projection}" --region ${region} --output json > "${queryFile}"`, { stdio: 'inherit' });

    const data = JSON.parse(fs.readFileSync(queryFile, 'utf8'));
    const items = data.Items || [];

    console.log(`Found ${items.length} items to delete`);

    if (items.length === 0) {
        console.log('Nothing to delete');
        return 0;
    }

    // Delete in batches
    let deleted = 0;
    const batchSize = 25;

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        const deleteRequests = batch.map(item => {
            const key = {};
            keyAttributes.forEach(attr => {
                key[attr] = item[attr];
            });
            return { DeleteRequest: { Key: key } };
        });

        const requestItems = {
            [tableName]: deleteRequests
        };

        const batchFile = path.join(__dirname, 'batch_delete.json');
        fs.writeFileSync(batchFile, JSON.stringify(requestItems));

        try {
            execSync(`aws dynamodb batch-write-item --request-items file://"${batchFile}" --region ${region}`, { stdio: 'pipe' });
            deleted += batch.length;

            if (deleted % 500 === 0 || deleted === items.length) {
                console.log(`Deleted ${deleted}/${items.length} items`);
            }
        } catch (error) {
            console.error(`Error deleting batch: ${error.message}`);
        }
    }

    // Cleanup
    try { fs.unlinkSync(queryFile); } catch (e) {}
    try { fs.unlinkSync(path.join(__dirname, 'batch_delete.json')); } catch (e) {}

    return deleted;
}

async function main() {
    console.log('Starting full table clear for user:', userId);

    // Delete TradingExecutions (userId, executionId)
    const exec = await deleteTable('tiltedtrades-dev-TradingExecutions', ['userId', 'executionId']);

    // Delete MatchedTrades (userId, calculationMethod_tradeId)
    const matched = await deleteTable('tiltedtrades-dev-MatchedTrades', ['userId', 'calculationMethod_tradeId']);

    // Delete TradingStats (userId)
    const stats = await deleteTable('tiltedtrades-dev-TradingStats', ['userId']);

    console.log('\n=== Summary ===');
    console.log(`TradingExecutions deleted: ${exec}`);
    console.log(`MatchedTrades deleted: ${matched}`);
    console.log(`TradingStats deleted: ${stats}`);
    console.log('\nDone! You can now upload fresh data.');
}

main().catch(console.error);
