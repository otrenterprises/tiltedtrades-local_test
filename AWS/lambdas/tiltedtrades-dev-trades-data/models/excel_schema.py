"""
Excel Schema Definition Module

This module defines:
1. Schema definitions for Excel validation
2. Column definitions and data types for validation
3. Validation functions for Excel data
4. Schema definitions for both original and transformed data

These schemas are used by other components for validating Excel data,
providing a consistent way to define expected column formats and requirements.
"""

import pandas as pd
from typing import Dict, List, Any, Callable, Optional, Union
from dataclasses import dataclass
from enum import Enum


class DataType(Enum):
    """Enum defining supported data types for schema validation."""
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    DECIMAL = "decimal"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    ANY = "any"  # For fields where type doesn't matter


@dataclass
class ColumnDefinition:
    """
    Defines requirements for a specific Excel column.
    
    Attributes:
        name: Column name in Excel
        data_type: Expected data type
        required: Whether the column is required
        description: Human-readable description
        allow_null: Whether null values are allowed
        validation_func: Optional function for custom validation
    """
    name: str
    data_type: DataType
    required: bool = True
    description: str = ""
    allow_null: bool = False
    validation_func: Optional[Callable[[Any], bool]] = None
    
    def validate_value(self, value: Any) -> bool:
        """
        Validates a value against this column definition.
        
        Args:
            value: The value to validate
            
        Returns:
            bool: True if valid, False otherwise
        """
        # Check for null values
        if pd.isna(value):
            return self.allow_null
        
        # Validate based on data type
        try:
            if self.data_type == DataType.STRING:
                return isinstance(value, str)
            elif self.data_type == DataType.INTEGER:
                # Allow float values that are actually integers
                return (isinstance(value, int) or 
                        (isinstance(value, float) and value.is_integer()))
            elif self.data_type == DataType.FLOAT or self.data_type == DataType.DECIMAL:
                return isinstance(value, (int, float))
            elif self.data_type == DataType.DATE or self.data_type == DataType.DATETIME:
                # Try to parse as date if it's a string
                if isinstance(value, str):
                    pd.to_datetime(value)
                return True  # If no exception, it's valid
            elif self.data_type == DataType.BOOLEAN:
                return isinstance(value, bool)
            elif self.data_type == DataType.ANY:
                return True  # Any non-null value is valid
            return False
        except:
            return False
        
        # Apply custom validation if provided
        if self.validation_func is not None:
            return self.validation_func(value)
        
        return True


