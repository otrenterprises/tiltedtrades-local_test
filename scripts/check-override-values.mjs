/**
 * Check override values - some executionPairKeys have different values for FIFO vs perPosition
 */

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });

async function scanAll(tableName, filterExpression, expressionValues) {
  const items = [];
  let lastKey;

  do {
    const params = { TableName: tableName, ExclusiveStartKey: lastKey };
    if (filterExpression) {
      params.FilterExpression = filterExpression;
      params.ExpressionAttributeValues = expressionValues;
    }
    const result = await client.send(new ScanCommand(params));
    items.push(...(result.Items || []).map(i => unmarshall(i)));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function main() {
  const overrides = await scanAll('tiltedtrades-dev-CommissionOverrides');
  const fifoTrades = await scanAll('tiltedtrades-dev-MatchedTrades', 'calculationMethod = :method', { ':method': { S: 'fifo' } });
  const perPosTrades = await scanAll('tiltedtrades-dev-MatchedTrades', 'calculationMethod = :method', { ':method': { S: 'perPosition' } });

  // Build trade maps
  const fifoTradeMap = new Map(fifoTrades.map(t => [t.tradeId, t]));
  const perPosTradeMap = new Map(perPosTrades.map(t => [t.tradeId, t]));

  // Group overrides by executionPairKey
  const byExecPair = new Map();
  for (const o of overrides) {
    if (!byExecPair.has(o.executionPairKey)) {
      byExecPair.set(o.executionPairKey, []);
    }
    byExecPair.get(o.executionPairKey).push(o);
  }

  console.log('Analyzing override value mismatches...\n');

  let mismatchCount = 0;
  let totalValueDiff = 0;

  for (const [execPairKey, items] of byExecPair) {
    if (items.length === 2) {
      const [a, b] = items;
      if (Math.abs(a.overrideCommission - b.overrideCommission) > 0.01) {
        mismatchCount++;
        const diff = a.overrideCommission - b.overrideCommission;
        totalValueDiff += diff;

        // Get the trades
        const tradeA = fifoTradeMap.get(a.tradeId) || perPosTradeMap.get(a.tradeId);
        const tradeB = fifoTradeMap.get(b.tradeId) || perPosTradeMap.get(b.tradeId);

        console.log(`Mismatch at ${execPairKey}:`);
        console.log(`  Override A: ${a.tradeId} = $${a.overrideCommission} (qty: ${tradeA?.quantity})`);
        console.log(`  Override B: ${b.tradeId} = $${b.overrideCommission} (qty: ${tradeB?.quantity})`);
        console.log(`  Diff: $${diff.toFixed(2)}`);
        console.log();
      }
    }
  }

  console.log(`\nTotal mismatches: ${mismatchCount}`);
  console.log(`Total value difference: $${totalValueDiff.toFixed(2)}`);

  // The fix: when applying overrides, we should use the SPECIFIC override for each trade,
  // not just pick one for the executionPairKey
  console.log('\n\n=== THE REAL ISSUE ===');
  console.log('The overrides are stored correctly - both FIFO and perPosition have their own overrides.');
  console.log('The problem is in how we APPLY them:');
  console.log('  - We\'re using executionPairKey to find the override');
  console.log('  - But when there are 2 overrides with the same executionPairKey,');
  console.log('    we only pick the FIRST one (Map.set overwrites)');
  console.log('');
  console.log('SOLUTION: The override lookup should match BOTH executionPairKey AND quantity');
  console.log('OR: Keep using tradeId as the primary match, only fall back to execPairKey for NEW overrides');
}

main().catch(console.error);
