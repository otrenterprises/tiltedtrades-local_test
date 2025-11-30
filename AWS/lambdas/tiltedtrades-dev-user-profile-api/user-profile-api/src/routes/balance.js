"use strict";
/**
 * Balance Routes Handler
 *
 * Handles API requests for user balance entries and recurring fee templates.
 * Endpoints:
 *   GET    /balance            - Get all entries + generated recurring fees
 *   POST   /balance            - Create a new entry
 *   PUT    /balance/:entryId   - Update an entry
 *   DELETE /balance/:entryId   - Delete an entry
 *   GET    /balance/templates  - Get all recurring fee templates
 *   POST   /balance/templates  - Create a recurring fee template
 *   PUT    /balance/templates/:templateId - Update a template
 *   DELETE /balance/templates/:templateId - Delete a template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBalanceRoutes = handleBalanceRoutes;

const { DynamoDBClient, QueryCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { randomUUID } = require("crypto");
const { getConfig } = require("@tiltedtrades/config");

const config = getConfig();
const dynamoClient = new DynamoDBClient({ region: config.REGION });
const lambdaClient = new LambdaClient({ region: config.REGION });

/**
 * Main balance routes handler
 */
async function handleBalanceRoutes(event, userId, headers) {
    const path = event.path;
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : null;

    try {
        // Template routes
        if (path.includes('/balance/templates')) {
            const templateId = extractTemplateId(path);

            if (method === 'GET' && !templateId) {
                return await getTemplates(userId, headers);
            }
            if (method === 'POST' && !templateId) {
                return await createTemplate(userId, body, headers);
            }
            if (method === 'PUT' && templateId) {
                return await updateTemplate(userId, templateId, body, headers);
            }
            if (method === 'DELETE' && templateId) {
                return await deleteTemplate(userId, templateId, headers);
            }
        }

        // Entry routes
        const entryId = extractEntryId(path);

        if (method === 'GET' && !entryId) {
            return await getBalance(userId, headers);
        }
        if (method === 'POST' && !entryId) {
            return await createEntry(userId, body, headers);
        }
        if (method === 'PUT' && entryId) {
            return await updateEntry(userId, entryId, body, headers);
        }
        if (method === 'DELETE' && entryId) {
            return await deleteEntry(userId, entryId, headers);
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Balance endpoint not found' })
        };
    } catch (error) {
        console.error('Balance route error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', message: error.message })
        };
    }
}

/**
 * Extract entryId from path: /api/users/:userId/balance/:entryId
 */
function extractEntryId(path) {
    // Match patterns like /balance/ENTRY#... but not /balance/templates
    const match = path.match(/\/balance\/([^\/]+)$/);
    if (match && match[1] !== 'templates') {
        return decodeURIComponent(match[1]);
    }
    return null;
}

/**
 * Extract templateId from path: /api/users/:userId/balance/templates/:templateId
 */
