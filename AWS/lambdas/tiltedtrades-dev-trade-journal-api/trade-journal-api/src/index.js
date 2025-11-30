"use strict";
/**
 * Trade Journal API Lambda
 *
 * Handles API Gateway requests for trade journal management including:
 * - CRUD operations for journal entries (text notes, tags)
 * - Chart/screenshot management (presigned URLs, metadata)
 * - List/search journals with filtering
 *
 * Routes:
 * - POST   /api/users/{userId}/trades/{tradeId}/journal - Create/update journal
 * - GET    /api/users/{userId}/trades/{tradeId}/journal - Get journal for trade
 * - DELETE /api/users/{userId}/trades/{tradeId}/journal - Delete journal
 * - POST   /api/users/{userId}/trades/{tradeId}/journal/charts - Get presigned URL for chart upload
 * - DELETE /api/users/{userId}/trades/{tradeId}/journal/charts/{chartId} - Delete chart
 * - GET    /api/users/{userId}/journals - List all journals with optional filtering
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
const config_1 = require("../../shared/types/config");
const crypto_1 = require("crypto");
const client_lambda_1 = require("@aws-sdk/client-lambda");
// Get configuration from environment variables
const config = (0, config_1.getConfig)();
const lambdaClient = new client_lambda_1.LambdaClient({ region: config.REGION });
// AWS SDK clients
const dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: config.REGION });
const s3Client = new client_s3_1.S3Client({ region: config.REGION });
/**
 * Main Lambda handler - API Gateway proxy integration
 */
async function handler(event) {
    console.log('Request:', JSON.stringify(event, null, 2));
    // Extract path parameters
    const path = event.path;
    const method = event.httpMethod;
    const userId = event.pathParameters?.userId;
    const tradeId = event.pathParameters?.tradeId;
    const chartId = event.pathParameters?.chartId;
    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    };
    try {
        // Validate userId
        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId is required' }),
            };
        }
        // Validate authorization - userId must match authenticated user
        const authenticatedUserId = event.requestContext?.authorizer?.claims?.sub;
        if (authenticatedUserId && authenticatedUserId !== userId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Unauthorized: userId mismatch' }),
            };
        }
        // Route to appropriate handler
        if (path.includes('/journals') && !path.includes('/journal/')) {
            // List/search journals: GET /api/users/{userId}/journals
            return await handleListJournals(userId, event.queryStringParameters, headers);
        }
        else if (path.includes('/journal/charts/') && chartId) {
            // Delete chart: DELETE /api/users/{userId}/trades/{tradeId}/journal/charts/{chartId}
            return await handleDeleteChart(userId, tradeId, chartId, headers, event.queryStringParameters);
        }
        else if (path.includes('/journal/charts')) {
            // Upload chart: POST /api/users/{userId}/trades/{tradeId}/journal/charts
            return await handleChartUpload(userId, tradeId, event.body, headers);
        }
        else if (path.includes('/journal')) {
            // Journal CRUD: GET/POST/DELETE /api/users/{userId}/trades/{tradeId}/journal
            if (!tradeId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'tradeId is required' }),
                };
            }
            if (method === 'GET') {
                return await handleGetJournal(userId, tradeId, headers, event.queryStringParameters);
            }
            else if (method === 'POST') {
                return await handleCreateUpdateJournal(userId, tradeId, event.body, headers);
            }
            else if (method === 'DELETE') {
                return await handleDeleteJournal(userId, tradeId, headers, event.queryStringParameters);
            }
        }
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Endpoint not found' }),
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error:', errorMessage, error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', message: errorMessage }),
        };
    }
}
/**
 * Helper: Build method-prefixed tradeId for journal storage
 * Format: {calculationMethod}#{tradeId} (e.g., "fifo#123_456_0")
 */
function buildJournalTradeId(tradeId, calculationMethod) {
    const method = calculationMethod || 'fifo';
    // If already prefixed, return as-is
    if (tradeId.startsWith('fifo#') || tradeId.startsWith('perPosition#')) {
        return tradeId;
    }
    return `${method}#${tradeId}`;
}

/**
 * Helper: Extract raw tradeId from method-prefixed format
 */
function extractRawTradeId(prefixedTradeId) {
    if (prefixedTradeId.startsWith('fifo#')) {
        return prefixedTradeId.substring(5);
    }
    if (prefixedTradeId.startsWith('perPosition#')) {
        return prefixedTradeId.substring(12);
    }
    return prefixedTradeId;
}

