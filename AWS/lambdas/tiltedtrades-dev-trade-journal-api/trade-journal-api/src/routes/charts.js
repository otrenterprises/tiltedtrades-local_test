"use strict";
/**
 * Chart Routes Handler
 *
 * Chart/screenshot management:
 * - POST /api/users/{userId}/trades/{tradeId}/journal/charts - Generate presigned URL
 * - DELETE /api/users/{userId}/trades/{tradeId}/journal/charts/{chartId} - Delete chart
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChartRoutes = handleChartRoutes;

const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { randomUUID } = require("crypto");
const { getConfig } = require("@tiltedtrades/config");
const { buildJournalTradeId, extractRawTradeId } = require("../utils/tradeId");
const { getExistingJournal } = require("../utils/dynamo");

const config = getConfig();
const dynamoClient = new DynamoDBClient({ region: config.REGION });
const s3Client = new S3Client({ region: config.REGION });

/**
 * Main chart routes handler
 */
async function handleChartRoutes(event, userId, headers) {
    const method = event.httpMethod;
    const tradeId = event.pathParameters?.tradeId;
    const chartId = event.pathParameters?.chartId;
    const queryParams = event.queryStringParameters;

    if (!tradeId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'tradeId is required' }),
        };
    }

    if (method === 'POST') {
        return await handleChartUpload(userId, tradeId, event.body, headers);
    }
    else if (method === 'DELETE' && chartId) {
        return await handleDeleteChart(userId, tradeId, chartId, headers, queryParams);
    }

    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
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

    // Validate chart type
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
            chartId: randomUUID(),
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
    const chartId = randomUUID();
    const fileExtension = data.fileExtension || 'png';
    const contentType = data.contentType || 'image/png';
    const s3Key = `users/${userId}/journal/charts/${tradeId}/${chartId}.${fileExtension}`;

    const command = new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: s3Key,
        ContentType: contentType,
    });
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

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
 */
async function handleDeleteChart(userId, tradeId, chartId, headers, queryParams) {
    const calculationMethod = queryParams?.method || 'fifo';
    const journalTradeId = buildJournalTradeId(tradeId, calculationMethod);
    const rawTradeId = extractRawTradeId(tradeId);

    // Get existing journal
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
            await s3Client.send(new DeleteObjectCommand({
                Bucket: config.S3_BUCKET,
                Key: chart.s3Key,
            }));
        } catch (error) {
            console.error('Error deleting chart from S3:', error);
        }
    }

    // Remove chart reference from journal
    existingJournal.chartReferences.splice(chartIndex, 1);
    existingJournal.updatedAt = new Date().toISOString();

    // Update journal in DynamoDB
    await dynamoClient.send(new PutItemCommand({
        TableName: config.TRADE_JOURNALS_TABLE,
        Item: marshall(existingJournal, { removeUndefinedValues: true }),
    }));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Chart deleted successfully' }),
    };
}
