"use strict";
/**
 * User Profile API Lambda
 *
 * Handles API Gateway requests for user profiles, preferences, and trading data queries.
 * Routes: /profile, /preferences, /executions, /trades, /stats, /sync
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const { BatchGetItemCommand } = require("@aws-sdk/client-dynamodb");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
const config_1 = require("../../shared/types/config");
const { handleBalanceRoutes } = require("./routes/balance");
// Get configuration from environment variables
const config = (0, config_1.getConfig)();
// AWS SDK client
const dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: config.REGION });
/**
 * Main Lambda handler - API Gateway proxy integration
 */
async function handler(event) {
    console.log('Request:', JSON.stringify(event, null, 2));
    // Extract path and method
    const path = event.path;
    const method = event.httpMethod;
    const userId = event.pathParameters?.userId;
    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    };
    try {
        // Validate userId
        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId is required' })
            };
        }
        // Validate authorization - userId must match authenticated user
        const authenticatedUserId = event.requestContext?.authorizer?.claims?.sub;
        if (authenticatedUserId && authenticatedUserId !== userId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Unauthorized: userId mismatch' })
            };
        }
        // Route to appropriate handler based on path
        if (path.includes('/balance')) {
            return await handleBalanceRoutes(event, userId, headers);
        }
        else if (path.includes('/profile')) {
            return await handleProfile(method, userId, event.body, headers);
        }
        else if (path.includes('/preferences')) {
            return await handlePreferences(method, userId, event.body, headers);
        }
        else if (path.includes('/executions')) {
            return await handleExecutions(method, userId, event.queryStringParameters, headers);
        }
        else if (path.includes('/trades')) {
            return await handleTrades(method, userId, event.queryStringParameters, headers);
        }
        else if (path.includes('/stats')) {
            return await handleStats(method, userId, event.queryStringParameters, headers);
        }
        else if (path.includes('/sync')) {
            return await handleSync(method, userId, event.body, headers);
        }
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Endpoint not found' })
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error:', errorMessage, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', message: errorMessage })
        };
    }
}
/**
 * Handle /profile endpoints (GET, PUT)
 */
async function handleProfile(method, userId, body, headers) {
    if (method === 'GET') {
        // Get user profile
        const command = new client_dynamodb_1.GetItemCommand({
            TableName: config.USER_PROFILES_TABLE,
            Key: (0, util_dynamodb_1.marshall)({ userId, dataType: 'PROFILE' })
        });
        const result = await dynamoClient.send(command);
        if (!result.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Profile not found' })
            };
        }
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify((0, util_dynamodb_1.unmarshall)(result.Item))
        };
    }
    else if (method === 'PUT') {
        // Update user profile
        if (!body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Request body is required' })
            };
        }
        const updates = JSON.parse(body);
        const now = new Date().toISOString();
        // Build update expression
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        const allowedFields = ['displayName', 'isPublic', 'accountStartingBalance', 'bio', 'location'];
        Object.keys(updates).forEach((key) => {
            if (allowedFields.includes(key)) {
                updateExpressions.push(`#${key} = :${key}`);
                expressionAttributeNames[`#${key}`] = key;
                expressionAttributeValues[`:${key}`] = updates[key];
            }
        });
        if (updateExpressions.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No valid fields to update' })
            };
        }
        updateExpressions.push('#updatedAt = :updatedAt');
        expressionAttributeNames['#updatedAt'] = 'updatedAt';
        expressionAttributeValues[':updatedAt'] = now;
        const command = new client_dynamodb_1.UpdateItemCommand({
            TableName: config.USER_PROFILES_TABLE,
            Key: (0, util_dynamodb_1.marshall)({ userId, dataType: 'PROFILE' }),
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)(expressionAttributeValues),
            ReturnValues: 'ALL_NEW'
        });
        const result = await dynamoClient.send(command);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Attributes ? (0, util_dynamodb_1.unmarshall)(result.Attributes) : {})
        };
    }
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
}
/**
 * Handle /preferences endpoints (GET, PUT)
 */
