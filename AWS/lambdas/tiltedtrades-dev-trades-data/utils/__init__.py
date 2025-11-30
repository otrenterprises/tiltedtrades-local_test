"""
Utilities Package for Trading Data Processing

This package contains utility modules for the Trading Data Processing application:

1. config: Configuration management
   - Environment variable handling
   - Default configuration values
   - Configuration grouping

2. excel: Excel file utilities
   - Excel file reading and validation
   - Data type conversion
   - Column handling

3. json_helpers: JSON utilities
   - JSON serialization with Decimal support
   - DynamoDB-specific JSON formatting
   - JSON validation

4. ses: SES email utilities
   - Email formatting and sending
   - Template management
   - Error notification formatting

These utilities provide common functionality used across
the application's handlers and models.
"""

from utils.config import Config
from utils.excel import (
    read_excel_file, 
    convert_excel_date, 
    format_date,
    convert_to_decimal, 
    validate_excel_data,
    filter_rows_by_status,
    select_columns,
    save_to_excel
)
from utils.json_helpers import (
    serialize_to_json,
    format_for_dynamodb,
    dynamodb_to_dict,
    prepare_items_for_batch_write,
    chunk_list,
    parse_json,
    validate_json_format,
    format_for_standard_json
)
from utils.ses import (
    send_email,
    format_error_email,
    format_success_email,
    send_error_notification,
    send_success_notification
)

__all__ = [
    # Config
    'Config',
    
    # Excel utilities
    'read_excel_file',
    'convert_excel_date',
    'format_date',
    'convert_to_decimal',
    'validate_excel_data',
    'filter_rows_by_status',
    'select_columns',
    'save_to_excel',
    
    # JSON utilities
    'serialize_to_json',
    'format_for_dynamodb',
    'dynamodb_to_dict',
    'prepare_items_for_batch_write',
    'chunk_list',
    'parse_json',
    'validate_json_format',
    'format_for_standard_json',
    
    # SES utilities
    'send_email',
    'format_error_email',
    'format_success_email',
    'send_error_notification',
    'send_success_notification'
]