function extractTemplateId(path) {
    const match = path.match(/\/balance\/templates\/([^\/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * GET /balance - Get all entries including generated recurring fees
 */
async function getBalance(userId, headers) {
    // Get all entries
    const entriesResult = await dynamoClient.send(new QueryCommand({
        TableName: config.USER_BALANCE_TABLE,
        KeyConditionExpression: 'userId = :userId AND begins_with(entryId, :prefix)',
        ExpressionAttributeValues: marshall({
            ':userId': userId,
            ':prefix': 'ENTRY#'
        })
    }));

    // Get all templates
    const templatesResult = await dynamoClient.send(new QueryCommand({
        TableName: config.USER_BALANCE_TABLE,
        KeyConditionExpression: 'userId = :userId AND begins_with(entryId, :prefix)',
        ExpressionAttributeValues: marshall({
            ':userId': userId,
            ':prefix': 'TEMPLATE#'
        })
    }));

    const entries = (entriesResult.Items || []).map(item => unmarshall(item));
    const templates = (templatesResult.Items || []).map(item => unmarshall(item));

    // Generate recurring fee entries from templates
    const generatedEntries = generateRecurringFees(templates, entries);

    // Combine entries and generated fees, sort by date
    const allEntries = [...entries, ...generatedEntries].sort((a, b) =>
        a.date.localeCompare(b.date)
    );

    // Calculate running balance
    let runningBalance = 0;
    const entriesWithBalance = allEntries.map(entry => {
        const signedAmount = getSignedAmount(entry.type, entry.amount);
        runningBalance += signedAmount;
        return {
            ...entry,
            balance: runningBalance
        };
    });

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            entries: entriesWithBalance,
            templates: templates,
            runningBalance: runningBalance
        })
    };
}

/**
 * Generate recurring fee entries from templates
 */
function generateRecurringFees(templates, existingEntries) {
    const generated = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Include today

    // Create a set of existing generated entry IDs for deduplication
    const existingIds = new Set(existingEntries.map(e => e.entryId));

    for (const template of templates) {
        if (!template.dayOfMonth) continue;

        const startDate = new Date(template.date + 'T00:00:00');
        const endDate = template.endDate ? new Date(template.endDate + 'T23:59:59') : today;

        // Generate for each month from start to end
        let currentDate = new Date(startDate);

        while (currentDate <= endDate && currentDate <= today) {
            // Set to the day of month (cap at month's max days)
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            const dayOfMonth = Math.min(template.dayOfMonth, daysInMonth);
            currentDate.setDate(dayOfMonth);

            // Skip if before template start date
            if (currentDate < startDate) {
                currentDate.setMonth(currentDate.getMonth() + 1);
                currentDate.setDate(1);
                continue;
            }

            // Skip if after today
            if (currentDate > today) break;

            const dateStr = formatDate(currentDate);
            const generatedId = `ENTRY#GEN#${template.entryId.replace('TEMPLATE#', '')}#${dateStr}`;

            // Skip if already exists
            if (existingIds.has(generatedId)) {
                currentDate.setMonth(currentDate.getMonth() + 1);
                currentDate.setDate(1);
                continue;
            }

            generated.push({
                entryId: generatedId,
                userId: template.userId,
                type: template.type,
                amount: template.amount,
                date: dateStr,
                description: `${template.description} (Auto-generated)`,
                generatedFromTemplate: template.entryId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1);
            currentDate.setDate(1);
        }
    }

    return generated;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get signed amount based on entry type
 */
function getSignedAmount(type, amount) {
    const absAmount = Math.abs(amount);
    if (type === 'deposit') {
        return absAmount;
    }
    if (type === 'commission_adjustment') {
        // Commission adjustments can be positive (credit/rebate) or negative (additional cost)
        return amount;  // Preserve sign as provided
    }
    return -absAmount; // withdrawal or fee
}

/**
 * POST /balance - Create a new entry
 */
async function createEntry(userId, data, headers) {
    if (!data || !data.type || data.amount === undefined || !data.date) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'type, amount, and date are required' })
        };
    }

    const entryId = `ENTRY#${randomUUID()}`;
    const now = new Date().toISOString();

    // For commission_adjustment, preserve the sign; for others, store as positive
    const storedAmount = data.type === 'commission_adjustment'
        ? data.amount
        : Math.abs(data.amount);

    const entry = {
        userId,
        entryId,
        type: data.type,
        amount: storedAmount,
        date: data.date,
        description: data.description || '',
        createdAt: now,
        updatedAt: now
    };

    // Add commission metadata if this is a commission_adjustment
    if (data.type === 'commission_adjustment') {
        entry.commissionMeta = {};
        if (data.tradeCount !== undefined) entry.commissionMeta.tradeCount = data.tradeCount;
        if (data.contractCount !== undefined) entry.commissionMeta.contractCount = data.contractCount;
        if (data.startDate) entry.commissionMeta.startDate = data.startDate;
        if (data.endDate) entry.commissionMeta.endDate = data.endDate;
        if (data.symbol) entry.commissionMeta.symbol = data.symbol;
        // Only include commissionMeta if it has values
        if (Object.keys(entry.commissionMeta).length === 0) {
            delete entry.commissionMeta;
        }
    }

    await dynamoClient.send(new PutItemCommand({
        TableName: config.USER_BALANCE_TABLE,
        Item: marshall(entry, { removeUndefinedValues: true })
    }));

    // Trigger stats recalculation if this is a commission adjustment
    if (data.type === 'commission_adjustment') {
        await triggerStatsRecalculation(userId);
    }

    return {
        statusCode: 201,
        headers,
        body: JSON.stringify(entry)
    };
}