@dataclass
class ExcelSchema:
    """
    Defines schema for an Excel sheet, including column definitions.
    
    Attributes:
        sheet_name: Name of the sheet this schema applies to
        columns: List of column definitions
        description: Human-readable description of the schema
        require_all_columns: Whether all columns must be present
    """
    sheet_name: str
    columns: List[ColumnDefinition]
    description: str = ""
    require_all_columns: bool = True
    
    def get_required_columns(self) -> List[str]:
        """
        Returns list of required column names.
        
        Returns:
            List[str]: List of required column names
        """
        return [col.name for col in self.columns if col.required]
    
    def get_all_columns(self) -> List[str]:
        """
        Returns list of all column names.
        
        Returns:
            List[str]: List of all column names
        """
        return [col.name for col in self.columns]
    
    def get_column_definition(self, column_name: str) -> Optional[ColumnDefinition]:
        """
        Get column definition by name.
        
        Args:
            column_name: Name of the column to retrieve
            
        Returns:
            ColumnDefinition or None: Column definition if found, None otherwise
        """
        for col in self.columns:
            if col.name == column_name:
                return col
        return None
    
    def validate_dataframe(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Validates a DataFrame against this schema.
        
        Args:
            df: DataFrame to validate
            
        Returns:
            dict: Validation result with status and any errors
        """
        result = {
            'valid': True,
            'missing_columns': [],
            'type_errors': [],
            'validation_errors': []
        }
        
        # Check for required columns
        for column in self.get_required_columns():
            if column not in df.columns:
                result['missing_columns'].append(column)
                result['valid'] = False
        
        # Stop validation after checking required columns
        # Skip data type validation until transformation phase
        
        return result


# Define schemas for specific use cases

# Original Excel Schema (for validation)
ORDERS_SCHEMA = ExcelSchema(
    sheet_name="Orders",
    description="Schema for the Orders sheet in the Excel file",
    columns=[
        ColumnDefinition(
            name="Orders_Transactions_When_Ms",
            data_type=DataType.DATETIME,
            description="Date and time of order fill",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_OrderFills_TradeDate",
            data_type=DataType.DATE,
            description="Trade date",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_OrderFills_SymbolCommodity",
            data_type=DataType.STRING,
            description="CQG Symbol for the commodity",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_OrderType",
            data_type=DataType.STRING,
            description="Type of order",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_ContractExpiration",
            data_type=DataType.DATE,
            description="Expiration date for the contract",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_OrderFills_Price",
            data_type=DataType.DECIMAL,
            description="Execution price",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_ExchangeConfirmation",
            data_type=DataType.ANY,
            description="Exchange confirmation number",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_OrderFills_GWTradeID",
            data_type=DataType.ANY,
            description="Gateway Trade ID",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_Transactions_OrderExecID",
            data_type=DataType.ANY,
            description="Order execution ID",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_OrderFills_Side",
            data_type=DataType.STRING,
            description="Side of the trade (Buy/Sell)",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_OrderFills_Size",
            data_type=DataType.DECIMAL,
            description="Size of the order",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_CommodityDescription",
            data_type=DataType.STRING,
            description="Description of the commodity",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_Symbol",
            data_type=DataType.STRING,
            description="Full symbol including contract month",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_Exchange",
            data_type=DataType.STRING,
            required=False,
            description="Exchange where traded",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_Transactions_Status",
            data_type=DataType.STRING,
            description="Status of the transaction",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_Transactions_TransactionID",
            data_type=DataType.ANY,
            description="Unique transaction ID (primary key)",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_AccountName",
            data_type=DataType.STRING,
            description="Account name",
            allow_null=True
        )
    ]
)

# Transformed Schema (after filtering and transformation)
TRADING_EXECUTION_SCHEMA = ExcelSchema(
    sheet_name="Orders",
    description="Schema for the transformed trading execution data",
    columns=[
        ColumnDefinition(
            name="Orders_Transactions_When_Ms",
            data_type=DataType.DATETIME,
            description="Date and time of order fill",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_OrderFills_TradeDate",
            data_type=DataType.DATE,
            description="Trade date",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_OrderFills_SymbolCommodity",
            data_type=DataType.STRING,
            description="CQG Symbol for the commodity",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_OrderType",
            data_type=DataType.STRING,
            description="Type of order",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_ContractExpiration",
            data_type=DataType.DATE,
            description="Expiration date for the contract",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_OrderFills_Price",
            data_type=DataType.DECIMAL,
            description="Execution price",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_ExchangeConfirmation",
            data_type=DataType.ANY,
            description="Exchange confirmation number",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_OrderFills_GWTradeID",
            data_type=DataType.ANY,
            description="Gateway Trade ID",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_Transactions_OrderExecID",
            data_type=DataType.ANY,
            description="Order execution ID",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_OrderFills_Side",
            data_type=DataType.STRING,
            description="Side of the trade (Buy/Sell)",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_OrderFills_Size",
            data_type=DataType.DECIMAL,
            description="Size of the order",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_CommodityDescription",
            data_type=DataType.STRING,
            description="Description of the commodity",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_Symbol",
            data_type=DataType.STRING,
            description="Full symbol including contract month",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_Exchange",
            data_type=DataType.STRING,
            required=False,
            description="Exchange where traded",
            allow_null=True
        ),
        ColumnDefinition(
            name="Orders_Transactions_Status",
            data_type=DataType.STRING,
            description="Status of the transaction",
            allow_null=False,
            validation_func=lambda x: "fill" in str(x).lower()  # Must contain "fill"
        ),
        ColumnDefinition(
            name="Orders_Transactions_TransactionID",
            data_type=DataType.ANY,
            description="Unique transaction ID (primary key)",
            allow_null=False
        ),
        ColumnDefinition(
            name="Orders_AccountName",
            data_type=DataType.STRING,
            description="Account name",
            allow_null=True
        )
    ]
)

# Constants for required columns
# These are used by other components for validation
REQUIRED_COLUMNS = ORDERS_SCHEMA.get_required_columns()
ALL_COLUMNS = ORDERS_SCHEMA.get_all_columns()
REQUIRED_SHEET_NAME = ORDERS_SCHEMA.sheet_name

def validate_excel_file(df: pd.DataFrame, schema: ExcelSchema = ORDERS_SCHEMA) -> Dict[str, Any]:
    """
    Validate an Excel DataFrame against a schema.
    
    Args:
        df: DataFrame to validate
        schema: Schema to validate against (default: ORDERS_SCHEMA)
        
    Returns:
        dict: Validation result with status and any errors
    """
    return schema.validate_dataframe(df)

def is_status_fill(status_value: str) -> bool:
    """
    Check if a status value contains 'fill' (case insensitive).
    
    Args:
        status_value: Status value to check
        
    Returns:
        bool: True if status contains 'fill', False otherwise
    """
    if pd.isna(status_value):
        return False
    return "fill" in str(status_value).lower()