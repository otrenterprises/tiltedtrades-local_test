import json
import logging
import traceback
import boto3
import os
from datetime import datetime

# Import handlers
from handlers.validation import validate_file
from handlers.s3_archive import save_original_json_to_s3, save_processed_json_to_s3
from handlers.transformation import transform_data
from handlers.json_conversion import convert_to_json
from handlers.dynamodb import write_to_dynamodb
from handlers.monitoring import log_success, log_metrics  # Email notifications removed

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients outside the handler for reuse
s3_client = boto3.client('s3', region_name=os.environ.get('REGION', 'us-east-1'))
dynamodb_resource = boto3.resource('dynamodb', region_name=os.environ.get('REGION', 'us-east-1'))
ses_client = boto3.client('ses', region_name=os.environ.get('REGION', 'us-east-1'))
lambda_client = boto3.client('lambda', region_name=os.environ.get('REGION', 'us-east-1'))

# Load symbol conversion table at module initialization
symbol_conversion_path = os.path.join(os.path.dirname(__file__), 'data', 'symbol_conversion.json')
SYMBOL_CONVERSION = {}

try:
    with open(symbol_conversion_path, 'r') as f:
        SYMBOL_CONVERSION = json.load(f)
    logger.info(f"Loaded symbol conversion table with {len(SYMBOL_CONVERSION)} entries")
except Exception as e:
    logger.warning(f"Could not load symbol conversion table: {str(e)}")
    # Continue without the conversion table - handlers will use empty dict

# Load tick values table at module initialization
tick_values_path = os.path.join(os.path.dirname(__file__), 'data', 'tick-values.json')
TICK_VALUES = {}

try:
    with open(tick_values_path, 'r') as f:
        TICK_VALUES = json.load(f)
    logger.info(f"Loaded tick values table with {len(TICK_VALUES)} entries")
except Exception as e:
    logger.warning(f"Could not load tick values table: {str(e)}")
    # Continue without the tick values table - handlers will use empty dict

# Load commissions table at module initialization
commissions_path = os.path.join(os.path.dirname(__file__), 'data', 'commissions.json')
COMMISSIONS = {}

try:
    with open(commissions_path, 'r') as f:
        COMMISSIONS = json.load(f)
    logger.info(f"Loaded commissions table")
except Exception as e:
    logger.warning(f"Could not load commissions table: {str(e)}")
    # Continue without the commissions table - handlers will use empty dict

def extract_user_id_from_event(event: dict) -> str:
    """
    Extract userId from S3 event path.

    Expected S3 path format: users/{userId}/uploads/filename.xlsx

    Args:
        event (dict): The S3 event data

    Returns:
        str: The extracted userId (Cognito sub UUID)

    Raises:
        ValueError: If userId cannot be extracted from path
    """
    try:
        # Get S3 key from event
        if 'Records' not in event or len(event['Records']) == 0:
            raise ValueError("No S3 records found in event")

        s3_key = event['Records'][0]['s3']['object']['key']
        logger.info(f"Processing S3 key: {s3_key}")

        # Parse path: users/{userId}/uploads/filename.xlsx
        if not s3_key.startswith('users/'):
            raise ValueError(f"Invalid S3 path format. Expected 'users/{{userId}}/...', got '{s3_key}'")

        parts = s3_key.split('/')
        if len(parts) < 3:
            raise ValueError(f"Invalid S3 path structure. Expected at least 3 parts, got {len(parts)}")

        user_id = parts[1]  # Extract userId from path

        # Validate userId format (should be Cognito sub - UUID format)
        if not user_id or len(user_id) < 10:
            raise ValueError(f"Invalid userId extracted: '{user_id}'")

        logger.info(f"Extracted userId: {user_id}")
        return user_id

    except Exception as e:
        error_msg = f"Failed to extract userId from event: {str(e)}"
        logger.error(error_msg)
        raise ValueError(error_msg)

