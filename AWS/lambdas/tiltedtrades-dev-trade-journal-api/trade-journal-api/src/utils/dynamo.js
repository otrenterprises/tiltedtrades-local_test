"use strict";
/**
 * DynamoDB Utilities
 *
 * Helper functions for DynamoDB operations related to journals and trades.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTradeExists = verifyTradeExists;
exports.getExistingJournal = getExistingJournal;
exports.getMatchedTrade = getMatchedTrade;
exports.triggerStatsRecalculation = triggerStatsRecalculation;

const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { getConfig } = require("@tiltedtrades/config");

const config = getConfig();
const dynamoClient = new DynamoDBClient({ region: config.REGION });
const lambdaClient = new LambdaClient({ region: config.REGION });

/**
 * Verify that a trade exists in MatchedTrades table
 */
async function verifyTradeExists(userId, tradeId) {
    try {
        // Try FIFO first, then perPosition
        const methods = ['fifo', 'perPosition'];
        for (const method of methods) {
            const sortKey = `${method}#${tradeId}`;
            const command = new GetItemCommand({
                TableName: config.MATCHED_TRADES_TABLE,
                Key: marshall({ userId, calculationMethod_tradeId: sortKey }),
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
 * Get existing journal entry
 */
async function getExistingJournal(userId, tradeId) {
    try {
        const command = new GetItemCommand({
            TableName: config.TRADE_JOURNALS_TABLE,
            Key: marshall({ userId, tradeId }),
        });
        const response = await dynamoClient.send(command);
        if (!response.Item) {
            return null;
        }
        return unmarshall(response.Item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error getting existing journal:', errorMessage, error);
        return null;
    }
}

/**
 * Get matched trade to capture current commission
 */
async function getMatchedTrade(userId, tradeId, calculationMethod = null) {
    try {
        // If calculationMethod is specified, use it directly
        if (calculationMethod) {
            const sortKey = `${calculationMethod}#${tradeId}`;
            const command = new GetItemCommand({
                TableName: config.MATCHED_TRADES_TABLE,
                Key: marshall({ userId, calculationMethod_tradeId: sortKey }),
            });
            const response = await dynamoClient.send(command);
            if (response.Item) {
                return unmarshall(response.Item);
            }
            return null;
        }
        // Fallback: Try FIFO first, then perPosition
        const methods = ['fifo', 'perPosition'];
        for (const method of methods) {
            const sortKey = `${method}#${tradeId}`;
            const command = new GetItemCommand({
                TableName: config.MATCHED_TRADES_TABLE,
                Key: marshall({ userId, calculationMethod_tradeId: sortKey }),
            });
            const response = await dynamoClient.send(command);
            if (response.Item) {
                return unmarshall(response.Item);
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
 * Trigger stats recalculation Lambda asynchronously
 */
async function triggerStatsRecalculation(userId) {
    try {
        const command = new InvokeCommand({
            FunctionName: config.STATS_CALCULATOR_FUNCTION,
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
