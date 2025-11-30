import logging
import traceback
import pandas as pd
from typing import Dict, Any, List
from utils.config import Config

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def transform_data(file_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transforms Excel data for business use.
    
    This handler:
    1. Filters rows based on "Fill" status in Orders_Transactions_Status
    2. Selects only the required columns
    3. Performs any additional data transformations needed
    
    Args:
        file_data (dict): The validated file data containing excel_data
        
    Returns:
        dict: Transformation result with success/failure status and transformed data
    """
    try:
        # Log the start of the operation
        logger.info(f"Starting data transformation")
        logger.info(f"Source file: {file_data.get('key')}")
        
        # Extract DataFrame
        df = file_data.get('excel_data')
        
        if df is None or len(df) == 0:
            return {
                'success': False,
                'message': 'No data available for transformation'
            }
        
        # Record initial row count for reporting
        initial_row_count = len(df)
        logger.info(f"Initial row count: {initial_row_count}")
        
        # Step 1: Filter rows based on "Fill" status
        if Config.ORDER_STATUS_COLUMN not in df.columns:
            error_msg = f"Required column '{Config.ORDER_STATUS_COLUMN}' not found for filtering"
            logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
        
        # Filter rows to keep only those with "Fill" in the Order_Status column
        df_filtered = df[df[Config.ORDER_STATUS_COLUMN].str.contains(Config.ORDER_STATUS_FILTER, case=False, na=False)]
        
        # Record filtering metrics
        filtered_row_count = len(df_filtered)
        removed_rows = initial_row_count - filtered_row_count
        
        logger.info(f"Filtered data: Kept {filtered_row_count} rows with '{Config.ORDER_STATUS_FILTER}' status")
        logger.info(f"Removed {removed_rows} rows that did not contain '{Config.ORDER_STATUS_FILTER}'")
        
        # Step 2: Select only required columns
        # If a column is missing, it will be gracefully handled
        available_columns = [col for col in Config.REQUIRED_COLUMNS if col in df_filtered.columns]
        missing_columns = [col for col in Config.REQUIRED_COLUMNS if col not in df_filtered.columns]
        
        if missing_columns:
            logger.warning(f"Missing columns that were expected: {missing_columns}")
        
        # Keep only the available required columns
        df_transformed = df_filtered[available_columns]
        
        logger.info(f"Column selection: Kept {len(available_columns)} columns")
        logger.info(f"Removed {len(df_filtered.columns) - len(available_columns)} unnecessary columns")
        
        # Step 3: Any additional transformations could be applied here
        # For example, formatting, calculations, etc.
        
        # Create a copy of the file_data dict with the transformed DataFrame
        transformed_data = {
            'bucket': file_data.get('bucket'),
            'key': file_data.get('key'),
            'userId': file_data.get('userId'),  # Pass through userId from main handler
            'excel_data': df_transformed,
            'file_metadata': {
                'original_row_count': initial_row_count,
                'transformed_row_count': len(df_transformed),
                'rows_removed': removed_rows,
                'original_column_count': len(df.columns),
                'transformed_column_count': len(df_transformed.columns),
                'columns_removed': len(df.columns) - len(df_transformed.columns)
            }
        }
        
        logger.info(f"Transformation complete: {len(df_transformed)} rows, {len(df_transformed.columns)} columns")
        
        return {
            'success': True,
            'message': 'Data transformed successfully',
            'data': transformed_data,
            'rows_processed': len(df_transformed),
            'rows_filtered': removed_rows
        }
    
    except Exception as e:
        error_msg = f"Error transforming data: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'message': error_msg
        }