async function handlePreferences(method, userId, body, headers) {
    if (method === 'GET') {
        // Get user preferences
        const command = new client_dynamodb_1.GetItemCommand({
            TableName: config.USER_PREFERENCES_TABLE,
            Key: (0, util_dynamodb_1.marshall)({ userId, preferenceKey: 'DEFAULT' })
        });
        const result = await dynamoClient.send(command);
        if (!result.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Preferences not found' })
            };
        }
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify((0, util_dynamodb_1.unmarshall)(result.Item))
        };
    }
    else if (method === 'PUT') {
        // Update user preferences
        if (!body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Request body is required' })
            };
        }
        const updates = JSON.parse(body);
        const now = new Date().toISOString();
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        const allowedFields = [
            'calculationMethod',
            'commissionTier',
            'timezone',
            'dateFormat',
            'currency',
            'notificationPreferences',
            'displayPreferences'
        ];
        Object.keys(updates).forEach((key) => {
            if (allowedFields.includes(key)) {
                updateExpressions.push(`#${key} = :${key}`);
                expressionAttributeNames[`#${key}`] = key;
                expressionAttributeValues[`:${key}`] = updates[key];
            }
        });
        if (updateExpressions.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No valid fields to update' })
            };
        }
        updateExpressions.push('#updatedAt = :updatedAt');
        expressionAttributeNames['#updatedAt'] = 'updatedAt';
        expressionAttributeValues[':updatedAt'] = now;
        const command = new client_dynamodb_1.UpdateItemCommand({
            TableName: config.USER_PREFERENCES_TABLE,
            Key: (0, util_dynamodb_1.marshall)({ userId, preferenceKey: 'DEFAULT' }),
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)(expressionAttributeValues, { removeUndefinedValues: true }),
            ReturnValues: 'ALL_NEW'
        });
        const result = await dynamoClient.send(command);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Attributes ? (0, util_dynamodb_1.unmarshall)(result.Attributes) : {})
        };
    }
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
}
/**
 * Handle /executions endpoint (GET)
 */
async function handleExecutions(method, userId, queryParams, headers) {
    if (method === 'GET') {
        const limit = queryParams?.limit ? parseInt(queryParams.limit) : 100;
        const startDate = queryParams?.startDate;
        const endDate = queryParams?.endDate;
        let keyConditionExpression = 'userId = :userId';
        const expressionAttributeValues = { ':userId': userId };
        // Add date range if provided
        if (startDate && endDate) {
            keyConditionExpression += ' AND #date BETWEEN :startDate AND :endDate';
            expressionAttributeValues[':startDate'] = startDate;
            expressionAttributeValues[':endDate'] = endDate;
        }
        const command = new client_dynamodb_1.QueryCommand({
            TableName: config.TRADING_EXECUTIONS_TABLE,
            KeyConditionExpression: keyConditionExpression,
            ExpressionAttributeNames: startDate && endDate ? { '#date': 'Date' } : undefined,
            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)(expressionAttributeValues),
            Limit: limit,
            ScanIndexForward: false // Most recent first
        });
        const result = await dynamoClient.send(command);
        const executions = result.Items?.map((item) => (0, util_dynamodb_1.unmarshall)(item)) || [];
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                executions,
                count: executions.length,
                lastEvaluatedKey: result.LastEvaluatedKey ? (0, util_dynamodb_1.unmarshall)(result.LastEvaluatedKey) : null
            })
        };
    }
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
}
/**
 * Handle /trades endpoint (GET)
 * Supports pagination - fetches all trades when no limit specified
 */
