"use strict";
/**
 * Journal Routes Handler
 *
 * CRUD operations for journal entries:
 * - GET /api/users/{userId}/trades/{tradeId}/journal
 * - POST /api/users/{userId}/trades/{tradeId}/journal
 * - DELETE /api/users/{userId}/trades/{tradeId}/journal
 * - GET /api/users/{userId}/journals (list all)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleJournalRoutes = handleJournalRoutes;

const { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { getConfig } = require("@tiltedtrades/config");
const { buildJournalTradeId, extractRawTradeId } = require("../utils/tradeId");
const { verifyTradeExists, getExistingJournal, getMatchedTrade, triggerStatsRecalculation } = require("../utils/dynamo");

const config = getConfig();
const dynamoClient = new DynamoDBClient({ region: config.REGION });
const s3Client = new S3Client({ region: config.REGION });

/**
 * Main journal routes handler
 */
async function handleJournalRoutes(event, userId, headers) {
    const method = event.httpMethod;
    const path = event.path;
    const tradeId = event.pathParameters?.tradeId;
    const queryParams = event.queryStringParameters;

    // List journals: GET /api/users/{userId}/journals
    if (path.includes('/journals') && !path.includes('/journal/')) {
        return await handleListJournals(userId, queryParams, headers);
    }

    // Single journal operations require tradeId
    if (!tradeId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'tradeId is required' }),
        };
    }

    if (method === 'GET') {
        return await handleGetJournal(userId, tradeId, headers, queryParams);
    }
    else if (method === 'POST') {
        return await handleCreateUpdateJournal(userId, tradeId, event.body, headers);
    }
    else if (method === 'DELETE') {
        return await handleDeleteJournal(userId, tradeId, headers, queryParams);
    }

    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
    };
}

/**
 * GET /api/users/{userId}/trades/{tradeId}/journal
 * Retrieve journal entry for a specific trade
 */
async function handleGetJournal(userId, tradeId, headers, queryParams) {
    const calculationMethod = queryParams?.method || 'fifo';
    const journalTradeId = buildJournalTradeId(tradeId, calculationMethod);

    const command = new GetItemCommand({
        TableName: config.TRADE_JOURNALS_TABLE,
        Key: marshall({ userId, tradeId: journalTradeId }),
    });
    const response = await dynamoClient.send(command);

    if (!response.Item) {
        // Try legacy format (without method prefix) for backwards compatibility
        const legacyCommand = new GetItemCommand({
            TableName: config.TRADE_JOURNALS_TABLE,
            Key: marshall({ userId, tradeId: tradeId }),
        });
        const legacyResponse = await dynamoClient.send(legacyCommand);
        if (!legacyResponse.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Journal not found' }),
            };
        }
        const journal = unmarshall(legacyResponse.Item);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(journal),
        };
    }
    const journal = unmarshall(response.Item);
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(journal),
    };
}

/**
 * POST /api/users/{userId}/trades/{tradeId}/journal
 * Create or update journal entry
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

    const calculationMethod = data.calculationMethod || 'fifo';
    const journalTradeId = buildJournalTradeId(tradeId, calculationMethod);
    const rawTradeId = extractRawTradeId(tradeId);

    // Verify that the trade exists
    const tradeExists = await verifyTradeExists(userId, rawTradeId);
    if (!tradeExists) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Trade not found. Cannot create journal for non-existent trade.' }),
        };
    }

    // Check if journal already exists
    let existingJournal = await getExistingJournal(userId, journalTradeId);
    if (!existingJournal) {
        existingJournal = await getExistingJournal(userId, rawTradeId);
    }

    const now = new Date().toISOString();
    const tags = data.tags
        ? Array.from(new Set(data.tags.map((tag) => tag.toLowerCase().trim())))
        : existingJournal?.tags || [];

    const journal = {
        userId,
        tradeId: journalTradeId,
        rawTradeId: rawTradeId,
        journalText: data.journalText || existingJournal?.journalText || '',
        tags,
        chartReferences: data.chartReferences || existingJournal?.chartReferences || [],
        calculationMethod: calculationMethod,
        symbol: data.symbol || existingJournal?.symbol,
        exitDate: data.exitDate || existingJournal?.exitDate,
        createdAt: existingJournal?.createdAt || now,
        updatedAt: now,
    };

    // Handle commission override
    let commissionOverrideResult = null;
    if (data.commissionOverride && data.commissionOverride.overrideCommission !== undefined) {
        try {
            const trade = await getMatchedTrade(userId, rawTradeId, calculationMethod);
            const originalCommission = trade ? trade.commission : 0;

            // Use frontend-provided lastModified or fall back to server timestamp
            const lastModified = data.commissionOverride.lastModified || now;

            const overrideEntry = {
                userId,
                tradeId: journalTradeId,
                rawTradeId: rawTradeId,
                calculationMethod: calculationMethod,
                originalCommission,
                overrideCommission: data.commissionOverride.overrideCommission,
                reason: data.commissionOverride.reason || data.journalText || 'Commission override via journal',
                lastModified,
                createdAt: now,
                updatedAt: now
            };

            await dynamoClient.send(new PutItemCommand({
                TableName: config.COMMISSION_OVERRIDES_TABLE,
                Item: marshall(overrideEntry, { removeUndefinedValues: true })
            }));

            journal.commissionOverride = {
                originalCommission,
                overrideCommission: data.commissionOverride.overrideCommission,
                reason: data.commissionOverride.reason || data.journalText,
                lastModified
            };

            commissionOverrideResult = overrideEntry;
            console.log(`Commission override saved for trade ${journalTradeId}`);

            await triggerStatsRecalculation(userId);
        } catch (overrideError) {
            console.error('Error saving commission override:', overrideError);
        }
    }

    // Save journal
    await dynamoClient.send(new PutItemCommand({
        TableName: config.TRADE_JOURNALS_TABLE,
        Item: marshall(journal, { removeUndefinedValues: true }),
    }));

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
 */
