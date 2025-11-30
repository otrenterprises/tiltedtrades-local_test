import boto3
import logging
import traceback
from typing import Dict, Any
from utils.config import Config
from models.original_order import OriginalOrder, convert_dataframe_to_dynamodb_items, batch_write_items

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb', region_name=Config.REGION)

def preserve_original_data(file_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Preserves original data in the OriginalOrders DynamoDB table.
    
    This handler:
    1. Takes the original Excel data after validation
    2. Uses the OriginalOrder model to convert data to DynamoDB format
    3. Writes the data to the OriginalOrders DynamoDB table
    
    Args:
        file_data (dict): The validated file data containing excel_data
        
    Returns:
        dict: Result with success/failure status
    """
    try:
        # Log the start of the operation
        logger.info(f"Starting original data preservation")
        logger.info(f"Source file: {file_data.get('key')}")
        logger.info(f"Rows to process: {file_data.get('file_metadata', {}).get('row_count', 0)}")
        
        # Get the table
        table = dynamodb.Table(Config.ORIGINAL_TABLE)
        logger.info(f"Using DynamoDB table: {Config.ORIGINAL_TABLE}")
        
        # Extract the DataFrame
        df = file_data.get('excel_data')
        
        if df is None or len(df) == 0:
            return {
                'success': False,
                'message': 'No data available for preservation'
            }
        
        # Use the OriginalOrder model to convert the DataFrame to DynamoDB items
        logger.info(f"Converting {len(df)} rows to DynamoDB compatible format")
        items = convert_dataframe_to_dynamodb_items(df)

        # MODIFICATION 2: Add userId to all items
        user_id = file_data.get('userId')
        if not user_id:
            logger.error("userId not found in file_data")
            return {
                'success': False,
                'message': 'userId is required but was not provided'
            }

        logger.info(f"Adding userId '{user_id}' to {len(items)} items")
        for item in items:
            item['userId'] = user_id

        if not items:
            logger.warning("No valid items found for DynamoDB storage")
            return {
                'success': False,
                'message': 'No valid items found for DynamoDB storage'
            }
        
        logger.info(f"Prepared {len(items)} items for DynamoDB")
        
        # Write the items to DynamoDB using the model's batch write function
        result = batch_write_items(table, items)
        
        items_written = result.get('items_written', 0)
        items_failed = result.get('items_failed', 0)
        
        # Log completion
        logger.info(f"Original data preservation complete")
        logger.info(f"Items written: {items_written}")
        logger.info(f"Items failed: {items_failed}")
        
        # Return success or partial success
        if items_failed == 0:
            return {
                'success': True,
                'message': f"Successfully preserved {items_written} items in OriginalOrders table",
                'items_processed': items_written
            }
        elif items_written > 0:
            return {
                'success': True,
                'message': f"Partially preserved original data. Written: {items_written}, Failed: {items_failed}",
                'items_processed': items_written,
                'items_failed': items_failed
            }
        else:
            return {
                'success': False,
                'message': f"Failed to preserve any original data items. Errors: {items_failed}",
                'items_failed': items_failed
            }
    
    except Exception as e:
        error_msg = f"Error preserving original data: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'message': error_msg
        }