/**
 * Helper: Extract calculationMethod from method-prefixed format
 */
function extractCalculationMethod(prefixedTradeId) {
    if (prefixedTradeId.startsWith('fifo#')) {
        return 'fifo';
    }
    if (prefixedTradeId.startsWith('perPosition#')) {
        return 'perPosition';
    }
    return 'fifo'; // default
}

/**
 * GET /api/users/{userId}/trades/{tradeId}/journal
 * Retrieve journal entry for a specific trade
 * Query param: ?method=fifo|perPosition (defaults to fifo)
 */
async function handleGetJournal(userId, tradeId, headers, queryParams) {
    const calculationMethod = queryParams?.method || 'fifo';
    const journalTradeId = buildJournalTradeId(tradeId, calculationMethod);

    const command = new client_dynamodb_1.GetItemCommand({
        TableName: config.TRADE_JOURNALS_TABLE,
        Key: (0, util_dynamodb_1.marshall)({ userId, tradeId: journalTradeId }),
    });
    const response = await dynamoClient.send(command);
    if (!response.Item) {
        // Try legacy format (without method prefix) for backwards compatibility
        const legacyCommand = new client_dynamodb_1.GetItemCommand({
            TableName: config.TRADE_JOURNALS_TABLE,
            Key: (0, util_dynamodb_1.marshall)({ userId, tradeId: tradeId }),
        });
        const legacyResponse = await dynamoClient.send(legacyCommand);
        if (!legacyResponse.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Journal not found' }),
            };
        }
        const journal = (0, util_dynamodb_1.unmarshall)(legacyResponse.Item);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(journal),
        };
    }
    const journal = (0, util_dynamodb_1.unmarshall)(response.Item);
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(journal),
    };
}
/**
 * POST /api/users/{userId}/trades/{tradeId}/journal
 * Create or update journal entry
 * Body param: calculationMethod=fifo|perPosition (defaults to fifo)
 */
async function handleCreateUpdateJournal(userId, tradeId, body, headers) {
    if (!body) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Request body is required' }),
        };
    }
    const data = JSON.parse(body);
    // Validate required fields
    if (!data.journalText && !data.tags && !data.chartReferences && !data.commissionOverride) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'At least one of journalText, tags, chartReferences, or commissionOverride is required' }),
        };
    }

    // Get calculation method from request body
    const calculationMethod = data.calculationMethod || 'fifo';

    // Build method-prefixed tradeId for storage
    const journalTradeId = buildJournalTradeId(tradeId, calculationMethod);
    const rawTradeId = extractRawTradeId(tradeId);

    // Verify that the trade exists in MatchedTrades table
    const tradeExists = await verifyTradeExists(userId, rawTradeId);
    if (!tradeExists) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Trade not found. Cannot create journal for non-existent trade.' }),
        };
    }

    // Check if journal already exists (try new format first, then legacy)
    let existingJournal = await getExistingJournal(userId, journalTradeId);
    if (!existingJournal) {
        // Try legacy format for backwards compatibility
        existingJournal = await getExistingJournal(userId, rawTradeId);
    }

    const now = new Date().toISOString();
    // Normalize tags (lowercase, trim, remove duplicates)
    const tags = data.tags
        ? Array.from(new Set(data.tags.map((tag) => tag.toLowerCase().trim())))
        : existingJournal?.tags || [];

    // Build journal entry with method-prefixed tradeId
    const journal = {
        userId,
        tradeId: journalTradeId,  // Use method-prefixed format
        rawTradeId: rawTradeId,   // Store raw tradeId for reference
        journalText: data.journalText || existingJournal?.journalText || '',
        tags,
        chartReferences: data.chartReferences || existingJournal?.chartReferences || [],
        calculationMethod: calculationMethod,
        symbol: data.symbol || existingJournal?.symbol,
        exitDate: data.exitDate || existingJournal?.exitDate,
        createdAt: existingJournal?.createdAt || now,
        updatedAt: now,
    };

    // Handle commission override if provided
    let commissionOverrideResult = null;
    if (data.commissionOverride && data.commissionOverride.overrideCommission !== undefined) {
        try {
            // Get the current trade to capture original commission (use specified calculation method)
            const trade = await getMatchedTrade(userId, rawTradeId, calculationMethod);
            const originalCommission = trade ? trade.commission : 0;

            // Save commission override to CommissionOverrides table with method-prefixed tradeId
            const overrideEntry = {
                userId,
                tradeId: journalTradeId,  // Use method-prefixed format
                rawTradeId: rawTradeId,   // Store raw tradeId for reference
                calculationMethod: calculationMethod,
                originalCommission,
                overrideCommission: data.commissionOverride.overrideCommission,
                reason: data.commissionOverride.reason || data.journalText || 'Commission override via journal',
                createdAt: now,
                updatedAt: now
            };

            await dynamoClient.send(new client_dynamodb_1.PutItemCommand({
                TableName: config.COMMISSION_OVERRIDES_TABLE,
                Item: (0, util_dynamodb_1.marshall)(overrideEntry, { removeUndefinedValues: true })
            }));

            // Add commission override info to journal
            journal.commissionOverride = {
                originalCommission,
                overrideCommission: data.commissionOverride.overrideCommission,
                reason: data.commissionOverride.reason || data.journalText
            };

            commissionOverrideResult = overrideEntry;
            console.log(`Commission override saved for trade ${journalTradeId}: ${originalCommission} -> ${data.commissionOverride.overrideCommission}`);

            // Trigger stats recalculation asynchronously
            await triggerStatsRecalculation(userId);
        } catch (overrideError) {
            console.error('Error saving commission override:', overrideError);
            // Continue with journal save even if override fails
        }
    }

    // Save to DynamoDB with method-prefixed tradeId
    const command = new client_dynamodb_1.PutItemCommand({
        TableName: config.TRADE_JOURNALS_TABLE,
        Item: (0, util_dynamodb_1.marshall)(journal, { removeUndefinedValues: true }),
    });
    await dynamoClient.send(command);

    const responseData = {
        message: existingJournal ? 'Journal updated successfully' : 'Journal created successfully',
        journal,
    };
    if (commissionOverrideResult) {
        responseData.commissionOverride = commissionOverrideResult;
    }

    return {
        statusCode: existingJournal ? 200 : 201,
        headers,
        body: JSON.stringify(responseData),
    };
}
/**
 * DELETE /api/users/{userId}/trades/{tradeId}/journal
 * Delete journal entry and associated charts
 * Query param: ?method=fifo|perPosition (defaults to fifo)
 */
