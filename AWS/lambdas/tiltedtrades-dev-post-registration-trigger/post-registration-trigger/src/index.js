"use strict";
/**
 * Post-Registration Trigger Lambda
 *
 * Cognito Post-Confirmation trigger that initializes new user profiles.
 * Creates default UserProfiles and UserPreferences records for new users.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
const config_1 = require("../../shared/types/config");
// Get configuration from environment variables
const config = (0, config_1.getConfig)();
// AWS SDK client
const dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: config.REGION });
/**
 * Main Lambda handler - Cognito Post-Confirmation trigger
 */
const handler = async (event) => {
    console.log('Post-confirmation trigger received:', JSON.stringify(event, null, 2));
    const userId = event.request.userAttributes.sub;
    const email = event.request.userAttributes.email;
    const displayName = event.request.userAttributes.name || email.split('@')[0];
    try {
        // Create user profile record
        await createUserProfile(userId, email, displayName);
        // Create default user preferences
        await createDefaultPreferences(userId);
        console.log(`Successfully initialized user ${userId}`);
        // IMPORTANT: Must return the event for Cognito to continue
        return event;
    }
    catch (error) {
        console.error(`Error initializing user ${userId}:`, error);
        // Log error but don't fail the registration
        // Return event to allow user registration to complete
        return event;
    }
};
exports.handler = handler;
/**
 * Create user profile record in DynamoDB
 */
async function createUserProfile(userId, email, displayName) {
    const now = new Date().toISOString();
    const userProfile = {
        userId,
        dataType: 'PROFILE',
        email,
        displayName,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
        totalTrades: 0,
        totalPL: 0,
        winRate: 0,
        accountStartingBalance: 0
    };
    const command = new client_dynamodb_1.PutItemCommand({
        TableName: config.USER_PROFILES_TABLE,
        Item: (0, util_dynamodb_1.marshall)(userProfile),
        ConditionExpression: 'attribute_not_exists(userId)'
    });
    try {
        await dynamoClient.send(command);
        console.log(`Created user profile for ${userId}`);
    }
    catch (error) {
        const errorName = error instanceof Error ? error.name : '';
        if (errorName === 'ConditionalCheckFailedException') {
            console.log(`User profile already exists for ${userId}`);
        }
        else {
            throw error;
        }
    }
}
/**
 * Create default user preferences
 */
async function createDefaultPreferences(userId) {
    const now = new Date().toISOString();
    const preferences = {
        userId,
        preferenceKey: 'DEFAULT',
        calculationMethod: 'fifo', // 'fifo' or 'perPosition'
        commissionTier: 'fixed',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        currency: 'USD',
        notificationPreferences: {
            emailOnUpload: true,
            emailOnProcessing: false,
            weeklyDigest: true
        },
        displayPreferences: {
            chartType: 'cumulative',
            defaultTimeRange: '1M',
            showCommissions: true
        },
        createdAt: now,
        updatedAt: now
    };
    const command = new client_dynamodb_1.PutItemCommand({
        TableName: config.USER_PREFERENCES_TABLE,
        Item: (0, util_dynamodb_1.marshall)(preferences, { removeUndefinedValues: true }),
        ConditionExpression: 'attribute_not_exists(userId)'
    });
    try {
        await dynamoClient.send(command);
        console.log(`Created default preferences for ${userId}`);
    }
    catch (error) {
        const errorName = error instanceof Error ? error.name : '';
        if (errorName === 'ConditionalCheckFailedException') {
            console.log(`User preferences already exist for ${userId}`);
        }
        else {
            throw error;
        }
    }
}
