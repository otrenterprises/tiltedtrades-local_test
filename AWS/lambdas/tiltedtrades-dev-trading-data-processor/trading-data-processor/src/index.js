"use strict";
/**
 * Trading Data Processor Lambda
 *
 * Can be triggered by:
 * 1. Direct invocation from trades-data Lambda (preferred for bulk uploads)
 * 2. DynamoDB Stream from TradingExecutions table (for incremental updates)
 *
 * Processes executions using FIFO matching and updates statistics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
const calculations_1 = require("@tiltedtrades/calculations");
const config_1 = require("@tiltedtrades/config");
// Get configuration from environment variables
const config = (0, config_1.getConfig)();
// AWS SDK client
const dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: config.REGION });
/**
 * Type guard to check if event is a direct invocation
 */
function isDirectInvoke(event) {
    return (typeof event === 'object' &&
        event !== null &&
        'trigger' in event &&
        event.trigger === 'upload-complete' &&
        'userId' in event);
}
/**
 * Main Lambda handler - supports both direct invocation and DynamoDB Stream
 */
async function handler(event) {
    // Check if this is a direct invocation from trades-data Lambda
    if (isDirectInvoke(event)) {
        console.log(`Direct invocation for userId: ${event.userId}, executions: ${event.executionsWritten}`);
        console.log(`Source file: ${event.sourceFile}`);
        try {
            await processUserExecutions(event.userId);
            console.log(`Successfully processed user ${event.userId} via direct invocation`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error(`Error processing user ${event.userId}:`, errorMessage, error);
            throw error; // Re-throw for direct invocation so caller knows it failed
        }
        return;
    }
    // Otherwise, process as DynamoDB Stream event
    const streamEvent = event;
    console.log(`Processing ${streamEvent.Records.length} DynamoDB stream records`);
    // Group records by userId
    const userRecords = groupRecordsByUser(streamEvent.Records);
    // Process each user's executions
    for (const [userId, records] of userRecords.entries()) {
        try {
            console.log(`Processing ${records.length} records for user ${userId}`);
            await processUserExecutions(userId);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error(`Error processing user ${userId}:`, errorMessage, error);
            // Continue processing other users even if one fails
        }
    }
    console.log('Stream processing complete');
}
/**
 * Group DynamoDB stream records by userId
 */
function groupRecordsByUser(records) {
    const userRecords = new Map();
    for (const record of records) {
        // Only process INSERT and MODIFY events
        if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') {
            continue;
        }
        const newImage = record.dynamodb?.NewImage;
        if (!newImage) {
            continue;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const execution = (0, util_dynamodb_1.unmarshall)(newImage);
        const userId = execution.userId;
        if (!userId) {
            console.warn('Execution missing userId, skipping:', execution.DBKey);
            continue;
        }
        if (!userRecords.has(userId)) {
            userRecords.set(userId, []);
        }
        userRecords.get(userId).push(record);
    }
    return userRecords;
}
/**
 * Process executions for a specific user
 *
 * HYBRID APPROACH: Calculates and stores BOTH calculation methods (FIFO and Per Position)
 * for instant frontend switching without recalculation.
 */
async function processUserExecutions(userId) {
    // Get user's calculation preferences
    const preferences = await getUserPreferences(userId);
    const preferredMethod = preferences?.calculationMethod || 'fifo';
    const commissionTier = preferences?.commissionTier || 'fixed';
    console.log(`User ${userId} preferences: ${preferredMethod} method (preferred), ${commissionTier} tier`);
    // Fetch all executions for this user from DynamoDB
    const allExecutions = await getAllUserExecutions(userId);
    if (allExecutions.length === 0) {
        console.warn(`No executions found for user ${userId}`);
        return;
    }
    console.log(`Fetched ${allExecutions.length} total executions for user ${userId}`);
    // Sort executions chronologically (essential for FIFO accuracy)
    allExecutions.sort((a, b) => {
        const dateA = new Date(`${a.Date} ${a.Time}`);
        const dateB = new Date(`${b.Date} ${b.Time}`);
        return dateA.getTime() - dateB.getTime();
    });
    // HYBRID APPROACH: Calculate BOTH methods
    console.log(`Calculating FIFO trades for user ${userId}...`);
    const fifoTrades = calculations_1.TradeMatchingEngine.matchTrades(allExecutions, 'fifo', commissionTier);
    console.log(`Matched ${fifoTrades.length} FIFO trades`);
    console.log(`Calculating Per Position trades for user ${userId}...`);
    const perPositionTrades = calculations_1.TradeMatchingEngine.matchTrades(allExecutions, 'perPosition', commissionTier);
    console.log(`Matched ${perPositionTrades.length} Per Position trades`);
    // Delete ALL old trades for this user (both methods)
    await deleteAllMatchedTrades(userId);
    // Write BOTH calculation methods to DynamoDB
    await writeMatchedTrades(userId, 'fifo', fifoTrades);
    await writeMatchedTrades(userId, 'perPosition', perPositionTrades);
    // Calculate statistics using user's PREFERRED method
    const preferredTrades = preferredMethod === 'fifo' ? fifoTrades : perPositionTrades;

    // Get commission overrides and merge with trades
    const overrides = await getCommissionOverrides(userId);
    const overrideMap = new Map(overrides.map(o => [o.tradeId, o.overrideCommission]));

    // Apply commission overrides to trades
    const tradesWithOverrides = preferredTrades.map(trade => {
        const override = overrideMap.get(trade.id);
        if (override !== undefined) {
            return {
                ...trade,
                commission: override
            };
        }
        return trade;
    });

    const metrics = calculations_1.StatisticsCalculator.calculateMetrics(tradesWithOverrides);

    // Get bulk commission adjustments from Balance entries
    const bulkAdjustments = await getBulkCommissionAdjustments(userId);
    if (bulkAdjustments !== 0) {
        console.log(`Applying bulk commission adjustment of ${bulkAdjustments} for user ${userId}`);
        // Add bulk adjustments to totalCommission
        metrics.totalCommission = (metrics.totalCommission || 0) + bulkAdjustments;
        // Recalculate net P&L = grossPL + totalCommission (commission is negative for costs)
        metrics.totalPL = (metrics.grossPL || 0) + metrics.totalCommission;
    }

    const overrideCount = overrides.length;
    const hasOverrides = overrideCount > 0 ? ` (${overrideCount} overrides applied)` : '';
    const hasBulk = bulkAdjustments !== 0 ? ` (bulk adj: ${bulkAdjustments})` : '';

    console.log(`Calculated metrics for user ${userId} (${preferredMethod} method)${hasOverrides}${hasBulk}:`, {
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate.toFixed(2),
        netPL: metrics.totalPL.toFixed(2)
    });
    // Update trading statistics
    await updateTradingStats(userId, metrics);
    console.log(`Successfully processed user ${userId} (stored both FIFO and Per Position)`);
}
/**
 * Get user preferences from DynamoDB
 */
async function getUserPreferences(userId) {
    try {
        const command = new client_dynamodb_1.QueryCommand({
            TableName: config.USER_PREFERENCES_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': { S: userId }
            },
            Limit: 1
        });
        const response = await dynamoClient.send(command);
        if (response.Items && response.Items.length > 0) {
            return (0, util_dynamodb_1.unmarshall)(response.Items[0]);
        }
        return null;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(`Error fetching preferences for user ${userId}:`, errorMessage, error);
        return null;
    }
}
/**
 * Fetch all executions for a user from DynamoDB
 */