def lambda_handler(event, context):
    """
    Main Lambda handler function that orchestrates the entire workflow.
    
    This handler processes Excel files uploaded to S3, validates them,
    preserves the original data, transforms the data, and loads it into
    DynamoDB tables. It also handles error notifications via email.
    
    Args:
        event (dict): The event data from the S3 trigger
        context (LambdaContext): AWS Lambda context object
        
    Returns:
        dict: Response with statusCode and body
    """
    start_time = datetime.now()
    execution_id = context.aws_request_id
    
    logger.info(f"=== LAMBDA EXECUTION STARTED (ID: {execution_id}) ===")
    logger.info(f"Event: {json.dumps(event)}")

    # Environment variables are accessed directly where needed
    # No separate config dictionary that duplicates environment variables

    try:
        # MODIFICATION 1: Extract userId from S3 event path
        try:
            user_id = extract_user_id_from_event(event)
            logger.info(f"Processing upload for userId: {user_id}")
        except ValueError as e:
            error_message = str(e)
            logger.error(error_message)
            # Email notifications removed - users should check upload status via frontend
            return format_response({
                'statusCode': 400,
                'body': {
                    'execution_id': execution_id,
                    'start_time': start_time.isoformat(),
                    'error': 'Invalid S3 path format',
                    'final_status': 'failed'
                }
            })

        # Create a response object to track the process
        response = {
            'statusCode': 200,
            'body': {
                'execution_id': execution_id,
                'user_id': user_id,  # Add userId to response
                'start_time': start_time.isoformat(),
                'steps': []
            }
        }
        
        # Step 1: Validate the Excel file
        logger.info("Starting file validation")
        validation_result = validate_file(event, SYMBOL_CONVERSION)
        response['body']['steps'].append({
            'name': 'validation',
            'status': 'success' if validation_result['success'] else 'failed',
            'message': validation_result['message']
        })
        
        if not validation_result['success']:
            error_message = f"Validation failed: {validation_result['message']}"
            logger.error(error_message)
            # Email notifications removed - users should check upload status via frontend
            response['statusCode'] = 400
            response['body']['error'] = error_message
            return format_response(response)

        file_data = validation_result['data']
        file_data['userId'] = user_id  # ADD userId to file_data

        # Step 2: Archive original data to S3 as JSON
        logger.info("Starting S3 archival of original data")
        archive_result = save_original_json_to_s3(file_data)
        response['body']['steps'].append({
            'name': 's3_archive_original',
            'status': 'success' if archive_result['success'] else 'failed',
            'message': archive_result['message'],
            'rows_archived': archive_result.get('rows_archived', 0),
            's3_key': archive_result.get('s3_key', '')
        })

        # Note: S3 archival failure is non-fatal - we continue processing
        if not archive_result['success']:
            logger.warning(f"S3 archival failed (non-fatal): {archive_result['message']}")
            # Continue processing even if archive fails
        
        # Step 3: Transform the data
        logger.info("Starting data transformation")
        transformation_result = transform_data(file_data)
        response['body']['steps'].append({
            'name': 'transformation',
            'status': 'success' if transformation_result['success'] else 'failed',
            'message': transformation_result['message'],
            'rows_processed': transformation_result.get('rows_processed', 0),
            'rows_filtered': transformation_result.get('rows_filtered', 0)
        })
        
        if not transformation_result['success']:
            error_message = f"Data transformation failed: {transformation_result['message']}"
            logger.error(error_message)
            # Email notifications removed - users should check upload status via frontend
            response['statusCode'] = 500
            response['body']['error'] = error_message
            return format_response(response)
        
        transformed_data = transformation_result['data']
        
        # Step 4: Convert to JSON
        logger.info("Starting JSON conversion")
        json_result = convert_to_json(transformed_data, SYMBOL_CONVERSION, TICK_VALUES, COMMISSIONS)
        response['body']['steps'].append({
            'name': 'json_conversion',
            'status': 'success' if json_result['success'] else 'failed',
            'message': json_result['message'],
            'items_converted': json_result.get('items_converted', 0)
        })

        if not json_result['success']:
            error_message = f"JSON conversion failed: {json_result['message']}"
            logger.error(error_message)
            # Email notifications removed - users should check upload status via frontend
            response['statusCode'] = 500
            response['body']['error'] = error_message
            return format_response(response)

        json_data = json_result['data']

        # Step 4a: Archive processed data to S3 as JSON
        logger.info("Starting S3 archival of processed data")
        processed_archive_result = save_processed_json_to_s3(file_data, json_data)
        response['body']['steps'].append({
            'name': 's3_archive_processed',
            'status': 'success' if processed_archive_result['success'] else 'failed',
            'message': processed_archive_result['message'],
            'executions_archived': processed_archive_result.get('executions_archived', 0),
            's3_key': processed_archive_result.get('s3_key', '')
        })

        # Note: S3 archival failure is non-fatal - we continue processing
        if not processed_archive_result['success']:
            logger.warning(f"Processed data S3 archival failed (non-fatal): {processed_archive_result['message']}")
            # Continue processing even if archive fails

        # Step 5: Write to DynamoDB
        logger.info("Starting DynamoDB write operation")
        db_result = write_to_dynamodb(json_data)
        response['body']['steps'].append({
            'name': 'dynamodb_write',
            'status': 'success' if db_result['success'] else 'failed',
            'message': db_result['message'],
            'items_written': db_result.get('items_written', 0),
            'items_updated': db_result.get('items_updated', 0)
        })
        
        if not db_result['success']:
            error_message = f"DynamoDB write failed: {db_result['message']}"
            logger.error(error_message)
            # Email notifications removed - users should check upload status via frontend
            response['statusCode'] = 500
            response['body']['error'] = error_message
            return format_response(response)

        # Step 6: Invoke trading-data-processor Lambda for FIFO matching
        logger.info("Invoking trading-data-processor Lambda for trade matching")
        try:
            trading_processor_function = os.environ.get(
                'TRADING_DATA_PROCESSOR_FUNCTION',
                'tiltedtrades-dev-trading-data-processor'
            )

            invoke_payload = {
                'trigger': 'upload-complete',
                'userId': user_id,
                'executionsWritten': db_result.get('items_written', 0),
                'sourceFile': file_data.get('key', '')
            }

            invoke_response = lambda_client.invoke(
                FunctionName=trading_processor_function,
                InvocationType='Event',  # Async invocation - don't wait for response
                Payload=json.dumps(invoke_payload)
            )

            invoke_status = invoke_response.get('StatusCode', 0)
            logger.info(f"trading-data-processor invoked successfully (StatusCode: {invoke_status})")

            response['body']['steps'].append({
                'name': 'trading_processor_invoke',
                'status': 'success',
                'message': f'Invoked trading-data-processor for userId {user_id}',
                'async_status_code': invoke_status
            })
        except Exception as invoke_error:
            # Log but don't fail - the data is already in DynamoDB
            # The nightly stats-calculator will pick it up if this fails
            logger.warning(f"Failed to invoke trading-data-processor (non-fatal): {str(invoke_error)}")
            response['body']['steps'].append({
                'name': 'trading_processor_invoke',
                'status': 'warning',
                'message': f'Failed to invoke trading-data-processor: {str(invoke_error)}'
            })

        # Calculate execution time
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()
        
        # Add execution stats to response
        response['body']['end_time'] = end_time.isoformat()
        response['body']['execution_time_seconds'] = execution_time
        response['body']['final_status'] = 'success'
        
        # Log success metrics
        log_success(response['body'])
        log_metrics(execution_time, response['body']['steps'])

        # Email notifications removed - users should check upload status via frontend
        # Success statistics logged to CloudWatch for monitoring
        
        logger.info(f"=== LAMBDA EXECUTION COMPLETED SUCCESSFULLY (ID: {execution_id}) ===")
        logger.info(f"Total execution time: {execution_time} seconds")
        logger.info(f"Items processed: {db_result.get('items_written', 0)}")
        
        return format_response(response)
        
    except Exception as e:
        # Handle any unexpected exceptions
        error_message = str(e)
        stack_trace = traceback.format_exc()
        logger.error(f"Unexpected error: {error_message}")
        logger.error(f"Stack trace: {stack_trace}")

        # Email notifications removed - errors logged to CloudWatch for monitoring
        
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()
        
        logger.info(f"=== LAMBDA EXECUTION FAILED (ID: {execution_id}) ===")
        logger.info(f"Total execution time before failure: {execution_time} seconds")
        
        return format_response({
            'statusCode': 500,
            'body': {
                'execution_id': execution_id,
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'execution_time_seconds': execution_time,
                'error': error_message,
                'final_status': 'failed'
            }
        })

def format_response(response):
    """
    Format the response to ensure the body is a JSON string
    
    Args:
        response (dict): The response object
    
    Returns:
        dict: Formatted response with JSON string body
    """
    if isinstance(response['body'], dict):
        response['body'] = json.dumps(response['body'])
    return response