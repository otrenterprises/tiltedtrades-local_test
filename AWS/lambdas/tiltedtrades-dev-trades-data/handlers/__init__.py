"""
Handlers module for the consolidated trader Lambda function.

This package contains the handler implementations for each step in the processing workflow:
- validation: Validates Excel files uploaded to S3
- original_data: Preserves original data in the OriginalOrders DynamoDB table
- transformation: Transforms Excel data for business use
- json_conversion: Converts data to JSON format
- dynamodb: Writes JSON data to DynamoDB
- monitoring: Handles error notifications and metrics logging
"""

from handlers.validation import validate_file
from handlers.original_data import preserve_original_data
from handlers.transformation import transform_data
from handlers.json_conversion import convert_to_json
from handlers.dynamodb import write_to_dynamodb
from handlers.monitoring import send_error_notification, log_success, log_metrics

__all__ = [
    'validate_file',
    'preserve_original_data',
    'transform_data',
    'convert_to_json',
    'write_to_dynamodb',
    'send_error_notification',
    'log_success',
    'log_metrics'
]