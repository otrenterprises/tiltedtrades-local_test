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

const { handleJournalRoutes } = require("./routes/journal");
const { handleChartRoutes } = require("./routes/charts");

/**
 * Main Lambda handler - API Gateway proxy integration
 */
async function handler(event) {
    console.log('Request:', JSON.stringify(event, null, 2));

    // Extract path parameters
    const path = event.path;
    const userId = event.pathParameters?.userId;

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
        if (path.includes('/journal/charts')) {
            // Chart operations: POST/DELETE /api/users/{userId}/trades/{tradeId}/journal/charts[/{chartId}]
            return await handleChartRoutes(event, userId, headers);
        }
        else if (path.includes('/journals') || path.includes('/journal')) {
            // Journal operations: GET/POST/DELETE /api/users/{userId}/trades/{tradeId}/journal
            // Or: GET /api/users/{userId}/journals
            return await handleJournalRoutes(event, userId, headers);
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
