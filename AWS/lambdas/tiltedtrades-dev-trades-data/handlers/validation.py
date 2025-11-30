import json
import boto3
import pandas as pd
import io
import logging
import traceback
from typing import Dict, Any, List, Optional
from utils.config import Config
from models.excel_schema import ORDERS_SCHEMA, validate_excel_file

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize S3 client with region
s3_client = boto3.client('s3', region_name=Config.REGION)

def validate_file(event: Dict[str, Any], symbol_conversion: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Validates Excel files uploaded to S3.
    
    This handler validates that:
    1. The file is in the correct bucket and folder
    2. The Excel file contains the required sheet
    3. The sheet contains all required columns and valid data types
    
    Args:
        event (dict): The S3 event notification
        symbol_conversion (dict, optional): Symbol conversion lookup table
        
    Returns:
        dict: Validation result with success/failure status and data if successful
    """
    try:
        # Extract bucket and key from the S3 event
        bucket = event['Records'][0]['s3']['bucket']['name']
        key = event['Records'][0]['s3']['object']['key']
        
        logger.info(f"Processing file {key} from bucket {bucket}")
        logger.info(f"Using configuration - Region: {Config.REGION}, Expected Bucket: {Config.SOURCE_BUCKET}, Folder: {Config.UPLOAD_FOLDER}")
        
        # Verify bucket name matches expected bucket
        if bucket != Config.SOURCE_BUCKET:
            error_msg = f"Error: Incorrect bucket name. Expected {Config.SOURCE_BUCKET}, got {bucket}"
            logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
        
        # Verify key path starts with the specified folder path
        if not key.startswith(Config.UPLOAD_FOLDER):
            error_msg = f"Error: File was not uploaded to {Config.UPLOAD_FOLDER} folder. Path: {key}"
            logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
        
        # Log required schema information
        logger.info(f"Required sheet name: {ORDERS_SCHEMA.sheet_name}")
        logger.info(f"Required columns: {ORDERS_SCHEMA.get_required_columns()}")
        
        # Get the file from S3
        response = s3_client.get_object(Bucket=bucket, Key=key)
        file_content = response['Body'].read()
        
        # Load the Excel file into a pandas ExcelFile object
        logger.info(f"Successfully retrieved file from S3, size: {len(file_content)} bytes")
        excel_file = pd.ExcelFile(io.BytesIO(file_content))
        
        # Log available sheets
        logger.info(f"Available sheets in workbook: {excel_file.sheet_names}")
        
        # Check if the required sheet exists
        if ORDERS_SCHEMA.sheet_name not in excel_file.sheet_names:
            error_msg = f'Error: Required sheet "{ORDERS_SCHEMA.sheet_name}" not found in the Excel file. Available sheets: {", ".join(excel_file.sheet_names)}'
            logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
        
        # Read the sheet into a DataFrame
        logger.info(f"Found required sheet '{ORDERS_SCHEMA.sheet_name}', reading data")
        df = pd.read_excel(excel_file, sheet_name=ORDERS_SCHEMA.sheet_name)
        
        # Log available columns
        logger.info(f"Available columns: {list(df.columns)}")
        logger.info(f"Number of rows in file: {len(df)}")
        
        # Validate the DataFrame against our schema
        validation_result = validate_excel_file(df)
        
        if not validation_result['valid']:
            # Construct error message detailing the validation failures
            error_parts = []
            
            if validation_result['missing_columns']:
                error_parts.append(f"Missing required columns: {', '.join(validation_result['missing_columns'])}")
            
            if validation_result['type_errors']:
                error_samples = validation_result['type_errors'][:5]  # Limit to first 5 errors
                error_details = "; ".join([
                    f"Column '{e['column']}' row {e['row']}: got '{e['value']}', expected {e['expected_type']}"
                    for e in error_samples
                ])
                error_parts.append(f"Data type errors: {error_details}")
                
                if len(validation_result['type_errors']) > 5:
                    error_parts.append(f"...and {len(validation_result['type_errors']) - 5} more errors")
            
            error_msg = "Excel validation failed. " + " ".join(error_parts)
            logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
        
        # Create file data object to return
        file_data = {
            'bucket': bucket,
            'key': key,
            'excel_data': df,
            'file_content': file_content,
            'file_metadata': {
                'row_count': len(df),
                'column_count': len(df.columns),
                'sheet_name': ORDERS_SCHEMA.sheet_name,
                'file_size_bytes': len(file_content)
            }
        }
        
        # If all checks pass, return success with file information
        success_msg = f'Excel file validated successfully! File: {key}, Rows: {len(df)}'
        logger.info(f"Success: {success_msg}")
        return {
            'success': True,
            'message': success_msg,
            'data': file_data
        }
    
    except Exception as e:
        # Handle any errors
        error_msg = f'Error processing file: {str(e)}'
        logger.error(error_msg)
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            'success': False,
            'message': error_msg
        }