"""
Original Order Data Model

This module defines the data model for the OriginalOrders DynamoDB table.
It provides:
1. A data class for original order data
2. Helper methods for data access and manipulation
3. Validation logic for original order data
4. Conversion methods between pandas DataFrame and DynamoDB

The OriginalOrder class preserves all original column names and values
from the Excel file without modification, while ensuring proper formatting
for DynamoDB storage.
"""

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Any, Optional
import pandas as pd
from datetime import datetime
import json
import logging
from decimal import Decimal


# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@dataclass
class OriginalOrder:
    """
    Data model for original order data stored in DynamoDB.
    
    This preserves all original fields from the Excel file with appropriate
    conversions for DynamoDB compatibility.
    
    Attributes:
        Orders_Transactions_TransactionID: Unique transaction ID (primary key)
        Other attributes are dynamically added and preserved
    """
    
    # Primary key (required)
    Orders_Transactions_TransactionID: Any
    
    # Container for additional fields not explicitly defined
    additional_fields: Dict[str, Any] = field(default_factory=dict)
    
    def __getattr__(self, name: str) -> Any:
        """
        Enables access to additional fields not explicitly defined.
        
        Args:
            name: Field name to access
            
        Returns:
            Any: Value of the field
            
        Raises:
            AttributeError: If field doesn't exist
        """
        if name in self.additional_fields:
            return self.additional_fields[name]
        raise AttributeError(f"'{self.__class__.__name__}' object has no attribute '{name}'")
    
    def __setattr__(self, name: str, value: Any) -> None:
        """
        Sets a field value, handling both explicit and additional fields.
        
        Args:
            name: Field name
            value: Field value
        """
        # Check if it's a known attribute
        if name in self.__dataclass_fields__:
            super().__setattr__(name, value)
        else:
            # Store in additional_fields
            self.additional_fields[name] = value
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OriginalOrder':
        """
        Creates an OriginalOrder instance from a dictionary.
        
        Args:
            data: Dictionary with field values
            
        Returns:
            OriginalOrder: New instance with dictionary values
        """
        # Check if primary key exists
        if 'Orders_Transactions_TransactionID' not in data:
            # If it doesn't exist, use a placeholder or default value
            data['Orders_Transactions_TransactionID'] = 'unknown'
        
        # Create instance
        instance = cls(Orders_Transactions_TransactionID=data['Orders_Transactions_TransactionID'])
        
        # Add all fields to additional_fields
        for k, v in data.items():
            if k != 'Orders_Transactions_TransactionID' and k != 'additional_fields':
                instance.additional_fields[k] = v
        
        return instance
    
    @classmethod
    def from_pandas_series(cls, row: pd.Series) -> 'OriginalOrder':
        """
        Creates an OriginalOrder instance from a pandas Series.
        
        Args:
            row: Pandas Series representing a row
            
        Returns:
            OriginalOrder: New instance with pandas Series values
        """
        # Convert Series to dictionary
        data = {}
        for key, value in row.items():
            # Handle NaN values
            if pd.isna(value):
                data[key] = None
            else:
                data[key] = value
        
        return cls.from_dict(data)
    
    @classmethod
    def from_dataframe_to_list(cls, df: pd.DataFrame) -> List['OriginalOrder']:
        """
        Converts a DataFrame to a list of OriginalOrder instances.
        
        Args:
            df: Pandas DataFrame
            
        Returns:
            List[OriginalOrder]: List of instances for each row
        """
        return [cls.from_pandas_series(row) for _, row in df.iterrows()]
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Converts the instance to a dictionary.
        
        Returns:
            Dict[str, Any]: Dictionary of field values
        """
        # Get explicit fields
        result = asdict(self)
        
        # Add additional fields
        additional = result.pop('additional_fields', {})
        result.update(additional)
        
        return result
    
    def to_dynamodb_dict(self) -> Dict[str, Any]:
        """
        Converts the instance to a DynamoDB-compatible dictionary.
        
        Returns:
            Dict[str, Any]: DynamoDB-compatible dictionary
            
        Note:
            Keys ending with 'Ms' will always be formatted as 'yyyy-MM-dd HH:mm:ss.fff'
            regardless of the time component.
        """
        # Get all fields including additional ones
        all_fields = self.to_dict()
        result = {}
        
        for key, value in all_fields.items():
            # Skip None values
            if value is None:
                continue
            
            # Skip NaN values
            if isinstance(value, float) and pd.isna(value):
                continue
            
            # Skip infinity values (DynamoDB doesn't support them)
            if isinstance(value, float) and (value == float('inf') or value == float('-inf')):
                continue
            
            # Special handling for keys ending with 'Ms' - always use yyyy-MM-dd HH:mm:ss.fff format
            if key.endswith('Ms'):
                if isinstance(value, str):
                    # If it's already a string, preserve it (assuming correct format)
                    result[key] = value
                elif isinstance(value, (datetime, pd.Timestamp)):
                    # Format with milliseconds
                    result[key] = value.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
                else:
                    # For any other type, convert to string
                    result[key] = str(value)
            # Handle date/datetime fields directly to avoid redundant conversions
            elif (key.endswith('Date') or 'When' in key or 'Time' in key or 'Expiration' in key):
                # If it's already a string, preserve the format
                if isinstance(value, str):
                    result[key] = value
                # Otherwise convert datetime objects
                elif isinstance(value, (datetime, pd.Timestamp)):
                    # Check if time component is significant (not midnight)
                    if value.hour == 0 and value.minute == 0 and value.second == 0 and value.microsecond == 0:
                        # Date only - mm/dd/yyyy
                        result[key] = value.strftime('%m/%d/%Y')
                    elif value.microsecond == 0:
                        # Date and time without milliseconds - mm/dd/yyyy hh:mm:ss
                        result[key] = value.strftime('%m/%d/%Y %H:%M:%S')
                    else:
                        # Full date and time with milliseconds - mm/dd/yyyy hh:mm:ss.fff
                        result[key] = value.strftime('%m/%d/%Y %H:%M:%S.%f')[:-3]
                else:
                    # For any other type, convert to string
                    result[key] = str(value)
            # Convert float to Decimal (DynamoDB requires Decimal, not float)
            elif isinstance(value, float):
                result[key] = Decimal(str(value))
            # Handle any remaining datetime objects with default format
            elif isinstance(value, datetime) or isinstance(value, pd.Timestamp):
                result[key] = value.strftime('%Y-%m-%d %H:%M:%S')
            else:
                # Pass all other values through directly
                result[key] = value
        
        return result        
    def is_valid(self) -> bool:
        """
        Validates required fields are present and properly formatted.
        
        Returns:
            bool: True if valid, False otherwise
        """
        # Check for required primary key
        if not self.Orders_Transactions_TransactionID:
            return False
        
        return True


    # def handle_date_value(value: Any) -> str:
    # """
    # Handles date values intelligently, preserving original format when possible.
    
    # Args:
    #     value: Date or datetime value, could be string, datetime, or Timestamp
        
    # Returns:
    #     str: Properly formatted date string
    # """
    # if value is None or pd.isna(value):
    #     return None
    
    # # If it's already a string, preserve the format
    # if isinstance(value, str):
    #     # Simply return the string format as is - preserving all original formats
    #     return value
            
    # # Handle datetime or Timestamp objects
    # if isinstance(value, (datetime, pd.Timestamp)):
    #     # Check if time component is significant (not midnight)
    #     if value.hour == 0 and value.minute == 0 and value.second == 0 and value.microsecond == 0:
    #         # Date only format
    #         return value.strftime('%m/%d/%Y')
    #     elif value.microsecond == 0:
    #         # Date time without milliseconds
    #         return value.strftime('%m/%d/%Y %H:%M:%S')
    #     else:
    #         # Full date time with milliseconds
    #         return value.strftime('%m/%d/%Y %H:%M:%S.%f')[:-3]
            
    # # Return as string for any other types
    # return str(value)


def convert_dataframe_to_dynamodb_items(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Converts a DataFrame to a list of DynamoDB-compatible items.
    
    Args:
        df: Pandas DataFrame to convert
        
    Returns:
        List[Dict[str, Any]]: List of DynamoDB items
    """
    # Create OriginalOrder instances
    orders = OriginalOrder.from_dataframe_to_list(df)
    
    # Convert to DynamoDB items
    return [order.to_dynamodb_dict() for order in orders if order.is_valid()]


def batch_write_items(table, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Writes a batch of items to a DynamoDB table.
    
    Args:
        table: DynamoDB table resource
        items: List of items to write
        
    Returns:
        Dict[str, Any]: Result statistics
    """
    items_written = 0
    items_failed = 0
    
    # Process in batches to improve performance
    with table.batch_writer() as batch:
        for item in items:
            try:
                # Write to DynamoDB
                batch.put_item(Item=item)
                items_written += 1
            except Exception as e:
                logger.error(f"Failed to write item to DynamoDB: {str(e)}")
                logger.error(f"Problematic item: {json.dumps(item, default=str)}")
                items_failed += 1
                # Continue with other items
    
    return {
        'items_written': items_written,
        'items_failed': items_failed
    }