async function getAllUserExecutions(userId) {
    const executions = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastEvaluatedKey = undefined;
    do {
        const command = new client_dynamodb_1.QueryCommand({
            TableName: config.TRADING_EXECUTIONS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': { S: userId }
            },
            ExclusiveStartKey: lastEvaluatedKey
        });
        const response = await dynamoClient.send(command);
        if (response.Items) {
            const items = response.Items.map(item => (0, util_dynamodb_1.unmarshall)(item));
            executions.push(...items);
        }
        lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    return executions;
}
/**
 * Delete all matched trades for a user (both calculation methods)
 */
async function deleteAllMatchedTrades(userId) {
    console.log(`Deleting all existing trades for user ${userId}`);
    // Query all existing trades for this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingTrades = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastEvaluatedKey = undefined;
    do {
        const queryCommand = new client_dynamodb_1.QueryCommand({
            TableName: config.MATCHED_TRADES_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': { S: userId }
            },
            ProjectionExpression: 'userId, calculationMethod_tradeId',
            ExclusiveStartKey: lastEvaluatedKey
        });
        const response = await dynamoClient.send(queryCommand);
        if (response.Items) {
            existingTrades.push(...response.Items);
        }
        lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    if (existingTrades.length === 0) {
        console.log('No existing trades to delete');
        return;
    }
    console.log(`Deleting ${existingTrades.length} existing trades`);
    // Batch delete (DynamoDB limit: 25 items per batch)
    const batchSize = 25;
    let totalDeleted = 0;
    for (let i = 0; i < existingTrades.length; i += batchSize) {
        const batch = existingTrades.slice(i, i + batchSize);
        const deleteRequests = batch.map((item) => ({
            DeleteRequest: {
                Key: {
                    userId: item.userId,
                    calculationMethod_tradeId: item.calculationMethod_tradeId
                }
            }
        }));
        // Retry logic for unprocessed items
        let requestItems = {
            [config.MATCHED_TRADES_TABLE]: deleteRequests
        };
        let retries = 0;
        const maxRetries = 5;
        while (Object.keys(requestItems).length > 0 && retries < maxRetries) {
            const command = new client_dynamodb_1.BatchWriteItemCommand({ RequestItems: requestItems });
            const response = await dynamoClient.send(command);
            const itemsInBatch = requestItems[config.MATCHED_TRADES_TABLE]?.length || 0;
            if (response.UnprocessedItems && Object.keys(response.UnprocessedItems).length > 0) {
                const unprocessedCount = response.UnprocessedItems[config.MATCHED_TRADES_TABLE]?.length || 0;
                totalDeleted += (itemsInBatch - unprocessedCount);
                requestItems = response.UnprocessedItems;
                retries++;
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
            }
            else {
                totalDeleted += itemsInBatch;
                requestItems = {};
            }
        }
    }
    console.log(`Deleted ${totalDeleted} old trades`);
}
/**
 * Write matched trades to DynamoDB with calculation method prefix
 */