async function handleDeleteJournal(userId, tradeId, headers, queryParams) {
    const calculationMethod = queryParams?.method || 'fifo';
    const journalTradeId = buildJournalTradeId(tradeId, calculationMethod);
    const rawTradeId = extractRawTradeId(tradeId);

    // Get existing journal to delete associated charts from S3
    // Try new format first, then legacy
    let existingJournal = await getExistingJournal(userId, journalTradeId);
    let deleteTradeId = journalTradeId;

    if (!existingJournal) {
        // Try legacy format
        existingJournal = await getExistingJournal(userId, rawTradeId);
        deleteTradeId = rawTradeId;
    }

    if (!existingJournal) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Journal not found' }),
        };
    }

    // Delete all chart files from S3
    if (existingJournal.chartReferences && existingJournal.chartReferences.length > 0) {
        for (const chart of existingJournal.chartReferences) {
            if (chart.s3Key) {
                try {
                    await s3Client.send(new client_s3_1.DeleteObjectCommand({
                        Bucket: config.S3_BUCKET,
                        Key: chart.s3Key,
                    }));
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    console.error('Error deleting chart from S3:', errorMessage, error);
                    // Continue with other deletions even if one fails
                }
            }
        }
    }

    // Delete journal from DynamoDB
    const command = new client_dynamodb_1.DeleteItemCommand({
        TableName: config.TRADE_JOURNALS_TABLE,
        Key: (0, util_dynamodb_1.marshall)({ userId, tradeId: deleteTradeId }),
    });
    await dynamoClient.send(command);

    // Also delete commission override if exists
    try {
        await dynamoClient.send(new client_dynamodb_1.DeleteItemCommand({
            TableName: config.COMMISSION_OVERRIDES_TABLE,
            Key: (0, util_dynamodb_1.marshall)({ userId, tradeId: deleteTradeId }),
        }));
    } catch (error) {
        // Commission override may not exist, ignore error
        console.log(`No commission override found for ${deleteTradeId}`);
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Journal deleted successfully' }),
    };
}
/**
 * POST /api/users/{userId}/trades/{tradeId}/journal/charts
 * Generate presigned URL for chart upload and store metadata
 */
