/**
 * Execute Script v2: Commission Adjustment for Variable Tier 1 Status
 * Uses batch-write-item for much faster execution (25 items per batch)
 *
 * FIXES from v1:
 * - Uses trade.tradeId instead of trade.calculationMethod_tradeId
 * - Uses batch writes for speed
 */

import { readFileSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const USER_ID = '7468f488-2061-7080-5426-fe456e3b700c';
const CUTOFF_DATE = new Date('2024-10-14T23:59:59.999Z');

// Commission rates per contract (round-trip: entry + exit)
const COMMISSION_RATES = {
  'MES': 1.24,  // $0.62 per side × 2
  'ES': 4.50   // $2.25 per side × 2
};

const COMMISSION_OVERRIDES_TABLE = 'tiltedtrades-dev-CommissionOverrides';
const TRADE_JOURNALS_TABLE = 'tiltedtrades-dev-TradeJournals';

// Read the JSON file exported by AWS CLI
const rawData = readFileSync(new URL('./all_trades.json', import.meta.url), 'utf8');
const data = JSON.parse(rawData);

// Unmarshall DynamoDB format to plain objects
function unmarshallItem(item) {
  const result = {};
  for (const [key, value] of Object.entries(item)) {
    if (value.S !== undefined) result[key] = value.S;
    else if (value.N !== undefined) result[key] = parseFloat(value.N);
    else if (value.BOOL !== undefined) result[key] = value.BOOL;
    else if (value.L !== undefined) result[key] = value.L.map(v => v.S || v.N);
    else if (value.M !== undefined) result[key] = unmarshallItem(value.M);
    else result[key] = value;
  }
  return result;
}

const allTrades = data.Items.map(unmarshallItem);

// Filter trades - only get UNIQUE trades (dedupe by tradeId, pick one calc method)
const tradeMap = new Map();
allTrades.forEach(trade => {
  if (!['MES', 'ES'].includes(trade.symbol)) return;
  if (!trade.exitDate) return;
  const exitDate = new Date(trade.exitDate);
  if (exitDate > CUTOFF_DATE) return;
  if (trade.status !== 'closed') return;

  // Use tradeId as key to dedupe - we only need one override per unique trade
  if (!tradeMap.has(trade.tradeId)) {
    tradeMap.set(trade.tradeId, trade);
  }
});

const matchingTrades = Array.from(tradeMap.values());

function calculateNewCommission(trade) {
  const rate = COMMISSION_RATES[trade.symbol];
  const quantity = trade.quantity || 1;
  return -(rate * quantity);
}

// Convert to DynamoDB JSON format
function marshallItem(item) {
  const dynamoItem = {};
  for (const [key, value] of Object.entries(item)) {
    if (typeof value === 'string') {
      dynamoItem[key] = { S: value };
    } else if (typeof value === 'number') {
      dynamoItem[key] = { N: value.toString() };
    } else if (Array.isArray(value)) {
      dynamoItem[key] = { L: value.map(v => ({ S: v })) };
    }
  }
  return dynamoItem;
}

async function batchWrite(tableName, items) {
  // DynamoDB batch-write-item accepts up to 25 items per request
  const batches = [];
  for (let i = 0; i < items.length; i += 25) {
    batches.push(items.slice(i, i + 25));
  }

  let successCount = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const requestItems = {
      [tableName]: batch.map(item => ({
        PutRequest: { Item: marshallItem(item) }
      }))
    };

    // Write to temp file to avoid command line escaping issues
    const tempFile = new URL(`./temp_batch_${i}.json`, import.meta.url);
    writeFileSync(tempFile, JSON.stringify(requestItems));

    const cmd = `aws dynamodb batch-write-item --request-items file://${tempFile.pathname.substring(1)} --region us-east-1`;

    try {
      await execAsync(cmd);
      successCount += batch.length;
      process.stdout.write(`\r${tableName}: ${successCount}/${items.length}`);
    } catch (error) {
      console.error(`\nBatch write error:`, error.message);
    }
  }
  console.log('');
  return successCount;
}

async function triggerStatsRecalculation() {
  const cmd = `aws lambda invoke --function-name tiltedtrades-dev-stats-calculator --invocation-type Event --cli-binary-format raw-in-base64-out --payload "{\\"userId\\":\\"${USER_ID}\\"}" --region us-east-1 NUL`;

  try {
    await execAsync(cmd);
    console.log('Stats recalculation triggered');
    return true;
  } catch (error) {
    console.error('Error triggering stats recalculation:', error.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('EXECUTING v2: Commission Adjustment for Variable Tier 1 Status');
  console.log('='.repeat(80));
  console.log(`User ID: ${USER_ID}`);
  console.log(`Cutoff Date: 2024-10-14`);
  console.log(`Commission Rates: MES=$1.24/contract, ES=$4.50/contract (round-trip)`);
  console.log(`Unique trades to process: ${matchingTrades.length}`);
  console.log('='.repeat(80));
  console.log('');

  const now = new Date().toISOString();

  // Build all entries
  const overrideEntries = [];
  const journalEntries = [];

  for (const trade of matchingTrades) {
    const originalCommission = trade.commission || 0;
    const newCommission = calculateNewCommission(trade);

    // CommissionOverride entry - use tradeId (not calculationMethod_tradeId!)
    overrideEntries.push({
      userId: USER_ID,
      tradeId: trade.tradeId,  // FIXED: use tradeId, not calculationMethod_tradeId
      originalCommission: originalCommission,
      overrideCommission: newCommission,
      reason: 'Commission adjusted for Variable Tier 1 status',
      createdAt: now,
      updatedAt: now
    });

    // TradeJournal entry - use tradeId
    journalEntries.push({
      userId: USER_ID,
      tradeId: trade.tradeId,  // FIXED: use tradeId, not calculationMethod_tradeId
      journalText: 'Commission adjusted for Variable Tier 1 status',
      tags: ['commission'],
      calculationMethod: trade.calculationMethod,
      symbol: trade.symbol,
      exitDate: trade.exitDate,
      createdAt: now,
      updatedAt: now
    });
  }

  console.log('Writing CommissionOverrides...');
  const overrideSuccess = await batchWrite(COMMISSION_OVERRIDES_TABLE, overrideEntries);

  console.log('Writing TradeJournals...');
  const journalSuccess = await batchWrite(TRADE_JOURNALS_TABLE, journalEntries);

  console.log('');
  console.log('='.repeat(80));
  console.log('EXECUTION COMPLETE');
  console.log('='.repeat(80));
  console.log(`CommissionOverrides written: ${overrideSuccess}`);
  console.log(`TradeJournals written: ${journalSuccess}`);
  console.log('');

  // Trigger stats recalculation
  console.log('Triggering stats recalculation...');
  await triggerStatsRecalculation();

  // Cleanup temp files
  for (let i = 0; i < Math.ceil(matchingTrades.length / 25); i++) {
    try {
      const tempFile = new URL(`./temp_batch_${i}.json`, import.meta.url);
      const { unlinkSync } = await import('fs');
      unlinkSync(tempFile);
    } catch (e) {
      // ignore
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('DONE');
  console.log('='.repeat(80));
}

main().catch(console.error);