/**
 * PUT /balance/:entryId - Update an entry
 */
async function updateEntry(userId, entryId, data, headers) {
    if (!data) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Request body is required' })
        };
    }

    // Verify entry exists
    const existing = await dynamoClient.send(new GetItemCommand({
        TableName: config.USER_BALANCE_TABLE,
        Key: marshall({ userId, entryId })
    }));

    if (!existing.Item) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Entry not found' })
        };
    }

    const now = new Date().toISOString();
    const updateExpressions = ['#updatedAt = :updatedAt'];
    const expressionAttributeNames = { '#updatedAt': 'updatedAt' };
    const expressionAttributeValues = { ':updatedAt': now };

    const allowedFields = ['type', 'amount', 'date', 'description'];

    // Get the existing entry to check its type
    const existingEntry = unmarshall(existing.Item);
    const entryType = data.type || existingEntry.type;

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            updateExpressions.push(`#${field} = :${field}`);
            expressionAttributeNames[`#${field}`] = field;
            // For commission_adjustment, preserve the sign; for others, use absolute value
            if (field === 'amount') {
                expressionAttributeValues[`:${field}`] = entryType === 'commission_adjustment'
                    ? data[field]
                    : Math.abs(data[field]);
            } else {
                expressionAttributeValues[`:${field}`] = data[field];
            }
        }
    }

    // Handle commission metadata for commission_adjustment type
    if (entryType === 'commission_adjustment') {
        const hasMetadata = data.tradeCount !== undefined ||
            data.contractCount !== undefined ||
            data.startDate !== undefined ||
            data.endDate !== undefined ||
            data.symbol !== undefined;

        if (hasMetadata) {
            const commissionMeta = existingEntry.commissionMeta || {};
            if (data.tradeCount !== undefined) commissionMeta.tradeCount = data.tradeCount;
            if (data.contractCount !== undefined) commissionMeta.contractCount = data.contractCount;
            if (data.startDate !== undefined) commissionMeta.startDate = data.startDate;
            if (data.endDate !== undefined) commissionMeta.endDate = data.endDate;
            if (data.symbol !== undefined) commissionMeta.symbol = data.symbol;

            updateExpressions.push('#commissionMeta = :commissionMeta');
            expressionAttributeNames['#commissionMeta'] = 'commissionMeta';
            expressionAttributeValues[':commissionMeta'] = commissionMeta;
        }
    }

    const result = await dynamoClient.send(new UpdateItemCommand({
        TableName: config.USER_BALANCE_TABLE,
        Key: marshall({ userId, entryId }),
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        ReturnValues: 'ALL_NEW'
    }));

    // Trigger stats recalculation if this is a commission adjustment
    if (entryType === 'commission_adjustment') {
        await triggerStatsRecalculation(userId);
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(unmarshall(result.Attributes))
    };
}

/**
 * DELETE /balance/:entryId - Delete an entry
 */
async function deleteEntry(userId, entryId, headers) {
    // Verify entry exists
    const existing = await dynamoClient.send(new GetItemCommand({
        TableName: config.USER_BALANCE_TABLE,
        Key: marshall({ userId, entryId })
    }));

    if (!existing.Item) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Entry not found' })
        };
    }

    const existingEntry = unmarshall(existing.Item);

    await dynamoClient.send(new DeleteItemCommand({
        TableName: config.USER_BALANCE_TABLE,
        Key: marshall({ userId, entryId })
    }));

    // Trigger stats recalculation if this was a commission adjustment
    if (existingEntry.type === 'commission_adjustment') {
        await triggerStatsRecalculation(userId);
    }

    return {
        statusCode: 204,
        headers,
        body: ''
    };
}

/**
 * GET /balance/templates - Get all recurring fee templates
 */
async function getTemplates(userId, headers) {
    const result = await dynamoClient.send(new QueryCommand({
        TableName: config.USER_BALANCE_TABLE,
        KeyConditionExpression: 'userId = :userId AND begins_with(entryId, :prefix)',
        ExpressionAttributeValues: marshall({
            ':userId': userId,
            ':prefix': 'TEMPLATE#'
        })
    }));

    const templates = (result.Items || []).map(item => unmarshall(item));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ templates })
    };
}