async function handleChartUpload(userId, tradeId, body, headers) {
    if (!body) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Request body is required' }),
        };
    }
    const data = JSON.parse(body);
    // Validate chart type and metadata
    if (!data.type || !['uploaded', 'tradingview', 'internal'].includes(data.type)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Valid chart type is required (uploaded, tradingview, internal)' }),
        };
    }
    // For TradingView URLs, no presigned URL needed
    if (data.type === 'tradingview') {
        if (!data.url) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'URL is required for TradingView charts' }),
            };
        }
        const chartReference = {
            chartId: (0, crypto_1.randomUUID)(),
            type: 'tradingview',
            url: data.url,
            timestamp: new Date().toISOString(),
            description: data.description,
        };
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'TradingView chart reference created',
                chartReference,
            }),
        };
    }
    // For uploaded charts, generate presigned URL
    const chartId = (0, crypto_1.randomUUID)();
    const fileExtension = data.fileExtension || 'png';
    const contentType = data.contentType || 'image/png';
    const s3Key = `users/${userId}/journal/charts/${tradeId}/${chartId}.${fileExtension}`;
    // Generate presigned URL for upload (5 minutes expiration)
    const command = new client_s3_1.PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: s3Key,
        ContentType: contentType,
    });
    const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: 300 });
    const chartReference = {
        chartId,
        type: data.type,
        s3Key,
        timestamp: new Date().toISOString(),
        description: data.description,
        contentType,
    };
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            message: 'Presigned URL generated successfully',
            uploadUrl: presignedUrl,
            chartReference,
        }),
    };
}
/**
 * DELETE /api/users/{userId}/trades/{tradeId}/journal/charts/{chartId}
 * Delete a specific chart from journal
 * Query param: ?method=fifo|perPosition (defaults to fifo)
 */
async function handleDeleteChart(userId, tradeId, chartId, headers, queryParams) {
    const calculationMethod = queryParams?.method || 'fifo';
    const journalTradeId = buildJournalTradeId(tradeId, calculationMethod);
    const rawTradeId = extractRawTradeId(tradeId);

    // Get existing journal - try new format first, then legacy
    let existingJournal = await getExistingJournal(userId, journalTradeId);
    if (!existingJournal) {
        existingJournal = await getExistingJournal(userId, rawTradeId);
    }

    if (!existingJournal) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Journal not found' }),
        };
    }
    // Find chart in references
    const chartIndex = existingJournal.chartReferences?.findIndex((chart) => chart.chartId === chartId);
    if (chartIndex === undefined || chartIndex === -1) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Chart not found' }),
        };
    }
    const chart = existingJournal.chartReferences[chartIndex];
    // Delete from S3 if it's an uploaded file
    if (chart.s3Key) {
        try {
            await s3Client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: config.S3_BUCKET,
                Key: chart.s3Key,
            }));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error('Error deleting chart from S3:', errorMessage, error);
        }
    }
    // Remove chart reference from journal
    existingJournal.chartReferences.splice(chartIndex, 1);
    existingJournal.updatedAt = new Date().toISOString();
    // Update journal in DynamoDB (keep the existing tradeId format in the journal)
    const command = new client_dynamodb_1.PutItemCommand({
        TableName: config.TRADE_JOURNALS_TABLE,
        Item: (0, util_dynamodb_1.marshall)(existingJournal, { removeUndefinedValues: true }),
    });
    await dynamoClient.send(command);
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Chart deleted successfully' }),
    };
}
/**
 * GET /api/users/{userId}/journals
 * List all journals for a user with optional filtering
 * Query params: tags, symbol, limit, lastEvaluatedKey
 */