async function handleTrades(method, userId, queryParams, headers) {
    if (method === 'GET') {
        const calculationMethod = queryParams?.method || 'fifo'; // 'fifo' or 'perPosition'
        const requestedLimit = queryParams?.limit ? parseInt(queryParams.limit) : null;
        // If no limit specified or limit > 10000, fetch all trades
        const fetchAll = !requestedLimit || requestedLimit > 10000;
        const batchSize = 1000; // DynamoDB batch size for pagination

        let allTrades = [];
        let lastEvaluatedKey = null;

        do {
            const commandParams = {
                TableName: config.MATCHED_TRADES_TABLE,
                KeyConditionExpression: 'userId = :userId AND begins_with(calculationMethod_tradeId, :method)',
                ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                    ':userId': userId,
                    ':method': `${calculationMethod}#`
                }),
                Limit: fetchAll ? batchSize : requestedLimit,
                ScanIndexForward: false // Most recent first
            };

            // Add ExclusiveStartKey for pagination if we have a lastEvaluatedKey
            if (lastEvaluatedKey) {
                commandParams.ExclusiveStartKey = lastEvaluatedKey;
            }

            const command = new client_dynamodb_1.QueryCommand(commandParams);
            const result = await dynamoClient.send(command);
            const trades = result.Items?.map((item) => (0, util_dynamodb_1.unmarshall)(item)) || [];
            allTrades = allTrades.concat(trades);
            lastEvaluatedKey = result.LastEvaluatedKey || null;

            // Stop if we've reached the requested limit (when not fetching all)
            if (!fetchAll && allTrades.length >= requestedLimit) {
                allTrades = allTrades.slice(0, requestedLimit);
                break;
            }
        } while (lastEvaluatedKey && fetchAll);

        console.log(`Fetched ${allTrades.length} ${calculationMethod} trades for user ${userId}`);

        // Helper: Build method-prefixed tradeId for journal/override lookup
        const buildPrefixedTradeId = (tradeId, method) => `${method}#${tradeId}`;

        // Fetch commission overrides and merge with trades
        // Commission overrides use method-prefixed tradeId format: {method}#{tradeId}
        let tradesWithOverrides = allTrades;
        try {
            const overridesResult = await dynamoClient.send(new client_dynamodb_1.QueryCommand({
                TableName: config.COMMISSION_OVERRIDES_TABLE,
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({ ':userId': userId })
            }));

            // Map overrides by both raw tradeId and method-prefixed tradeId for backwards compatibility
            const overridesByRaw = new Map();
            const overridesByPrefixed = new Map();
            (overridesResult.Items || [])
                .map(item => (0, util_dynamodb_1.unmarshall)(item))
                .forEach(o => {
                    // New format: method-prefixed tradeId
                    if (o.rawTradeId) {
                        overridesByPrefixed.set(o.tradeId, o.overrideCommission);
                    } else {
                        // Legacy format: raw tradeId
                        overridesByRaw.set(o.tradeId, o.overrideCommission);
                    }
                });

            if (overridesByRaw.size > 0 || overridesByPrefixed.size > 0) {
                console.log(`Found ${overridesByRaw.size + overridesByPrefixed.size} commission overrides for user ${userId}`);
                tradesWithOverrides = allTrades.map(trade => {
                    // Check method-prefixed format first (new), then legacy raw format
                    const prefixedId = buildPrefixedTradeId(trade.tradeId, calculationMethod);
                    const override = overridesByPrefixed.get(prefixedId) ?? overridesByRaw.get(trade.tradeId);
                    if (override !== undefined) {
                        // Recalculate pl when commission changes
                        // grossPL = pl - originalCommission, then newPL = grossPL + newCommission
                        const originalCommission = trade.commission || 0;
                        const grossPL = trade.pl - originalCommission;
                        const newPL = grossPL + override;
                        return {
                            ...trade,
                            commission: override,
                            pl: newPL,
                            hasCommissionOverride: true
                        };
                    }
                    return trade;
                });
            }
        } catch (err) {
            // If CommissionOverrides table doesn't exist yet, continue without overrides
            console.log(`Commission overrides table not available or error: ${err.message}`);
        }

        // Fetch journal existence for all trades
        // Journals use method-prefixed tradeId format: {method}#{tradeId}
        try {
            const tradeIds = tradesWithOverrides.map(t => t.tradeId);
            const journalTradeIds = new Set();

            // Build method-prefixed keys for journal lookup
            const prefixedTradeIds = tradeIds.map(id => buildPrefixedTradeId(id, calculationMethod));

            // BatchGetItem to check which journals exist (DynamoDB limit: 100 items per batch)
            // Check both new format (method-prefixed) and legacy format (raw tradeId) for backwards compatibility
            for (let i = 0; i < tradeIds.length; i += 100) {
                const batchRaw = tradeIds.slice(i, i + 100);
                const batchPrefixed = prefixedTradeIds.slice(i, i + 100);

                // Create keys for both raw and prefixed formats
                const allKeys = [
                    ...batchPrefixed.map(tradeId => (0, util_dynamodb_1.marshall)({ userId, tradeId })),
                    ...batchRaw.map(tradeId => (0, util_dynamodb_1.marshall)({ userId, tradeId }))
                ];

                // DynamoDB BatchGetItem has a limit of 100 keys, so split if needed
                for (let j = 0; j < allKeys.length; j += 100) {
                    const keyBatch = allKeys.slice(j, j + 100);
                    const batchResult = await dynamoClient.send(new BatchGetItemCommand({
                        RequestItems: {
                            [config.TRADE_JOURNALS_TABLE]: {
                                Keys: keyBatch,
                                ProjectionExpression: 'tradeId, rawTradeId'
                            }
                        }
                    }));

                    const items = batchResult.Responses?.[config.TRADE_JOURNALS_TABLE] || [];
                    items.forEach(item => {
                        const journal = (0, util_dynamodb_1.unmarshall)(item);
                        // If rawTradeId exists (new format), use it; otherwise use tradeId directly (legacy)
                        if (journal.rawTradeId) {
                            journalTradeIds.add(journal.rawTradeId);
                        } else {
                            journalTradeIds.add(journal.tradeId);
                        }
                    });
                }
            }

            // Add hasJournal flag to each trade
            tradesWithOverrides = tradesWithOverrides.map(trade => ({
                ...trade,
                hasJournal: journalTradeIds.has(trade.tradeId)
            }));

            console.log(`Found ${journalTradeIds.size} journals for ${tradeIds.length} trades`);
        } catch (err) {
            console.log(`Journal lookup error: ${err.message}`);
            // Continue without journal flags if lookup fails
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                trades: tradesWithOverrides,
                count: tradesWithOverrides.length,
                total: tradesWithOverrides.length,
                method: calculationMethod,
                lastEvaluatedKey: null // All trades fetched
            })
        };
    }
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
}
/**
 * Handle /stats endpoint (GET)
 */
async function handleStats(method, userId, queryParams, headers) {
    if (method === 'GET') {
        const periodType = queryParams?.period || 'ALL'; // 'ALL', 'DAILY', 'WEEKLY', 'MONTHLY'
        const command = new client_dynamodb_1.GetItemCommand({
            TableName: config.TRADING_STATS_TABLE,
            Key: (0, util_dynamodb_1.marshall)({ userId, statsType: periodType })
        });
        const result = await dynamoClient.send(command);
        if (!result.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Stats not found' })
            };
        }
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify((0, util_dynamodb_1.unmarshall)(result.Item))
        };
    }
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
}
/**
 * Handle /sync endpoint (POST)
 * Future: Sync with broker APIs (TradeStation, Rithmic, etc.)
 */
async function handleSync(method, userId, body, headers) {
    if (method === 'POST') {
        // Placeholder for future broker sync implementation
        return {
            statusCode: 501,
            headers,
            body: JSON.stringify({
                message: 'Broker sync not yet implemented',
                userId
            })
        };
    }
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
}