/**
 * POST /balance/templates - Create a recurring fee template
 */
async function createTemplate(userId, data, headers) {
    if (!data || !data.type || data.amount === undefined || !data.date || !data.dayOfMonth) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'type, amount, date, and dayOfMonth are required' })
        };
    }

    // Validate dayOfMonth (1-28 to avoid month-end issues)
    if (data.dayOfMonth < 1 || data.dayOfMonth > 28) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'dayOfMonth must be between 1 and 28' })
        };
    }

    const entryId = `TEMPLATE#${randomUUID()}`;
    const now = new Date().toISOString();

    const template = {
        userId,
        entryId,
        type: data.type,
        amount: Math.abs(data.amount),
        date: data.date,
        description: data.description || '',
        dayOfMonth: data.dayOfMonth,
        endDate: data.endDate || null,
        createdAt: now,
        updatedAt: now
    };

    await dynamoClient.send(new PutItemCommand({
        TableName: config.USER_BALANCE_TABLE,
        Item: marshall(template, { removeUndefinedValues: true })
    }));

    return {
        statusCode: 201,
        headers,
        body: JSON.stringify(template)
    };
}

/**
 * PUT /balance/templates/:templateId - Update a template
 */
async function updateTemplate(userId, templateId, data, headers) {
    if (!data) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Request body is required' })
        };
    }

    // Verify template exists
    const existing = await dynamoClient.send(new GetItemCommand({
        TableName: config.USER_BALANCE_TABLE,
        Key: marshall({ userId, entryId: templateId })
    }));

    if (!existing.Item) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Template not found' })
        };
    }

    // Validate dayOfMonth if provided
    if (data.dayOfMonth !== undefined && (data.dayOfMonth < 1 || data.dayOfMonth > 28)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'dayOfMonth must be between 1 and 28' })
        };
    }

    const now = new Date().toISOString();
    const updateExpressions = ['#updatedAt = :updatedAt'];
    const expressionAttributeNames = { '#updatedAt': 'updatedAt' };
    const expressionAttributeValues = { ':updatedAt': now };

    const allowedFields = ['type', 'amount', 'date', 'description', 'dayOfMonth', 'endDate'];

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            updateExpressions.push(`#${field} = :${field}`);
            expressionAttributeNames[`#${field}`] = field;
            expressionAttributeValues[`:${field}`] = field === 'amount' ? Math.abs(data[field]) : data[field];
        }
    }

    const result = await dynamoClient.send(new UpdateItemCommand({
        TableName: config.USER_BALANCE_TABLE,
        Key: marshall({ userId, entryId: templateId }),
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        ReturnValues: 'ALL_NEW'
    }));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(unmarshall(result.Attributes))
    };
}

/**
 * DELETE /balance/templates/:templateId - Delete a template
 */
async function deleteTemplate(userId, templateId, headers) {
    // Verify template exists
    const existing = await dynamoClient.send(new GetItemCommand({
        TableName: config.USER_BALANCE_TABLE,
        Key: marshall({ userId, entryId: templateId })
    }));

    if (!existing.Item) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Template not found' })
        };
    }

    await dynamoClient.send(new DeleteItemCommand({
        TableName: config.USER_BALANCE_TABLE,
        Key: marshall({ userId, entryId: templateId })
    }));

    return {
        statusCode: 204,
        headers,
        body: ''
    };
}

/**
 * Trigger stats recalculation for a user (async invocation)
 */
async function triggerStatsRecalculation(userId) {
    try {
        const statsCalcFunctionName = `tiltedtrades-${config.ENVIRONMENT}-stats-calculator`;
        console.log(`Triggering stats recalculation for user ${userId} via ${statsCalcFunctionName}`);

        const command = new InvokeCommand({
            FunctionName: statsCalcFunctionName,
            InvocationType: 'Event', // Async invocation
            Payload: JSON.stringify({ userId })
        });

        await lambdaClient.send(command);
        console.log(`Stats recalculation triggered successfully for user ${userId}`);
    } catch (error) {
        // Log error but don't fail the balance operation
        console.error(`Failed to trigger stats recalculation for ${userId}:`, error.message);
    }
}
