"""
Excel Utility Functions

This module provides utility functions for Excel file operations,
including reading files, data type conversion, and error handling.
"""

import pandas as pd
import io
import logging
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime
from decimal import Decimal
from utils.config import Config

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def read_excel_file(file_content: bytes, sheet_name: Optional[str] = None) -> Tuple[pd.DataFrame, Optional[str]]:
    """
    Safely reads an Excel file into a DataFrame.
    
    Args:
        file_content: Raw bytes of the Excel file
        sheet_name: Name of the sheet to read (if None, uses Config.REQUIRED_SHEET_NAME)
        
    Returns:
        Tuple containing:
        - DataFrame: Pandas DataFrame with the sheet data
        - Optional[str]: Error message if any, None if successful
    """
    try:
        # Create Excel file object
        excel_file = pd.ExcelFile(io.BytesIO(file_content))
        
        # Use required sheet name if not specified
        if sheet_name is None:
            sheet_name = Config.REQUIRED_SHEET_NAME
        
        # Check if the sheet exists
        if sheet_name not in excel_file.sheet_names:
            error_msg = f"Required sheet '{sheet_name}' not found. Available sheets: {', '.join(excel_file.sheet_names)}"
            logger.error(error_msg)
            return pd.DataFrame(), error_msg
        
        # Read the specified sheet
        logger.info(f"Reading sheet '{sheet_name}' from Excel file")
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        
        # Check if DataFrame is empty
        if df.empty:
            error_msg = f"Sheet '{sheet_name}' is empty"
            logger.error(error_msg)
            return df, error_msg
        
        logger.info(f"Successfully read {len(df)} rows from sheet '{sheet_name}'")
        return df, None
        
    except Exception as e:
        error_msg = f"Error reading Excel file: {str(e)}"
        logger.error(error_msg)
        return pd.DataFrame(), error_msg

def convert_excel_date(date_value: Any) -> Optional[datetime]:
    """
    Converts Excel date value to Python datetime.
    
    Args:
        date_value: Excel date value
        
    Returns:
        datetime or None: Converted datetime or None if invalid
    """
    try:
        if date_value is None or pd.isna(date_value):
            return None
        
        if isinstance(date_value, datetime):
            return date_value
        
        return pd.to_datetime(date_value)
    except Exception as e:
        logger.error(f"Error converting date value '{date_value}': {str(e)}")
        return None

def format_date(dt: Optional[datetime], format_str: str = '%m/%d/%Y') -> str:
    """
    Formats a datetime as a string using the specified format.
    
    Args:
        dt: Datetime to format
        format_str: Format string (default: mm/dd/yyyy)
        
    Returns:
        str: Formatted date string or empty string if None
    """
    if dt is None:
        return ""
    
    try:
        return dt.strftime(format_str)
    except Exception as e:
        logger.error(f"Error formatting date {dt}: {str(e)}")
        return ""

def convert_to_decimal(value: Any) -> Optional[Decimal]:
    """
    Converts a value to Decimal, handling various formats.
    
    Args:
        value: Value to convert
        
    Returns:
        Decimal or None: Converted Decimal or None if invalid
    """
    try:
        if value is None or pd.isna(value):
            return None
        
        if isinstance(value, Decimal):
            return value
        
        if isinstance(value, (int, float)):
            return Decimal(str(value))
        
        if isinstance(value, str):
            # Handle scientific notation
            if 'e' in value.lower() or 'E' in value:
                return Decimal(str(float(value)))
            return Decimal(value)
        
        return None
    except Exception as e:
        logger.error(f"Error converting to Decimal: {value} - {str(e)}")
        return None

def validate_excel_data(df: pd.DataFrame, required_columns: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Validates DataFrame for required columns and basic data integrity.
    
    Args:
        df: DataFrame to validate
        required_columns: List of required column names (default: Config.REQUIRED_COLUMNS)
        
    Returns:
        Dict with validation results:
        - valid: Boolean indicating if validation passed
        - message: Description of validation result
        - missing_columns: List of missing columns if any
    """
    # Use default required columns if not specified
    if required_columns is None:
        required_columns = Config.REQUIRED_COLUMNS
    
    # Initialize result
    result = {
        'valid': True,
        'message': 'Validation successful',
        'missing_columns': []
    }
    
    # Check for empty DataFrame
    if df.empty:
        result['valid'] = False
        result['message'] = 'DataFrame is empty'
        return result
    
    # Check for required columns
    for col in required_columns:
        if col not in df.columns:
            result['missing_columns'].append(col)
    
    if result['missing_columns']:
        result['valid'] = False
        result['message'] = f"Missing required columns: {', '.join(result['missing_columns'])}"
    
    return result

def filter_rows_by_status(df: pd.DataFrame, status_column: Optional[str] = None, 
                         status_filter: Optional[str] = None) -> pd.DataFrame:
    """
    Filters DataFrame rows by status value.
    
    Args:
        df: DataFrame to filter
        status_column: Name of status column (default: Config.ORDER_STATUS_COLUMN)
        status_filter: Status value to filter by (default: Config.ORDER_STATUS_FILTER)
        
    Returns:
        DataFrame: Filtered DataFrame
    """
    # Use default values if not specified
    if status_column is None:
        status_column = Config.ORDER_STATUS_COLUMN
        
    if status_filter is None:
        status_filter = Config.ORDER_STATUS_FILTER
    
    # Validate status column exists
    if status_column not in df.columns:
        logger.warning(f"Status column '{status_column}' not found, returning unfiltered DataFrame")
        return df
    
    # Apply filter (case-insensitive)
    filtered_df = df[df[status_column].str.contains(status_filter, case=False, na=False)]
    
    logger.info(f"Filtered DataFrame: {len(filtered_df)} rows out of {len(df)} contain '{status_filter}'")
    return filtered_df

def select_columns(df: pd.DataFrame, required_columns: Optional[List[str]] = None) -> pd.DataFrame:
    """
    Selects only required columns from DataFrame, handling missing columns.
    
    Args:
        df: DataFrame to filter
        required_columns: List of required column names (default: Config.REQUIRED_COLUMNS)
        
    Returns:
        DataFrame: DataFrame with only required columns
    """
    # Use default required columns if not specified
    if required_columns is None:
        required_columns = Config.REQUIRED_COLUMNS
    
    # Find available required columns
    available_columns = [col for col in required_columns if col in df.columns]
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        logger.warning(f"Missing columns that were expected: {missing_columns}")
    
    # Select only available required columns
    filtered_df = df[available_columns]
    
    logger.info(f"Selected {len(available_columns)} columns out of {len(df.columns)}")
    return filtered_df

def save_to_excel(df: pd.DataFrame, sheet_name: Optional[str] = None) -> Tuple[bytes, Optional[str]]:
    """
    Saves DataFrame to Excel file in memory.
    
    Args:
        df: DataFrame to save
        sheet_name: Name of sheet (default: Config.REQUIRED_SHEET_NAME)
        
    Returns:
        Tuple containing:
        - bytes: Excel file content as bytes
        - Optional[str]: Error message if any, None if successful
    """
    try:
        # Use required sheet name if not specified
        if sheet_name is None:
            sheet_name = Config.REQUIRED_SHEET_NAME
        
        # Create output buffer
        output_buffer = io.BytesIO()
        
        # Write DataFrame to Excel
        with pd.ExcelWriter(output_buffer, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        # Reset buffer position
        output_buffer.seek(0)
        
        # Return the content
        return output_buffer.getvalue(), None
        
    except Exception as e:
        error_msg = f"Error saving DataFrame to Excel: {str(e)}"
        logger.error(error_msg)
        return bytes(), error_msg