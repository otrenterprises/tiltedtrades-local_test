import boto3
import logging
import traceback
from typing import Dict, Any, List
from utils.config import Config
from models.trading_execution import TradingExecution

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb', region_name=Config.REGION)

def write_to_dynamodb(json_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Writes JSON data to the TradingExecutions DynamoDB table.
    
    This handler:
    1. Takes JSON-formatted data from the JSON conversion handler
    2. Uses the TradingExecution model to convert to DynamoDB format
    3. Writes items to the TradingExecutions table
    
    Args:
        json_data (list): List of JSON items to write to DynamoDB
        
    Returns:
        dict: Result with success/failure status and statistics
    """
    try:
        # Log the start of the operation
        logger.info(f"Starting DynamoDB write operation")
        logger.info(f"Items to process: {len(json_data)}")
        
        # Get the table
        table = dynamodb.Table(Config.TRADING_EXECUTIONS_TABLE)
        logger.info(f"Using DynamoDB table: {Config.TRADING_EXECUTIONS_TABLE}")
        
        # Initialize counters
        items_written = 0
        items_failed = 0
        
        # Process in batches to improve performance
        with table.batch_writer() as batch:
            for json_item in json_data:
                try:
                    # Convert JSON item to TradingExecution model
                    execution = TradingExecution.from_json_item(json_item)
                    
                    # Convert to DynamoDB format
                    item = execution.to_dynamodb_dict()
                    
                    # Write to DynamoDB
                    batch.put_item(Item=item)
                    items_written += 1
                    
                    # Log progress for large batches
                    if items_written % 50 == 0:
                        logger.info(f"Processed {items_written} items")
                        
                except Exception as item_error:
                    items_failed += 1
                    logger.error(f"Error writing item to DynamoDB: {str(item_error)}")
                    # Continue with other items
        
        # Log completion
        logger.info(f"DynamoDB write operation complete")
        logger.info(f"Items written: {items_written}")
        logger.info(f"Items failed: {items_failed}")
        
        # Return success or partial success
        if items_failed == 0:
            return {
                'success': True,
                'message': f"Successfully wrote {items_written} items to DynamoDB",
                'items_written': items_written,
                'items_updated': 0
            }
        elif items_written > 0:
            return {
                'success': True,
                'message': f"Partially wrote data to DynamoDB. Written: {items_written}, Failed: {items_failed}",
                'items_written': items_written,
                'items_updated': 0,
                'items_failed': items_failed
            }
        else:
            return {
                'success': False,
                'message': f"Failed to write any items to DynamoDB. Errors: {items_failed}",
                'items_failed': items_failed
            }
    
    except Exception as e:
        error_msg = f"Error writing to DynamoDB: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'message': error_msg
        }