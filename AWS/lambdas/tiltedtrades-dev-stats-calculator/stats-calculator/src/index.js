"use strict";
/**
 * Stats Calculator Lambda
 *
 * EventBridge scheduled trigger (nightly at 2 AM UTC) to recalculate
 * aggregated statistics for all users.
 *
 * Uses trading-calculations Layer for metric computations.
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
 * Main Lambda handler - EventBridge scheduled event OR single-user trigger
 *
 * Supports two modes:
 * 1. Scheduled batch: Process all users (triggered by EventBridge)
 * 2. Single-user trigger: Process specific user (triggered by commission override)
 */
async function handler(event) {
    console.log('Stats calculator started:', JSON.stringify(event, null, 2));
    const startTime = Date.now();

    // Check if this is a single-user trigger (from commission override)
    if (event.userId) {
        console.log(`Single-user stats recalculation for: ${event.userId}`);
        try {
            await processUserStats(event.userId);
            const duration = Date.now() - startTime;
            console.log(`Single-user stats calculation complete for ${event.userId} in ${duration}ms`);
            return { success: true, userId: event.userId, duration };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error(`Error processing single user ${event.userId}:`, errorMessage, error);
            throw error;
        }
    }

    // Otherwise, process all users (scheduled batch job)
    let processedUsers = 0;
    let errors = 0;
    try {
        // Get all users
        const users = await getAllUsers();
        console.log(`Found ${users.length} users to process`);
        // Process each user
        for (const user of users) {
            try {
                await processUserStats(user.userId);
                processedUsers++;
                if (processedUsers % 10 === 0) {
                    console.log(`Processed ${processedUsers}/${users.length} users`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                console.error(`Error processing user ${user.userId}:`, errorMessage, error);
                errors++;
            }
        }
        const duration = Date.now() - startTime;
        console.log(`Stats calculation complete: ${processedUsers} users processed, ${errors} errors, ${duration}ms`);
        return { success: true, processedUsers, errors, duration };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Fatal error in stats calculator:', errorMessage, error);
        throw error;
    }
}
/**
 * Get all users from UserProfiles table
 */
async function getAllUsers() {
    const users = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastEvaluatedKey;
    do {
        const command = new client_dynamodb_1.ScanCommand({
            TableName: config.USER_PROFILES_TABLE,
            FilterExpression: 'dataType = :dataType',
            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({ ':dataType': 'PROFILE' }),
            ProjectionExpression: 'userId',
            ExclusiveStartKey: lastEvaluatedKey
        });
        const result = await dynamoClient.send(command);
        if (result.Items) {
            const items = result.Items.map((item) => (0, util_dynamodb_1.unmarshall)(item));
            users.push(...items);
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    return users;
}
/**
 * Process statistics for a single user
 * Includes commission overrides and bulk commission adjustments
 */
async function processUserStats(userId) {
    // Get user's preferred calculation method
    const preferences = await getUserPreferences(userId);
    const calculationMethod = preferences?.calculationMethod || 'fifo';
    // Get all matched trades for user (using preferred method)
    const trades = await getMatchedTrades(userId, calculationMethod);

    // Get commission overrides and merge with trades
    const overrides = await getCommissionOverrides(userId);
    const overrideMap = new Map(overrides.map(o => [o.tradeId, o.overrideCommission]));

    // Apply commission overrides to trades
    // When commission changes, we must also recalculate pl (Net P&L)
    // since pl = grossPL + commission (commission is negative)
    const tradesWithOverrides = trades.map(trade => {
        const override = overrideMap.get(trade.tradeId);
        if (override !== undefined) {
            // Calculate the original gross P&L (before any commission)
            // grossPL = pl - commission (removing the old commission from net pl)
            const originalCommission = trade.commission || 0;
            const grossPL = trade.pl - originalCommission;
            // Calculate new net P&L with the overridden commission
            const newPL = grossPL + override;
            return {
                ...trade,
                commission: override,
                pl: newPL
            };
        }
        return trade;
    });

    if (tradesWithOverrides.length === 0) {
        console.log(`No trades found for user ${userId}, skipping stats calculation`);
        return;
    }

    // Calculate metrics using StatisticsCalculator from Layer (with overridden commissions)
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

    // Save aggregated statistics
    await saveStats(userId, 'ALL', metrics);
    // Update user profile with summary stats
    await updateUserProfile(userId, {
        totalTrades: metrics.totalTrades,
        totalPL: metrics.totalPL,
        winRate: metrics.winRate
    });

    const overrideCount = overrides.length;
    const hasOverrides = overrideCount > 0 ? ` (${overrideCount} overrides applied)` : '';
    const hasBulk = bulkAdjustments !== 0 ? ` (bulk adj: ${bulkAdjustments})` : '';
    console.log(`Updated stats for user ${userId}: ${metrics.totalTrades} trades, ${metrics.winRate}% win rate, $${metrics.totalPL} P&L${hasOverrides}${hasBulk}`);
}
/**
 * Get user preferences
 */
async function getUserPreferences(userId) {
    try {
        const command = new client_dynamodb_1.QueryCommand({
            TableName: config.USER_PREFERENCES_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({ ':userId': userId }),
            Limit: 1
        });
        const result = await dynamoClient.send(command);
        if (result.Items && result.Items.length > 0) {
            return (0, util_dynamodb_1.unmarshall)(result.Items[0]);
        }
        return null;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(`Error getting preferences for user ${userId}:`, errorMessage, error);
        return null;
    }
}
/**
 * Get all matched trades for a user
 */
async function getMatchedTrades(userId, calculationMethod) {
    const trades = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastEvaluatedKey;
    do {
        const command = new client_dynamodb_1.QueryCommand({
            TableName: config.MATCHED_TRADES_TABLE,
            KeyConditionExpression: 'userId = :userId AND begins_with(calculationMethod_tradeId, :method)',
            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                ':userId': userId,
                ':method': `${calculationMethod}#`
            }),
            ExclusiveStartKey: lastEvaluatedKey
        });
        const result = await dynamoClient.send(command);
        if (result.Items) {
            const items = result.Items.map((item) => (0, util_dynamodb_1.unmarshall)(item));
            trades.push(...items);
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    return trades;
}
/**
 * Save statistics to TradingStats table
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveStats(userId, statsType, metrics) {
    const now = new Date().toISOString();
    const statsRecord = {
        userId,
        statsType,
        ...metrics,
        lastCalculatedAt: now,
        updatedAt: now
    };
    const command = new client_dynamodb_1.PutItemCommand({
        TableName: config.TRADING_STATS_TABLE,
        Item: (0, util_dynamodb_1.marshall)(statsRecord, { removeUndefinedValues: true })
    });
    await dynamoClient.send(command);
}
/**
 * Update user profile with summary statistics
 */
async function updateUserProfile(userId, stats) {
    const now = new Date().toISOString();
    const command = new client_dynamodb_1.UpdateItemCommand({
        TableName: config.USER_PROFILES_TABLE,
        Key: (0, util_dynamodb_1.marshall)({ userId, dataType: 'PROFILE' }),
        UpdateExpression: 'SET totalTrades = :totalTrades, totalPL = :totalPL, winRate = :winRate, updatedAt = :updatedAt',
        ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
            ':totalTrades': stats.totalTrades,
            ':totalPL': stats.totalPL,
            ':winRate': stats.winRate,
            ':updatedAt': now
        })
    });
    await dynamoClient.send(command);
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