async function handleDeleteJournal(userId, tradeId, headers, queryParams) {
    const calculationMethod = queryParams?.method || 'fifo';
    const journalTradeId = buildJournalTradeId(tradeId, calculationMethod);
    const rawTradeId = extractRawTradeId(tradeId);

    let existingJournal = await getExistingJournal(userId, journalTradeId);
    let deleteTradeId = journalTradeId;

    if (!existingJournal) {
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

    // Delete chart files from S3
    if (existingJournal.chartReferences && existingJournal.chartReferences.length > 0) {
        for (const chart of existingJournal.chartReferences) {
            if (chart.s3Key) {
                try {
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: config.S3_BUCKET,
                        Key: chart.s3Key,
                    }));
                } catch (error) {
                    console.error('Error deleting chart from S3:', error);
                }
            }
        }
    }

    // Delete journal
    await dynamoClient.send(new DeleteItemCommand({
        TableName: config.TRADE_JOURNALS_TABLE,
        Key: marshall({ userId, tradeId: deleteTradeId }),
    }));

    // Delete commission override if exists
    try {
        await dynamoClient.send(new DeleteItemCommand({
            TableName: config.COMMISSION_OVERRIDES_TABLE,
            Key: marshall({ userId, tradeId: deleteTradeId }),
        }));
    } catch (error) {
        console.log(`No commission override found for ${deleteTradeId}`);
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Journal deleted successfully' }),
    };
}

/**
 * GET /api/users/{userId}/journals
 * List all journals for a user with optional filtering
 */
async function handleListJournals(userId, queryParams, headers) {
    const requestedLimit = queryParams?.limit ? parseInt(queryParams.limit) : null;
    const tags = queryParams?.tags?.split(',').map((tag) => tag.trim().toLowerCase());
    const symbol = queryParams?.symbol?.toUpperCase();

    const batchSize = 1000;
    let allJournals = [];
    let lastEvaluatedKey = queryParams?.lastEvaluatedKey ? JSON.parse(queryParams.lastEvaluatedKey) : undefined;

    do {
        const command = new QueryCommand({
            TableName: config.TRADE_JOURNALS_TABLE,
            IndexName: 'UserDateIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: marshall({ ':userId': userId }),
            Limit: batchSize,
            ScanIndexForward: false,
            ExclusiveStartKey: lastEvaluatedKey,
        });

        const response = await dynamoClient.send(command);
        const journals = response.Items?.map((item) => unmarshall(item)) || [];
        allJournals = allJournals.concat(journals);
        lastEvaluatedKey = response.LastEvaluatedKey || null;

        if (requestedLimit && allJournals.length >= requestedLimit) {
            allJournals = allJournals.slice(0, requestedLimit);
            break;
        }
    } while (lastEvaluatedKey);

    // Client-side filtering
    if (tags && tags.length > 0) {
        allJournals = allJournals.filter((journal) =>
            tags.some((tag) => journal.tags?.map((t) => t.toLowerCase()).includes(tag))
        );
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
