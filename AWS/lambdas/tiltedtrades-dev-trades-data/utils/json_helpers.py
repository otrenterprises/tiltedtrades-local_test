"""
JSON Helper Functions

This module provides utility functions for JSON operations,
including serialization, DynamoDB formatting, and type conversion.
"""

import json
import logging
from decimal import Decimal
from typing import Dict, List, Any, Optional, Union
from datetime import datetime

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class DecimalEncoder(json.JSONEncoder):
    """
    Custom JSON encoder that handles Decimal objects.
    """
    def default(self, obj):
        if isinstance(obj, Decimal):
            if obj % 1 == 0:
                return int(obj)
            else:
                return float(obj)
        if isinstance(obj, datetime):
            return obj.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        return super(DecimalEncoder, self).default(obj)

def serialize_to_json(data: Any) -> str:
    """
    Serializes data to JSON string with proper handling of special types.
    
    Args:
        data: Data to serialize
        
    Returns:
        str: JSON string
    """
    try:
        return json.dumps(data, cls=DecimalEncoder)
    except Exception as e:
        logger.error(f"Error serializing to JSON: {str(e)}")
        # Return empty JSON object/array as fallback
        if isinstance(data, dict):
            return "{}"
        elif isinstance(data, list):
            return "[]"
        else:
            return '""'

def format_for_dynamodb(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Formats a dictionary for DynamoDB compatibility.
    
    Args:
        item: Dictionary to format
        
    Returns:
        Dict[str, Any]: DynamoDB-compatible dictionary
    """
    result = {}
    
    for key, value in item.items():
        # Skip None values
        if value is None:
            continue
        
        # Convert Python types to DynamoDB types
        if isinstance(value, bool):
            result[key] = {"BOOL": value}
        elif isinstance(value, (int, float)):
            result[key] = {"N": str(value)}
        elif isinstance(value, Decimal):
            result[key] = {"N": str(value)}
        elif isinstance(value, str):
            result[key] = {"S": value}
        elif isinstance(value, bytes):
            result[key] = {"B": value}
        elif isinstance(value, list):
            if all(isinstance(x, str) for x in value):
                result[key] = {"SS": value}
            elif all(isinstance(x, (int, float, Decimal)) for x in value):
                result[key] = {"NS": [str(x) for x in value]}
            elif all(isinstance(x, bytes) for x in value):
                result[key] = {"BS": value}
            else:
                # Mixed type list, convert to JSON string
                result[key] = {"S": serialize_to_json(value)}
        elif isinstance(value, dict):
            result[key] = {"M": format_for_dynamodb(value)}
        elif isinstance(value, datetime):
            result[key] = {"S": value.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}
        else:
            # Convert to string as fallback
            result[key] = {"S": str(value)}
    
    return result

def dynamodb_to_dict(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Converts a DynamoDB-formatted dictionary to a regular Python dictionary.
    
    Args:
        item: DynamoDB-formatted dictionary
        
    Returns:
        Dict[str, Any]: Regular Python dictionary
    """
    result = {}
    
    for key, value in item.items():
        if isinstance(value, dict):
            # Handle DynamoDB types
            if "N" in value:
                # Convert to Decimal for precise numeric representation
                result[key] = Decimal(value["N"])
            elif "S" in value:
                result[key] = value["S"]
            elif "BOOL" in value:
                result[key] = value["BOOL"]
            elif "NULL" in value:
                result[key] = None
            elif "B" in value:
                result[key] = value["B"]
            elif "SS" in value:
                result[key] = value["SS"]
            elif "NS" in value:
                result[key] = [Decimal(x) for x in value["NS"]]
            elif "BS" in value:
                result[key] = value["BS"]
            elif "M" in value:
                result[key] = dynamodb_to_dict(value["M"])
            elif "L" in value:
                result[key] = [dynamodb_to_dict(x) if isinstance(x, dict) else x for x in value["L"]]
            else:
                # Not a DynamoDB type, recurse
                result[key] = dynamodb_to_dict(value)
        else:
            # Not a dict, use as is
            result[key] = value
    
    return result

def prepare_items_for_batch_write(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Prepares items for DynamoDB batch write operation.
    
    Args:
        items: List of items to prepare
        
    Returns:
        List[Dict[str, Any]]: List of items prepared for batch write
    """
    if not items:
        return []
    
    # Format for DynamoDB batch write
    formatted_items = []
    for item in items:
        formatted_items.append({"PutRequest": {"Item": item}})
    
    return formatted_items

def chunk_list(items: List[Any], chunk_size: int = 25) -> List[List[Any]]:
    """
    Splits a list into chunks of the specified size.
    
    Args:
        items: List to split
        chunk_size: Size of each chunk (default: 25, DynamoDB batch limit)
        
    Returns:
        List[List[Any]]: List of chunks
    """
    return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]

def parse_json(json_string: str) -> Union[Dict[str, Any], List[Any], None]:
    """
    Safely parses a JSON string to a Python object.
    
    Args:
        json_string: JSON string to parse
        
    Returns:
        Dict, List, or None: Parsed JSON object or None if parsing fails
    """
    try:
        return json.loads(json_string)
    except Exception as e:
        logger.error(f"Error parsing JSON: {str(e)}")
        return None

def validate_json_format(item: Any) -> bool:
    """
    Validates that an item can be serialized as JSON.
    
    Args:
        item: Item to validate
        
    Returns:
        bool: True if item can be serialized, False otherwise
    """
    try:
        json.dumps(item, cls=DecimalEncoder)
        return True
    except Exception as e:
        logger.error(f"JSON format validation failed: {str(e)}")
        return False

def format_for_standard_json(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Formats DynamoDB items for standard JSON (no type descriptors).
    
    Args:
        items: List of DynamoDB items
        
    Returns:
        List[Dict[str, Any]]: Items formatted for standard JSON
    """
    result = []
    
    for item in items:
        if isinstance(item, dict):
            # Convert DynamoDB dict to regular dict
            std_item = dynamodb_to_dict(item)
            result.append(std_item)
        else:
            # Not a dict, add as is
            result.append(item)
    
    return result