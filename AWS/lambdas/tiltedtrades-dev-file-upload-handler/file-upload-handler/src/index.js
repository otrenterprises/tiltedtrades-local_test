"use strict";
/**
 * File Upload Handler Lambda
 *
 * Handles file upload requests from the frontend by generating presigned S3 URLs.
 * Frontend uploads directly to S3, which triggers the tradesData Lambda for processing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_ses_1 = require("@aws-sdk/client-ses");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
const config_1 = require("@tiltedtrades/config");
// Get configuration from environment variables
const config = (0, config_1.getConfig)();
const NOTIFICATION_EMAIL_FROM = process.env.NOTIFICATION_EMAIL_FROM || 'aws@tiltedtrades.com';
const PRESIGNED_URL_EXPIRATION = 300; // 5 minutes
// AWS SDK clients
const s3Client = new client_s3_1.S3Client({ region: config.REGION });
const dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: config.REGION });
const sesClient = new client_ses_1.SESClient({ region: config.REGION });
/**
 * Main Lambda handler
 */
async function handler(event) {
    console.log('File upload request received:', JSON.stringify(event));
    try {
        // Extract userId from path parameters
        const userId = event.pathParameters?.userId;
        if (!userId) {
            return createResponse(400, { error: 'Missing userId in path' });
        }
        // Validate userId matches the authenticated user (from Cognito JWT)
        const authenticatedUserId = event.requestContext.authorizer?.claims?.sub;
        if (!authenticatedUserId || authenticatedUserId !== userId) {
            console.error(`Authorization failed: authenticated user ${authenticatedUserId} !== requested user ${userId}`);
            return createResponse(403, { error: 'Unauthorized: userId mismatch' });
        }
        // Parse request body
        const body = event.body ? JSON.parse(event.body) : {};
        const { filename, contentType, fileSize } = body;
        if (!filename) {
            return createResponse(400, { error: 'Missing filename in request body' });
        }
        // Validate file extension (only Excel files)
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExtension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        if (!validExtensions.includes(fileExtension)) {
            return createResponse(400, {
                error: 'Invalid file type. Only Excel (.xlsx, .xls) and CSV (.csv) files are supported',
                allowedTypes: validExtensions
            });
        }
        // Validate file size (if provided)
        const maxFileSize = 50 * 1024 * 1024; // 50 MB
        if (fileSize && fileSize > maxFileSize) {
            return createResponse(400, {
                error: 'File too large',
                maxSize: maxFileSize,
                providedSize: fileSize
            });
        }
        // Generate S3 key for user-specific upload path
        const timestamp = Date.now();
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const s3Key = `users/${userId}/uploads/${timestamp}_${sanitizedFilename}`;
        // Generate presigned URL for S3 PUT operation
        const command = new client_s3_1.PutObjectCommand({
            Bucket: config.S3_BUCKET,
            Key: s3Key,
            ContentType: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            // Tagging removed for simple presigned URL
        });
        const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, {
            expiresIn: PRESIGNED_URL_EXPIRATION
        });
        console.log(`Generated presigned URL for user ${userId}: ${s3Key}`);
        // Get user profile for email notification (optional - non-blocking)
        getUserProfile(userId).then(profile => {
            if (profile?.notificationPreferences?.emailOnUpload && profile.email) {
                sendUploadInitiatedEmail(profile.email, profile.displayName || 'Trader', filename)
                    .catch(err => {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                    console.error('Failed to send upload notification email:', errorMessage, err);
                });
            }
        }).catch(err => {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            console.error('Failed to get user profile:', errorMessage, err);
        });
        // Return presigned URL to frontend
        return createResponse(200, {
            uploadUrl: presignedUrl,
            s3Key: s3Key,
            bucket: config.S3_BUCKET,
            expiresIn: PRESIGNED_URL_EXPIRATION,
            instructions: 'Use PUT method to upload file to the provided URL'
        });
    }
    catch (error) {
        console.error('Error generating presigned URL:', error);
        return createResponse(500, {
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
/**
 * Get user profile from DynamoDB
 */
async function getUserProfile(userId) {
    try {
        const command = new client_dynamodb_1.GetItemCommand({
            TableName: config.USER_PROFILES_TABLE,
            Key: {
                userId: { S: userId }
            }
        });
        const response = await dynamoClient.send(command);
        if (!response.Item) {
            console.warn(`User profile not found for userId: ${userId}`);
            return null;
        }
        return (0, util_dynamodb_1.unmarshall)(response.Item);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error fetching user profile:', errorMessage, error);
        return null;
    }
}
/**
 * Send email notification when upload is initiated
 */
async function sendUploadInitiatedEmail(toEmail, displayName, filename) {
    const command = new client_ses_1.SendEmailCommand({
        Source: NOTIFICATION_EMAIL_FROM,
        Destination: {
            ToAddresses: [toEmail]
        },
        Message: {
            Subject: {
                Data: 'Upload Started - TiltedTrades'
            },
            Body: {
                Html: {
                    Data: `
            <html>
              <body>
                <h2>Upload Initiated</h2>
                <p>Hi ${displayName},</p>
                <p>Your trading data file <strong>${filename}</strong> has been uploaded and is being processed.</p>
                <p>You'll receive another email once processing is complete.</p>
                <br/>
                <p>Best regards,<br/>TiltedTrades Team</p>
              </body>
            </html>
          `
                },
                Text: {
                    Data: `Upload Initiated\n\nHi ${displayName},\n\nYour trading data file "${filename}" has been uploaded and is being processed.\n\nYou'll receive another email once processing is complete.\n\nBest regards,\nTiltedTrades Team`
                }
            }
        }
    });
    await sesClient.send(command);
    console.log(`Sent upload notification email to ${toEmail}`);
}
/**
 * Create API Gateway response
 */
function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Configure for your domain in production
            'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify(body)
    };
}
