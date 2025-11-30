"use strict";
/**
 * Public Profiles API Lambda
 *
 * Handles public API requests for leaderboard and public profile views.
 * No authentication required - returns only public profiles (isPublic = true).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
const config_1 = require("../../shared/types/config");
// Get configuration from environment variables
const config = (0, config_1.getConfig)();
// AWS SDK client
const dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: config.REGION });
/**
 * Main Lambda handler - API Gateway proxy integration
 */
async function handler(event) {
    console.log('Public profiles request:', JSON.stringify(event, null, 2));
    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
    };
    try {
        const userId = event.pathParameters?.userId;
        // Route: GET /api/public/profiles
        if (!userId) {
            return await handleLeaderboard(event.queryStringParameters, headers);
        }
        // Route: GET /api/public/profiles/{userId}
        return await handlePublicProfile(userId, headers);
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
 * Handle GET /api/public/profiles - Leaderboard
 * Returns list of public profiles sorted by performance
 */
async function handleLeaderboard(queryParams, headers) {
    const limit = queryParams?.limit ? parseInt(queryParams.limit) : 50;
    const sortBy = queryParams?.sortBy || 'totalPL'; // 'totalPL', 'winRate', 'totalTrades'
    // Query the LeaderboardIndex GSI (isPublic = true, sorted by totalPL)
    const command = new client_dynamodb_1.QueryCommand({
        TableName: config.USER_PROFILES_TABLE,
        IndexName: 'LeaderboardIndex',
        KeyConditionExpression: 'isPublic = :isPublic',
        ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
            ':isPublic': true
        }),
        Limit: limit,
        ScanIndexForward: false // Descending order (highest first)
    });
    const result = await dynamoClient.send(command);
    let profiles = result.Items?.map((item) => (0, util_dynamodb_1.unmarshall)(item)) || [];
    // Filter to only include PROFILE dataType
    profiles = profiles.filter((p) => p.dataType === 'PROFILE');
    // Remove sensitive fields
    profiles = profiles.map((profile) => ({
        userId: profile.userId,
        displayName: profile.displayName,
        bio: profile.bio,
        location: profile.location,
        totalTrades: profile.totalTrades || 0,
        totalPL: profile.totalPL || 0,
        winRate: profile.winRate || 0,
        createdAt: profile.createdAt,
        rank: 0 // Will be assigned after sorting
    }));
    // Sort by requested metric
    if (sortBy === 'winRate') {
        profiles.sort((a, b) => (b.winRate || 0) - (a.winRate || 0));
    }
    else if (sortBy === 'totalTrades') {
        profiles.sort((a, b) => (b.totalTrades || 0) - (a.totalTrades || 0));
    }
    else {
        // Default: totalPL (already sorted from GSI)
        profiles.sort((a, b) => (b.totalPL || 0) - (a.totalPL || 0));
    }
    // Assign ranks
    profiles.forEach((profile, index) => {
        profile.rank = index + 1;
    });
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            profiles,
            count: profiles.length,
            sortBy,
            limit
        })
    };
}
/**
 * Handle GET /api/public/profiles/{userId} - Single public profile
 * Returns public profile if user has isPublic = true
 */
async function handlePublicProfile(userId, headers) {
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
    const profile = (0, util_dynamodb_1.unmarshall)(result.Item);
    // Check if profile is public
    if (!profile.isPublic) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'This profile is private' })
        };
    }
    // Remove sensitive fields (email, account balance, etc.)
    const publicProfile = {
        userId: profile.userId,
        displayName: profile.displayName,
        bio: profile.bio,
        location: profile.location,
        totalTrades: profile.totalTrades || 0,
        totalPL: profile.totalPL || 0,
        winRate: profile.winRate || 0,
        createdAt: profile.createdAt
    };
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(publicProfile)
    };
}