async function handleListJournals(userId, queryParams, headers) {
    const requestedLimit = queryParams?.limit ? parseInt(queryParams.limit) : null;
    const tags = queryParams?.tags?.split(',').map((tag) => tag.trim().toLowerCase());
    const symbol = queryParams?.symbol?.toUpperCase();

    // Fetch all journals (paginate through DynamoDB results)
    const batchSize = 1000; // DynamoDB batch size for pagination
    let allJournals = [];
    let lastEvaluatedKey = queryParams?.lastEvaluatedKey ? JSON.parse(queryParams.lastEvaluatedKey) : undefined;

    do {
        const command = new client_dynamodb_1.QueryCommand({
            TableName: config.TRADE_JOURNALS_TABLE,
            IndexName: 'UserDateIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                ':userId': userId,
            }),
            Limit: batchSize,
            ScanIndexForward: false, // Most recent first
            ExclusiveStartKey: lastEvaluatedKey,
        });

        const response = await dynamoClient.send(command);
        const journals = response.Items?.map((item) => (0, util_dynamodb_1.unmarshall)(item)) || [];
        allJournals = allJournals.concat(journals);
        lastEvaluatedKey = response.LastEvaluatedKey || null;

        // If a specific limit was requested and we've reached it, stop
        if (requestedLimit && allJournals.length >= requestedLimit) {
            allJournals = allJournals.slice(0, requestedLimit);
            break;
        }
    } while (lastEvaluatedKey);

    console.log(`Fetched ${allJournals.length} journals for user ${userId}`);

    // Client-side filtering for tags and symbol (if needed)
    if (tags && tags.length > 0) {
        allJournals = allJournals.filter((journal) => tags.some((tag) => journal.tags?.map((t) => t.toLowerCase()).includes(tag)));
    }
    if (symbol) {
        allJournals = allJournals.filter((journal) => journal.symbol?.toUpperCase() === symbol);
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            journals: allJournals,
            count: allJournals.length,
        }),
    };
}
/**
 * Helper: Verify that a trade exists in MatchedTrades table
 */
async function verifyTradeExists(userId, tradeId) {
    try {
        // Try FIFO first, then perPosition
        const methods = ['fifo', 'perPosition'];
        for (const method of methods) {
            const sortKey = `${method}#${tradeId}`;
            const command = new client_dynamodb_1.GetItemCommand({
                TableName: config.MATCHED_TRADES_TABLE,
                Key: (0, util_dynamodb_1.marshall)({ userId, calculationMethod_tradeId: sortKey }),
            });
            const response = await dynamoClient.send(command);
            if (response.Item) {
                return true;
            }
        }
        return false;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error verifying trade exists:', errorMessage, error);
        return false;
    }
}
/**
 * Helper: Get existing journal entry
 */
async function getExistingJournal(userId, tradeId) {
    try {
        const command = new client_dynamodb_1.GetItemCommand({
            TableName: config.TRADE_JOURNALS_TABLE,
            Key: (0, util_dynamodb_1.marshall)({ userId, tradeId }),
        });
        const response = await dynamoClient.send(command);
        if (!response.Item) {
            return null;
        }
        return (0, util_dynamodb_1.unmarshall)(response.Item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error getting existing journal:', errorMessage, error);
        return null;
    }
}
/**
 * Helper: Get matched trade to capture current commission
 */
async function getMatchedTrade(userId, tradeId, calculationMethod = null) {
    try {
        // If calculationMethod is specified, use it directly
        if (calculationMethod) {
            const sortKey = `${calculationMethod}#${tradeId}`;
            const command = new client_dynamodb_1.GetItemCommand({
                TableName: config.MATCHED_TRADES_TABLE,
                Key: (0, util_dynamodb_1.marshall)({ userId, calculationMethod_tradeId: sortKey }),
            });
            const response = await dynamoClient.send(command);
            if (response.Item) {
                return (0, util_dynamodb_1.unmarshall)(response.Item);
            }
            return null;
        }
        // Fallback: Try FIFO first, then perPosition
        const methods = ['fifo', 'perPosition'];
        for (const method of methods) {
            const sortKey = `${method}#${tradeId}`;
            const command = new client_dynamodb_1.GetItemCommand({
                TableName: config.MATCHED_TRADES_TABLE,
                Key: (0, util_dynamodb_1.marshall)({ userId, calculationMethod_tradeId: sortKey }),
            });
            const response = await dynamoClient.send(command);
            if (response.Item) {
                return (0, util_dynamodb_1.unmarshall)(response.Item);
            }
        }
        return null;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error getting matched trade:', errorMessage, error);
        return null;
    }
}
/**
 * Helper: Trigger stats recalculation Lambda asynchronously
 */
async function triggerStatsRecalculation(userId) {
    try {
        const command = new client_lambda_1.InvokeCommand({
            FunctionName: `tiltedtrades-${config.ENVIRONMENT}-stats-calculator`,
            InvocationType: 'Event', // Async invocation
            Payload: JSON.stringify({ userId })
        });
        await lambdaClient.send(command);
        console.log(`Stats recalculation triggered for user ${userId}`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error triggering stats recalculation:', errorMessage, error);
        // Don't throw - stats recalculation is not critical
    }
}
