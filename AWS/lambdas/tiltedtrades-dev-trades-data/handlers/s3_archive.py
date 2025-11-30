import boto3
import json
import logging
import traceback
from datetime import datetime
from typing import Dict, Any
from utils.config import Config

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize S3 client
s3_client = boto3.client('s3', region_name=Config.REGION)

def save_original_json_to_s3(file_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Saves original Excel data as JSON to S3 for archival purposes.

    This handler:
    1. Takes the original Excel data after validation (before transformation)
    2. Converts the DataFrame to JSON format
    3. Saves to S3: users/{userId}/history/original_{timestamp}_{filename}.json

    This provides:
    - Long-term archival of raw data (cheaper than DynamoDB)
    - Ability to reprocess data without re-uploading Excel
    - Complete audit trail of what was uploaded

    Args:
        file_data (dict): The validated file data containing excel_data and metadata

    Returns:
        dict: Result with success/failure status
    """
    try:
        logger.info("Starting S3 JSON archival of original data")

        # Extract necessary data
        user_id = file_data.get('userId')
        if not user_id:
            logger.error("userId not found in file_data")
            return {
                'success': False,
                'message': 'userId is required but was not provided'
            }

        df = file_data.get('excel_data')
        if df is None or len(df) == 0:
            return {
                'success': False,
                'message': 'No data available for archival'
            }

        # Get original filename from S3 key
        s3_key = file_data.get('key', '')
        original_filename = s3_key.split('/')[-1] if s3_key else 'unknown.xlsx'
        # Remove timestamp prefix if present (e.g., "1234567890_trades.xlsx" -> "trades")
        if '_' in original_filename:
            parts = original_filename.split('_', 1)
            if parts[0].isdigit():
                original_filename = parts[1]
        # Remove extension
        base_filename = original_filename.rsplit('.', 1)[0]

        # Generate archive filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        archive_filename = f"original_{timestamp}_{base_filename}.json"

        # Construct S3 key for history folder
        archive_key = f"users/{user_id}/history/{archive_filename}"

        logger.info(f"Archiving {len(df)} rows to S3: {archive_key}")

        # Convert DataFrame to JSON-serializable format
        # Use 'records' orientation for easy reprocessing
        data_records = df.to_dict(orient='records')

        # Create archive object with metadata
        archive_data = {
            'metadata': {
                'archived_at': datetime.now().isoformat(),
                'original_filename': original_filename,
                'source_s3_key': s3_key,
                'user_id': user_id,
                'row_count': len(df),
                'columns': list(df.columns)
            },
            'data': data_records
        }

        # Convert to JSON string
        json_content = json.dumps(archive_data, indent=2, default=str)

        # Upload to S3
        s3_client.put_object(
            Bucket=Config.SOURCE_BUCKET,
            Key=archive_key,
            Body=json_content,
            ContentType='application/json',
            Metadata={
                'user-id': user_id,
                'original-filename': original_filename,
                'archived-at': datetime.now().isoformat(),
                'row-count': str(len(df))
            }
        )

        logger.info(f"Successfully archived original data to S3")
        logger.info(f"Archive location: s3://{Config.SOURCE_BUCKET}/{archive_key}")
        logger.info(f"Rows archived: {len(df)}")

        return {
            'success': True,
            'message': f"Successfully archived {len(df)} rows to S3",
            's3_key': archive_key,
            'rows_archived': len(df)
        }

    except Exception as e:
        error_msg = f"Error archiving original data to S3: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'message': error_msg
        }


def save_processed_json_to_s3(file_data: Dict[str, Any], json_data: list) -> Dict[str, Any]:
    """
    Saves processed/transformed data as JSON to S3 for archival purposes.

    This handler:
    1. Takes the transformed data (after filtering and conversion)
    2. Saves to S3: users/{userId}/history/processed_{timestamp}_{filename}.json

    This provides:
    - Backup of processed executions before DynamoDB write
    - Ability to re-populate DynamoDB without reprocessing Excel
    - Faster reprocessing (no Excel parsing needed)

    Args:
        file_data (dict): The file metadata
        json_data (list): The processed trading executions

    Returns:
        dict: Result with success/failure status
    """
    try:
        logger.info("Starting S3 JSON archival of processed data")

        # Extract necessary data
        user_id = file_data.get('userId')
        if not user_id:
            logger.error("userId not found in file_data")
            return {
                'success': False,
                'message': 'userId is required but was not provided'
            }

        if not json_data or len(json_data) == 0:
            return {
                'success': False,
                'message': 'No processed data available for archival'
            }

        # Get original filename from S3 key
        s3_key = file_data.get('key', '')
        original_filename = s3_key.split('/')[-1] if s3_key else 'unknown.xlsx'
        # Remove timestamp prefix if present
        if '_' in original_filename:
            parts = original_filename.split('_', 1)
            if parts[0].isdigit():
                original_filename = parts[1]
        # Remove extension
        base_filename = original_filename.rsplit('.', 1)[0]

        # Generate archive filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        archive_filename = f"processed_{timestamp}_{base_filename}.json"

        # Construct S3 key for history folder
        archive_key = f"users/{user_id}/history/{archive_filename}"

        logger.info(f"Archiving {len(json_data)} executions to S3: {archive_key}")

        # Create archive object with metadata
        archive_data = {
            'metadata': {
                'archived_at': datetime.now().isoformat(),
                'original_filename': original_filename,
                'source_s3_key': s3_key,
                'user_id': user_id,
                'execution_count': len(json_data)
            },
            'executions': json_data
        }

        # Convert to JSON string
        json_content = json.dumps(archive_data, indent=2, default=str)

        # Upload to S3
        s3_client.put_object(
            Bucket=Config.SOURCE_BUCKET,
            Key=archive_key,
            Body=json_content,
            ContentType='application/json',
            Metadata={
                'user-id': user_id,
                'original-filename': original_filename,
                'archived-at': datetime.now().isoformat(),
                'execution-count': str(len(json_data))
            }
        )

        logger.info(f"Successfully archived processed data to S3")
        logger.info(f"Archive location: s3://{Config.SOURCE_BUCKET}/{archive_key}")
        logger.info(f"Executions archived: {len(json_data)}")

        return {
            'success': True,
            'message': f"Successfully archived {len(json_data)} executions to S3",
            's3_key': archive_key,
            'executions_archived': len(json_data)
        }

    except Exception as e:
        error_msg = f"Error archiving processed data to S3: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'message': error_msg
        }
