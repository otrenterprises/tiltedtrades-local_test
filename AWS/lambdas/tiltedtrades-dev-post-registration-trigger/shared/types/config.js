"use strict";
/**
 * Shared Lambda Configuration
 *
 * Standardized environment variable access for all TiltedTrades Lambda functions.
 * Ensures consistent naming and provides type safety.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.getTableNames = getTableNames;
exports.validateConfig = validateConfig;
/**
 * Get Lambda configuration from environment variables
 *
 * @returns LambdaConfig object with all environment variables
 * @throws Error if required environment variables are missing
 */
function getConfig() {
    const env = process.env.ENVIRONMENT || 'dev';
    const projectName = 'tiltedtrades';
    return {
        REGION: process.env.REGION || 'us-east-1',
        ENVIRONMENT: env,
        // DynamoDB Tables - with fallback to constructed names
        USER_PROFILES_TABLE: process.env.USER_PROFILES_TABLE ||
            `${projectName}-${env}-UserProfiles`,
        USER_PREFERENCES_TABLE: process.env.USER_PREFERENCES_TABLE ||
            `${projectName}-${env}-UserPreferences`,
        TRADING_EXECUTIONS_TABLE: process.env.TRADING_EXECUTIONS_TABLE ||
            `${projectName}-${env}-TradingExecutions`,
        MATCHED_TRADES_TABLE: process.env.MATCHED_TRADES_TABLE ||
            `${projectName}-${env}-MatchedTrades`,
        TRADING_STATS_TABLE: process.env.TRADING_STATS_TABLE ||
            `${projectName}-${env}-TradingStats`,
        BROKER_CREDENTIALS_TABLE: process.env.BROKER_CREDENTIALS_TABLE ||
            `${projectName}-${env}-BrokerCredentials`,
        TRADE_JOURNALS_TABLE: process.env.TRADE_JOURNALS_TABLE ||
            `${projectName}-${env}-TradeJournals`,
        // S3 Bucket
        S3_BUCKET: process.env.S3_BUCKET ||
            process.env.UPLOADS_BUCKET ||
            `${projectName}-${env}-filebucket`,
        // Cognito
        COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID
    };
}
/**
 * Get specific table names for Lambdas that only need certain tables
 */
function getTableNames() {
    const config = getConfig();
    return {
        userProfiles: config.USER_PROFILES_TABLE,
        userPreferences: config.USER_PREFERENCES_TABLE,
        tradingExecutions: config.TRADING_EXECUTIONS_TABLE,
        matchedTrades: config.MATCHED_TRADES_TABLE,
        tradingStats: config.TRADING_STATS_TABLE,
        brokerCredentials: config.BROKER_CREDENTIALS_TABLE,
        tradeJournals: config.TRADE_JOURNALS_TABLE
    };
}
/**
 * Validate that required environment variables are set
 * @param required Array of required config keys
 * @throws Error if any required variables are missing
 */
function validateConfig(required) {
    const config = getConfig();
    const missing = [];
    for (const key of required) {
        if (!config[key]) {
            missing.push(key);
        }
    }
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