async function writeMatchedTrades(userId, calculationMethod, trades) {
    if (trades.length === 0) {
        console.log(`No ${calculationMethod} trades to write for user ${userId}`);
        return;
    }
    console.log(`Writing ${trades.length} ${calculationMethod} trades for user ${userId}`);
    // Batch write trades (DynamoDB limit: 25 items per batch)
    const batchSize = 25;
    let totalWritten = 0;
    for (let i = 0; i < trades.length; i += batchSize) {
        const batch = trades.slice(i, i + batchSize);
        const putRequests = batch.map(trade => ({
            PutRequest: {
                Item: (0, util_dynamodb_1.marshall)({
                    userId: userId,
                    calculationMethod_tradeId: `${calculationMethod}#${trade.id}`,
                    calculationMethod: calculationMethod,
                    tradeId: trade.id,
                    symbol: trade.symbol,
                    side: trade.side,
                    entryDate: trade.entryDate.toISOString(),
                    exitDate: trade.exitDate?.toISOString() || null,
                    // TradingDay from first execution (all executions in a trade have same trading day)
                    tradingDay: trade.executions[0]?.TradingDay || null,
                    entryPrice: trade.entryPrice,
                    exitPrice: trade.exitPrice,
                    quantity: trade.quantity,
                    pl: trade.pl,
                    plPercent: trade.plPercent,
                    duration: trade.duration,
                    commission: trade.commission,
                    status: trade.status,
                    // Store execution IDs for reference (DBKey = unique TransactionID, maps to executionId in TradingExecutions)
                    executionIds: trade.executions.map((e) => e.DBKey)
                })
            }
        }));
        // Retry logic for unprocessed items
        let requestItems = {
            [config.MATCHED_TRADES_TABLE]: putRequests
        };
        let retries = 0;
        const maxRetries = 5;
        while (Object.keys(requestItems).length > 0 && retries < maxRetries) {
            const command = new client_dynamodb_1.BatchWriteItemCommand({ RequestItems: requestItems });
            const response = await dynamoClient.send(command);
            const itemsInBatch = requestItems[config.MATCHED_TRADES_TABLE]?.length || 0;
            if (response.UnprocessedItems && Object.keys(response.UnprocessedItems).length > 0) {
                const unprocessedCount = response.UnprocessedItems[config.MATCHED_TRADES_TABLE]?.length || 0;
                totalWritten += (itemsInBatch - unprocessedCount);
                requestItems = response.UnprocessedItems;
                retries++;
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
                console.log(`Retry ${retries}: ${unprocessedCount} unprocessed items remaining`);
            }
            else {
                totalWritten += itemsInBatch;
                requestItems = {};
            }
        }
        if (Object.keys(requestItems).length > 0) {
            const failedCount = requestItems[config.MATCHED_TRADES_TABLE]?.length || 0;
            console.error(`Failed to write ${failedCount} items after ${maxRetries} retries`);
        }
    }
    console.log(`Wrote ${totalWritten} ${calculationMethod} trades to ${config.MATCHED_TRADES_TABLE}`);
}
/**
 * Update trading statistics in DynamoDB
 */
