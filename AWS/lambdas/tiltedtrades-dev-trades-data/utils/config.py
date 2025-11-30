"""
Configuration Management

This module provides centralized configuration management for the application,
using environment variables with sensible defaults.

Environment Variables Used:
--------------------------
REGION                      - AWS region
ENVIRONMENT                 - Environment (dev, test, prod)
S3_BUCKET                   - S3 bucket for file storage (standardized)
UPLOAD_FOLDER               - S3 folder path for uploaded files
PROCESSED_FOLDER            - S3 folder path for processed files
SYMBOL_CONVERSION_KEY       - Path to symbol conversion file
TRADING_EXECUTIONS_TABLE    - DynamoDB table for trading executions (standardized)
NOTIFICATION_EMAIL          - Email for notifications
FROM_EMAIL                  - Sender email for notifications
LAMBDA_TIMEOUT              - Lambda timeout in seconds
LAMBDA_MEMORY               - Lambda memory in MB
LOG_LEVEL                   - Logging level
BATCH_SIZE                  - Batch size for processing
COMMISSION_TIER             - Commission tier to use (1-4 or 'fixed', default: 3)
"""

import os
from models.excel_schema import REQUIRED_COLUMNS, ALL_COLUMNS, REQUIRED_SHEET_NAME

class Config:
    """
    Centralized configuration class with all settings.
    
    All configuration values are accessed as class attributes and are
    loaded from environment variables with sensible defaults.
    """
    
    # AWS Region
    REGION = os.environ.get('REGION', 'us-east-1')
    ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')

    # S3 Configuration - Standardized naming
    S3_BUCKET = os.environ.get('S3_BUCKET', 'tiltedtrades-dev-filebucket')
    SOURCE_BUCKET = os.environ.get('SOURCE_BUCKET', os.environ.get('S3_BUCKET', 'tiltedtrades-dev-filebucket'))  # Alias for compatibility
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'users/')  # User-specific uploads
    PROCESSED_FOLDER = os.environ.get('PROCESSED_FOLDER', 'history/')  # Processed JSON archives
    SYMBOL_CONVERSION_KEY = os.environ.get('SYMBOL_CONVERSION_KEY', 'data/symbol_conversion.json')

    # DynamoDB Configuration - Standardized naming (matches TypeScript Lambdas)
    TRADING_EXECUTIONS_TABLE = os.environ.get('TRADING_EXECUTIONS_TABLE', 'tiltedtrades-dev-TradingExecutions')
    TRADING_TABLE = os.environ.get('TRADING_EXECUTIONS_TABLE', 'tiltedtrades-dev-TradingExecutions')  # Alias for compatibility

    # SES Configuration
    NOTIFICATION_EMAIL = os.environ.get('NOTIFICATION_EMAIL', 'aws@tiltedtrades.com')
    FROM_EMAIL = os.environ.get('FROM_EMAIL', 'aws@tiltedtrades.com')
    
    # Excel Configuration
    REQUIRED_SHEET_NAME = REQUIRED_SHEET_NAME
    ORDER_STATUS_COLUMN = "Orders_Transactions_Status"
    ORDER_STATUS_FILTER = "Fill"
    
    # Required Columns (imported from models/excel_schema.py)
    REQUIRED_COLUMNS = REQUIRED_COLUMNS
    ALL_COLUMNS = ALL_COLUMNS
    
    # Lambda configuration
    LAMBDA_TIMEOUT = int(os.environ.get('LAMBDA_TIMEOUT', '900'))  # 15 minutes
    LAMBDA_MEMORY = int(os.environ.get('LAMBDA_MEMORY', '512'))    # 512MB
    
    # Logging configuration
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    
    # Performance configuration
    BATCH_SIZE = int(os.environ.get('BATCH_SIZE', '25'))  # Number of items to process in a batch

    # Commission calculation configuration
    # Commission tier is valid for all traders of this broker (multi-user)
    # User-specific tier preferences will be stored in UserPreferencesTable (future enhancement)
    COMMISSION_TIER = os.environ.get('COMMISSION_TIER', 'fixed')  # Default to 'fixed' tier (uses tier 3 rates)
    
    @classmethod
    def get_s3_config(cls):
        """
        Returns S3 configuration as a dictionary.

        Returns:
            dict: S3 configuration
        """
        return {
            's3_bucket': cls.S3_BUCKET,
            'upload_folder': cls.UPLOAD_FOLDER,
            'processed_folder': cls.PROCESSED_FOLDER,
            'symbol_conversion_key': cls.SYMBOL_CONVERSION_KEY
        }

    @classmethod
    def get_dynamodb_config(cls):
        """
        Returns DynamoDB configuration as a dictionary.

        Returns:
            dict: DynamoDB configuration
        """
        return {
            'trading_executions_table': cls.TRADING_EXECUTIONS_TABLE
        }
    
    @classmethod
    def get_ses_config(cls):
        """
        Returns SES configuration as a dictionary.
        
        Returns:
            dict: SES configuration
        """
        return {
            'notification_email': cls.NOTIFICATION_EMAIL,
            'from_email': cls.FROM_EMAIL
        }
    
    @classmethod
    def get_excel_config(cls):
        """
        Returns Excel configuration as a dictionary.
        
        Returns:
            dict: Excel configuration
        """
        return {
            'required_sheet_name': cls.REQUIRED_SHEET_NAME,
            'order_status_column': cls.ORDER_STATUS_COLUMN,
            'order_status_filter': cls.ORDER_STATUS_FILTER,
            'required_columns': cls.REQUIRED_COLUMNS,
            'all_columns': cls.ALL_COLUMNS
        }
    
    @classmethod
    def get_lambda_config(cls):
        """
        Returns Lambda configuration as a dictionary.
        
        Returns:
            dict: Lambda configuration
        """
        return {
            'timeout': cls.LAMBDA_TIMEOUT,
            'memory': cls.LAMBDA_MEMORY,
            'log_level': cls.LOG_LEVEL,
            'batch_size': cls.BATCH_SIZE
        }