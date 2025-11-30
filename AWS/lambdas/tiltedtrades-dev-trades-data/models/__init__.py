"""
Models Package for Trading Data Processing

This package contains data models and schemas for the Trading Data Processing application:

1. excel_schema: Schemas for Excel validation
   - Column definitions
   - Data type validation
   - Schema validation

2. original_order: Data model for OriginalOrders table
   - Preserves original data structure
   - Provides conversion utilities
   - Handles DynamoDB formatting

3. trading_execution: Data model for TradingExecutions table
   - Represents transformed data
   - Includes business logic and calculations
   - Standardizes field names and formats

These models provide a consistent structure for data validation,
transformation, and storage throughout the application.
"""

from models.excel_schema import (
    ORDERS_SCHEMA,
    TRADING_EXECUTION_SCHEMA,
    REQUIRED_COLUMNS,
    ALL_COLUMNS,
    REQUIRED_SHEET_NAME,
    validate_excel_file,
    DataType,
    ColumnDefinition,
    ExcelSchema
)

from models.original_order import (
    OriginalOrder,
    convert_dataframe_to_dynamodb_items,
    batch_write_items
)

from models.trading_execution import (
    TradingExecution,
    transform_json_items,
    transform_dataframe
)

__all__ = [
    # Excel schema
    'ORDERS_SCHEMA',
    'TRADING_EXECUTION_SCHEMA',
    'REQUIRED_COLUMNS',
    'ALL_COLUMNS',
    'REQUIRED_SHEET_NAME',
    'validate_excel_file',
    'DataType',
    'ColumnDefinition',
    'ExcelSchema',
    
    # Original order
    'OriginalOrder',
    'convert_dataframe_to_dynamodb_items',
    'batch_write_items',
    
    # Trading execution
    'TradingExecution',
    'transform_json_items',
    'transform_dataframe'
]