async function updateTradingStats(userId, metrics) {
    const timestamp = new Date().toISOString();
    // Write overall stats
    const command = new client_dynamodb_1.PutItemCommand({
        TableName: config.TRADING_STATS_TABLE,
        Item: (0, util_dynamodb_1.marshall)({
            userId: userId,
            statsType: 'ALL', // Sort key - matches DynamoDB schema
            lastCalculatedAt: timestamp,
            // Metrics
            totalTrades: metrics.totalTrades,
            winningTrades: metrics.winningTrades,
            losingTrades: metrics.losingTrades,
            breakevenTrades: metrics.breakevenTrades,
            winRate: metrics.winRate,
            averageWin: metrics.averageWin,
            averageLoss: metrics.averageLoss,
            largestWin: metrics.largestWin,
            largestLoss: metrics.largestLoss,
            totalPL: metrics.totalPL,
            grossPL: metrics.grossPL,
            grossProfit: metrics.grossProfit,
            grossLoss: metrics.grossLoss,
            totalCommission: metrics.totalCommission,
            profitFactor: metrics.profitFactor,
            expectancy: metrics.expectancy,
            maxDrawdown: metrics.maxDrawdown,
            maxDrawdownPercent: metrics.maxDrawdownPercent
        })
    });
    await dynamoClient.send(command);
    console.log(`Updated trading stats for user ${userId}`);
}
/**
 * Get commission overrides for a user
 */
async function getCommissionOverrides(userId) {
    try {
        const overrides = [];
        let lastEvaluatedKey;
        do {
            const command = new client_dynamodb_1.QueryCommand({
                TableName: config.COMMISSION_OVERRIDES_TABLE,
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({ ':userId': userId }),
                ExclusiveStartKey: lastEvaluatedKey
            });
            const result = await dynamoClient.send(command);
            if (result.Items) {
                const items = result.Items.map((item) => (0, util_dynamodb_1.unmarshall)(item));
                overrides.push(...items);
            }
            lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);
        return overrides;
    }
    catch (error) {
        // Table might not exist yet
        console.log(`Error fetching commission overrides for ${userId}:`, error.message);
        return [];
    }
}
/**
 * Get bulk commission adjustments from Balance entries
 * Returns the sum of all commission_adjustment entries
 */
async function getBulkCommissionAdjustments(userId) {
    try {
        const entries = [];
        let lastEvaluatedKey;
        do {
            const command = new client_dynamodb_1.QueryCommand({
                TableName: config.USER_BALANCE_TABLE,
                KeyConditionExpression: 'userId = :userId AND begins_with(entryId, :prefix)',
                ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                    ':userId': userId,
                    ':prefix': 'ENTRY#'
                }),
                ExclusiveStartKey: lastEvaluatedKey
            });
            const result = await dynamoClient.send(command);
            if (result.Items) {
                const items = result.Items.map((item) => (0, util_dynamodb_1.unmarshall)(item));
                entries.push(...items);
            }
            lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        // Filter for commission_adjustment type and sum the amounts
        const bulkAdjustments = entries
            .filter(e => e.type === 'commission_adjustment')
            .reduce((sum, e) => sum + (e.amount || 0), 0);

        return bulkAdjustments;
    }
    catch (error) {
        console.log(`Error fetching balance entries for ${userId}:`, error.message);
        return 0;
    }
}
