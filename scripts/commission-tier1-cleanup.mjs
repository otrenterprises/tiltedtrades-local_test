/**
 * Cleanup Script: Remove incorrectly-keyed CommissionOverrides and TradeJournals
 *
 * The original script used calculationMethod_tradeId (e.g., "fifo#123_456_1")
 * instead of just tradeId (e.g., "123_456_1"). This script removes those entries.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const USER_ID = '7468f488-2061-7080-5426-fe456e3b700c';
const COMMISSION_OVERRIDES_TABLE = 'tiltedtrades-dev-CommissionOverrides';
const TRADE_JOURNALS_TABLE = 'tiltedtrades-dev-TradeJournals';

// Escape JSON for Windows command line
function escapeJsonForCmd(jsonStr) {
  return jsonStr.replace(/"/g, '\\"');
}

async function deleteItem(tableName, key) {
  const keyJson = JSON.stringify(key);
  const cmd = `aws dynamodb delete-item --table-name ${tableName} --key "${escapeJsonForCmd(keyJson)}" --region us-east-1`;

  try {
    await execAsync(cmd);
    return true;
  } catch (error) {
    console.error(`Error deleting from ${tableName}:`, error.message);
    return false;
  }
}

async function scanTable(tableName) {
  const cmd = `aws dynamodb scan --table-name ${tableName} --filter-expression "userId = :uid" --expression-attribute-values "{\\":uid\\":{\\"S\\":\\"${USER_ID}\\"}}" --region us-east-1`;

  try {
    const { stdout } = await execAsync(cmd);
    const data = JSON.parse(stdout);
    return data.Items || [];
  } catch (error) {
    console.error(`Error scanning ${tableName}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('CLEANUP: Removing incorrectly-keyed CommissionOverrides and TradeJournals');
  console.log('='.repeat(80));
  console.log(`User ID: ${USER_ID}`);
  console.log('');

  // Scan and delete CommissionOverrides with fifo# or perPosition# prefix
  console.log('Scanning CommissionOverrides...');
  const overrides = await scanTable(COMMISSION_OVERRIDES_TABLE);
  const badOverrides = overrides.filter(item => {
    const tradeId = item.tradeId?.S || '';
    return tradeId.startsWith('fifo#') || tradeId.startsWith('perPosition#');
  });

  console.log(`Found ${badOverrides.length} incorrectly-keyed CommissionOverrides`);

  let overrideDeleted = 0;
  for (const item of badOverrides) {
    const key = {
      userId: { S: USER_ID },
      tradeId: item.tradeId
    };
    if (await deleteItem(COMMISSION_OVERRIDES_TABLE, key)) {
      overrideDeleted++;
      process.stdout.write(`\rDeleted overrides: ${overrideDeleted}/${badOverrides.length}`);
    }
  }
  console.log('');

  // Scan and delete TradeJournals with fifo# or perPosition# prefix
  console.log('Scanning TradeJournals...');
  const journals = await scanTable(TRADE_JOURNALS_TABLE);
  const badJournals = journals.filter(item => {
    const tradeId = item.tradeId?.S || '';
    return tradeId.startsWith('fifo#') || tradeId.startsWith('perPosition#');
  });

  console.log(`Found ${badJournals.length} incorrectly-keyed TradeJournals`);

  let journalDeleted = 0;
  for (const item of badJournals) {
    const key = {
      userId: { S: USER_ID },
      tradeId: item.tradeId
    };
    if (await deleteItem(TRADE_JOURNALS_TABLE, key)) {
      journalDeleted++;
      process.stdout.write(`\rDeleted journals: ${journalDeleted}/${badJournals.length}`);
    }
  }
  console.log('');

  console.log('');
  console.log('='.repeat(80));
  console.log('CLEANUP COMPLETE');
  console.log('='.repeat(80));
  console.log(`CommissionOverrides deleted: ${overrideDeleted}`);
  console.log(`TradeJournals deleted: ${journalDeleted}`);
  console.log('='.repeat(80));
}

main().catch(console.error);
