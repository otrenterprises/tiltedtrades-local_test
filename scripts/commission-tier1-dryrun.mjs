/**
 * Dry Run Script: Commission Adjustment for Variable Tier 1 Status
 *
 * This script reads trades from a JSON file and outputs what changes would be made.
 *
 * Target: All MES and ES trades with exitDate <= 2024-10-14
 * Commission Rates:
 *   - MES: $0.62 per contract (was calculated at $0.60)
 *   - ES: $2.25 per contract (was calculated at $2.00)
 */

import { readFileSync } from 'fs';

const USER_ID = '7468f488-2061-7080-5426-fe456e3b700c';
const CUTOFF_DATE = new Date('2024-10-14T23:59:59.999Z');

// Commission rates per contract (round-trip: entry + exit)
const COMMISSION_RATES = {
  'MES': 1.24,  // $0.62 per side × 2
  'ES': 4.50   // $2.25 per side × 2
};

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

// Filter trades
const matchingTrades = allTrades.filter(trade => {
  // Must be MES or ES
  if (!['MES', 'ES'].includes(trade.symbol)) return false;

  // Must have exitDate on or before cutoff
  if (!trade.exitDate) return false;
  const exitDate = new Date(trade.exitDate);
  if (exitDate > CUTOFF_DATE) return false;

  // Must be closed
  if (trade.status !== 'closed') return false;

  return true;
});

function calculateNewCommission(trade) {
  const rate = COMMISSION_RATES[trade.symbol];
  const quantity = trade.quantity || 1;
  // Commission is negative (cost)
  return -(rate * quantity);
}

console.log('='.repeat(80));
console.log('DRY RUN: Commission Adjustment for Variable Tier 1 Status');
console.log('='.repeat(80));
console.log(`User ID: ${USER_ID}`);
console.log(`Cutoff Date: 2024-10-14`);
console.log(`Commission Rates: MES=$1.24/contract (round-trip), ES=$4.50/contract (round-trip)`);
console.log('='.repeat(80));
console.log('');

console.log(`Total trades found for user: ${allTrades.length}`);
console.log(`Trades matching criteria (MES/ES, exitDate <= 10/14/2024, closed): ${matchingTrades.length}`);
console.log('');

// Separate by calculation method
const fifoTrades = matchingTrades.filter(t => t.calculationMethod === 'fifo');
const perPositionTrades = matchingTrades.filter(t => t.calculationMethod === 'perPosition');

console.log(`FIFO trades: ${fifoTrades.length}`);
console.log(`PerPosition trades: ${perPositionTrades.length}`);
console.log('');

// Calculate totals
let totalOriginalCommission = 0;
let totalNewCommission = 0;
let mesCount = 0;
let esCount = 0;
let mesContracts = 0;
let esContracts = 0;

const changes = [];

for (const trade of matchingTrades) {
  const originalCommission = trade.commission || 0;
  const newCommission = calculateNewCommission(trade);
  const difference = newCommission - originalCommission;

  totalOriginalCommission += originalCommission;
  totalNewCommission += newCommission;

  if (trade.symbol === 'MES') {
    mesCount++;
    mesContracts += trade.quantity || 1;
  } else {
    esCount++;
    esContracts += trade.quantity || 1;
  }

  changes.push({
    tradeId: trade.calculationMethod_tradeId,
    symbol: trade.symbol,
    quantity: trade.quantity,
    exitDate: trade.exitDate?.substring(0, 10),
    originalCommission: originalCommission.toFixed(2),
    newCommission: newCommission.toFixed(2),
    difference: difference.toFixed(2),
    calculationMethod: trade.calculationMethod
  });
}

// Summary
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`MES Trades: ${mesCount} trades, ${mesContracts} total contracts`);
console.log(`ES Trades: ${esCount} trades, ${esContracts} total contracts`);
console.log('');
console.log(`Original Total Commission: $${totalOriginalCommission.toFixed(2)}`);
console.log(`New Total Commission: $${totalNewCommission.toFixed(2)}`);
console.log(`Total Difference: $${(totalNewCommission - totalOriginalCommission).toFixed(2)}`);
console.log('');

// Records to be created
console.log('='.repeat(80));
console.log('RECORDS TO BE CREATED');
console.log('='.repeat(80));
console.log(`CommissionOverrides entries: ${matchingTrades.length}`);
console.log(`TradeJournals entries: ${matchingTrades.length}`);
console.log('');

// Show sample of changes (sorted by date)
console.log('='.repeat(80));
console.log('SAMPLE CHANGES (first 20, sorted by exit date)');
console.log('='.repeat(80));
console.log('');

const sortedChanges = changes.sort((a, b) => a.exitDate.localeCompare(b.exitDate));
const sample = sortedChanges.slice(0, 20);
for (const change of sample) {
  console.log(`${change.calculationMethod.padEnd(12)} | ${change.symbol.padEnd(4)} | qty: ${String(change.quantity).padStart(2)} | ${change.exitDate} | $${change.originalCommission.padStart(7)} -> $${change.newCommission.padStart(7)} (${change.difference})`);
}

if (changes.length > 20) {
  console.log(`... and ${changes.length - 20} more trades`);
}

console.log('');
console.log('='.repeat(80));
console.log('DRY RUN COMPLETE - No changes were made to the database');
console.log('='.repeat(80));
