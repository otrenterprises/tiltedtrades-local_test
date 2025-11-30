"""
Trading Execution Data Model

This module defines the data model for the TradingExecutions DynamoDB table.
It provides:
1. A data class for transformed trading execution data
2. Helper methods for data access and manipulation
3. Derived field calculations and business logic
4. Conversion methods between JSON and DynamoDB

The TradingExecution class represents the transformed data after filtering
and processing, with standardized field names and calculated derived fields.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Union, ClassVar
from decimal import Decimal
import pandas as pd
from datetime import datetime
import json


@dataclass
class TradingExecution:
    """
    Data model for transformed trading execution data stored in DynamoDB.
    
    This represents the processed and standardized data after transformation,
    including derived fields not present in the original data.
    
    Attributes:
        DBKey: Primary key (from Orders_Transactions_TransactionID)
        Date: Formatted date of execution
        Time: Formatted time of execution
        Other attributes with standardized names
    """
    
    # Primary key (required)
    DBKey: Union[int, str, Decimal]

    # Required date/time fields
    Date: str
    Time: str
    TradingDay: str
    
    # Required trading fields
    WeekNum: int
    TickerConversion: str
    CQGSymbol: str
    Side: str
    Quantity: Decimal
    PositionEffect: Decimal
    ExecutionPrice: Decimal
    
    # Optional fields with defaults
    userId: str = ""  # User ID (partition key for DynamoDB)
    Description: str = ""
    FullCQGSymbol: str = ""
    Exchange: str = ""
    OrderType: str = ""
    ContractExpiration: str = ""
    ExchangeConfirmation: Optional[Union[int, str, Decimal]] = None
    GWOrderID: Optional[Union[int, str, Decimal]] = None
    OrderExecID: Optional[Union[int, str, Decimal]] = None

    # Calculated fields
    NotionalValue: Decimal = Decimal('0')
    Fees: Decimal = Decimal('0')
    Account: str = ""
    PositionQty: int = 0
    Status: str = ""
    PnLPerPosition: Optional[Decimal] = None  # P&L for position (only on close)

    # Class attribute mapping original column names to model fields
    # Using ClassVar to ensure this is a class variable only, not included in __init__
    FIELD_MAPPING: ClassVar[Dict[str, str]] = {
        'Orders_Transactions_TransactionID': 'DBKey',
        'Orders_Transactions_When_Ms': 'DateTime',  # Processed into Date and Time
        'Orders_OrderFills_TradeDate': 'TradingDay',
        'Orders_OrderFills_SymbolCommodity': 'CQGSymbol',
        'Orders_CommodityDescription': 'Description',
        'Orders_Symbol': 'FullCQGSymbol',
        'Orders_Exchange': 'Exchange',
        'Orders_OrderType': 'OrderType',
        'Orders_ContractExpiration': 'ContractExpiration',
        'Orders_OrderFills_Side': 'Side',
        'Orders_OrderFills_Size': 'Quantity',
        'Orders_OrderFills_Price': 'ExecutionPrice',
        'Orders_ExchangeConfirmation': 'ExchangeConfirmation',
        'Orders_OrderFills_GWTradeID': 'GWOrderID',
        'Orders_Transactions_OrderExecID': 'OrderExecID',
        'Orders_AccountName': 'Account'
    }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TradingExecution':
        """
        Creates a TradingExecution instance from a dictionary.
        
        Args:
            data: Dictionary with field values
            
        Returns:
            TradingExecution: New instance with dictionary values
        """
        # Make a copy to avoid modifying the original
        data_copy = data.copy()
        
        # Remove FIELD_MAPPING if it's in the data to prevent it being passed to __init__
        if 'FIELD_MAPPING' in data_copy:
            del data_copy['FIELD_MAPPING']
            
        # Convert string numeric values to Decimal if needed
        for field_name in ['Quantity', 'PositionEffect', 'ExecutionPrice', 
                          'ExchangeConfirmation', 'GWOrderID', 'OrderExecID']:
            if field_name in data_copy and isinstance(data_copy[field_name], str):
                try:
                    data_copy[field_name] = Decimal(data_copy[field_name])
                except:
                    pass
        
        return cls(**data_copy)
    
    @classmethod
    def from_dynamodb_dict(cls, item: Dict[str, Any]) -> 'TradingExecution':
        """
        Creates a TradingExecution instance from a DynamoDB item.
        
        Args:
            item: DynamoDB item dictionary
            
        Returns:
            TradingExecution: New instance with DynamoDB values
        """
        # Convert DynamoDB types to Python types
        data = {}
        for k, v in item.items():
            # Skip class variables that don't belong in __init__
            if k == 'FIELD_MAPPING':
                continue
                
            if isinstance(v, Decimal):
                # Keep as Decimal for numeric fields that expect Decimal
                if k in ['Quantity', 'PositionEffect', 'ExecutionPrice']:
                    data[k] = v
                # Convert to int if it's a whole number
                elif v % 1 == 0:
                    data[k] = int(v)
                else:
                    data[k] = float(v)
            else:
                data[k] = v
        
        return cls.from_dict(data)
    
    @classmethod
    def from_json_item(cls, json_item: Dict[str, Any]) -> 'TradingExecution':
        """
        Creates a TradingExecution instance from a JSON item.
        
        Args:
            json_item: JSON item dictionary from json_conversion handler
            
        Returns:
            TradingExecution: New instance with JSON values
        """
        # Make a copy and ensure no class variables are passed to constructor
        json_copy = json_item.copy()
        if 'FIELD_MAPPING' in json_copy:
            del json_copy['FIELD_MAPPING']
            
        return cls.from_dict(json_copy)
    
    @classmethod
    def from_original_data(cls,
                          row_dict: Dict[str, Any],
                          symbol_conversion: Dict[str, str] = None,
                          tick_values: Dict[str, Any] = None,
                          commissions: Dict[str, Any] = None,
                          historical_positions: Dict[str, int] = None,
                          symbol_occurrence_tracker: Dict[str, int] = None,
                          pnl_accumulators: Dict[str, Decimal] = None) -> 'TradingExecution':
        """
        Creates a TradingExecution instance from original data row.

        Args:
            row_dict: Dictionary from original Excel row
            symbol_conversion: Symbol conversion lookup table
            tick_values: Tick values lookup table
            commissions: Commissions lookup table
            historical_positions: Running position quantities by CQGSymbol (mutable dict)
            symbol_occurrence_tracker: Track first occurrences of symbols (mutable dict)
            pnl_accumulators: Running P&L accumulator by ticker (mutable dict)

        Returns:
            TradingExecution: Transformed instance
        """
        if symbol_conversion is None:
            symbol_conversion = {}
        if tick_values is None:
            tick_values = {}
        if commissions is None:
            commissions = {}
        if historical_positions is None:
            historical_positions = {}
        if symbol_occurrence_tracker is None:
            symbol_occurrence_tracker = {}
        if pnl_accumulators is None:
            pnl_accumulators = {}
        
        # Parse dates
        when_date = cls.parse_date(row_dict.get('Orders_Transactions_When_Ms'))
        trade_date = cls.parse_date(row_dict.get('Orders_OrderFills_TradeDate'))
        contract_expiration = cls.parse_date(row_dict.get('Orders_ContractExpiration'))
        
        # Format dates
        date_str = cls.format_date(when_date)
        time_str = cls.format_time(when_date)
        trading_day = cls.format_trading_date(trade_date)
        contract_expiration_str = cls.format_date(contract_expiration) if contract_expiration else ""
        
        # Calculate week number
        week_num = cls.calculate_week_number(trade_date)
        
        # Get CQG Symbol and handle ticker conversion
        cqg_symbol = str(row_dict.get('Orders_OrderFills_SymbolCommodity', ''))
        ticker_conversion = cls.apply_symbol_conversion(cqg_symbol, symbol_conversion)
        
        # Parse numeric values - edited (still need verification)
        quantity = cls.parse_decimal(row_dict.get('Orders_OrderFills_Size', 0))
        execution_price = cls.parse_decimal(row_dict.get('Orders_OrderFills_Price', 0))
        exchange_confirmation = cls.parse_decimal(row_dict.get('Orders_ExchangeConfirmation', 0))
        gw_order_id = cls.parse_decimal(row_dict.get('Orders_OrderFills_GWTradeID', 0))
        order_exec_id = cls.parse_decimal(row_dict.get('Orders_Transactions_OrderExecID', 0))
        
        # Calculate position effect
        side = str(row_dict.get('Orders_OrderFills_Side', ''))
        position_effect = cls.calculate_position_effect(side, quantity)
        
        # Generate DBKey (primary key)
        db_key = cls.parse_decimal(row_dict.get('Orders_Transactions_TransactionID', 0))

        # Get Account from original data
        account = str(row_dict.get('Orders_AccountName', ''))

        # Calculate Notional Value and Fees
        from utils.calculations import calculate_notional_value, calculate_commission

        notional_value = calculate_notional_value(
            ticker_conversion,
            execution_price,
            int(position_effect),
            tick_values
        )

        fees = calculate_commission(
            ticker_conversion,
            int(quantity),
            when_date if when_date else datetime.now(),
            commissions
        )

        # Calculate PositionQty, Status, and Sequence using historical context
        # Track if this is the first occurrence of this symbol
        is_first_occurrence = cqg_symbol not in symbol_occurrence_tracker
        if is_first_occurrence:
            symbol_occurrence_tracker[cqg_symbol] = 1

        # Calculate PositionQty (running sum of PositionEffect for this symbol)
        current_position_qty = historical_positions.get(cqg_symbol, 0)
        new_position_qty = current_position_qty + int(position_effect)
        historical_positions[cqg_symbol] = new_position_qty

        # Calculate Status
        # Logic: "To Open" if first occurrence OR if previous position was 0
        #        "To Close" if new position is 0
        #        Otherwise ""
        status = ""
        if is_first_occurrence:
            status = f"To Open {ticker_conversion}"
        elif new_position_qty == 0:
            status = f"To Close {ticker_conversion}"
        elif current_position_qty == 0:
            status = f"To Open {ticker_conversion}"

        # Calculate P&L Per Position
        # Accumulate NotionalValue for this ticker
        pnl_accumulators[ticker_conversion] = pnl_accumulators.get(ticker_conversion, Decimal('0')) + notional_value

        # Output accumulated P&L only when position closes
        if "To Close" in status and new_position_qty == 0:
            pnl_per_position = pnl_accumulators[ticker_conversion]
            # Reset accumulator for next position
            pnl_accumulators[ticker_conversion] = Decimal('0')
        else:
            pnl_per_position = None

        # Create instance with transformed data
        return cls(
            DBKey=db_key,
            Date=date_str,
            Time=time_str,
            TradingDay=trading_day,
            WeekNum=week_num,
            TickerConversion=ticker_conversion,
            Description=str(row_dict.get('Orders_CommodityDescription', '')),
            CQGSymbol=cqg_symbol,
            FullCQGSymbol=str(row_dict.get('Orders_Symbol', '')),
            Exchange=str(row_dict.get('Orders_Exchange', '')),
            Side=side,
            Quantity=quantity,
            PositionEffect=position_effect,
            OrderType=str(row_dict.get('Orders_OrderType', '')),
            ContractExpiration=contract_expiration_str,
            ExecutionPrice=execution_price,
            ExchangeConfirmation=exchange_confirmation,
            GWOrderID=gw_order_id,
            OrderExecID=order_exec_id,
            NotionalValue=notional_value,
            Fees=fees,
            Account=account,
            PositionQty=new_position_qty,
            Status=status,
            PnLPerPosition=pnl_per_position
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Converts the instance to a dictionary.
        
        Returns:
            Dict[str, Any]: Dictionary of field values
        """
        # Convert to dictionary, handling Decimal objects
        result = {}
        for field_name in self.__dataclass_fields__:
            # Skip class variables
            if field_name == 'FIELD_MAPPING':
                continue
                
            value = getattr(self, field_name)
            if isinstance(value, Decimal):
                # Convert to float for better JSON serialization
                result[field_name] = float(value)
            else:
                result[field_name] = value
                
        return result
    
    def to_dynamodb_dict(self) -> Dict[str, Any]:
        """
        Converts the instance to a DynamoDB-compatible dictionary.

        Returns:
            Dict[str, Any]: DynamoDB-compatible dictionary
        """
        result = {}

        # Process all fields
        for field_name in self.__dataclass_fields__:
            # Skip class variables
            if field_name == 'FIELD_MAPPING':
                continue

            value = getattr(self, field_name)

            # Skip None values
            if value is None:
                continue

            # Convert Python types to DynamoDB types
            if isinstance(value, (int, float)) and not isinstance(value, Decimal):
                result[field_name] = Decimal(str(value))
            elif isinstance(value, (dict, list)):
                # Convert to JSON string for complex types
                result[field_name] = json.dumps(value)
            else:
                # Pass all other values through directly
                result[field_name] = value

        # Map DBKey to executionId for DynamoDB schema compliance
        # Convert to int first to remove any decimal portion (e.g., "609533386765.0" -> "609533386765")
        if 'DBKey' in result:
            result['executionId'] = str(int(result['DBKey']))

        return result
    
    def is_valid(self) -> bool:
        """
        Validates required fields are present and properly formatted.
        
        Returns:
            bool: True if valid, False otherwise
        """
        # Check for required primary key
        if not self.DBKey:
            return False
        
        # Check for required date fields
        if not self.Date or not self.Time or not self.TradingDay:
            return False
        
        # Check for required trading fields
        if not self.CQGSymbol or not self.Side:
            return False
        
        return True
    
    @staticmethod
    def parse_date(date_value: Any) -> Optional[datetime]:
        """
        Parse a date value safely, handling various formats and NaN values.
        
        Args:
            date_value: The date value to parse
            
        Returns:
            datetime or None: Parsed datetime object or None if unparseable
        """
        try:
            if date_value is None or pd.isna(date_value):
                return None
            
            if isinstance(date_value, datetime):
                return date_value
            
            return pd.to_datetime(date_value)
        except:
            return None
    
    @staticmethod
    def format_date(dt: Optional[datetime]) -> str:
        """
        Format a datetime object as mm/dd/yyyy.
        
        Args:
            dt: Datetime object to format
            
        Returns:
            str: Formatted date string or empty string if None
        """
        if dt is None:
            return ""
        
        return dt.strftime('%m/%d/%Y')
    
    @staticmethod
    def format_trading_date(dt: Optional[datetime]) -> str:
        """
        Format a datetime object as yyyy-mm-dd.
        
        Args:
            dt: Datetime object to format
            
        Returns:
            str: Formatted date string or empty string if None
        """
        if dt is None:
            return ""
        
        return dt.strftime('%Y-%m-%d')
    
    @staticmethod
    def format_time(dt: Optional[datetime]) -> str:
        """
        Format a datetime object as HH:MM:SS.mmm.
        
        Args:
            dt: Datetime object to format
            
        Returns:
            str: Formatted time string or empty string if None
        """
        if dt is None:
            return ""
        
        return dt.strftime('%H:%M:%S.%f')[:-3]
    
    @staticmethod
    def calculate_week_number(dt: Optional[datetime]) -> int:
        """
        Calculate the ISO week number for a datetime.
        
        Args:
            dt: Datetime object
            
        Returns:
            int: Week number or 0 if date is None
        """
        if dt is None:
            return 0
        
        return dt.isocalendar()[1]
    
    @staticmethod
    def apply_symbol_conversion(symbol: str, conversion_table: Dict[str, str]) -> str:
        """
        Apply symbol conversion using the lookup table.
        
        Args:
            symbol: The CQG symbol to convert
            conversion_table: Symbol conversion lookup table
            
        Returns:
            str: Converted ticker or original symbol if not found
        """
        if not symbol or not conversion_table:
            return symbol
        
        return conversion_table.get(symbol, symbol)
    
    @staticmethod
    def parse_decimal(value: Any) -> Union[Decimal, str]:
        """
        Parse a value to Decimal safely, handling scientific notation and other formats.
        
        Args:
            value: The value to parse
            
        Returns:
            Decimal or str: Parsed decimal value or original string if conversion fails
        """
        try:
            if value is None or pd.isna(value):
                return Decimal('0')
            
            if isinstance(value, (int, float)):
                return Decimal(str(value))
            
            if isinstance(value, str):
                if 'E' in value.upper():
                    # Handle scientific notation
                    return Decimal(str(float(value)))
                
                try:
                    # Attempt to convert to Decimal
                    return Decimal(value)
                except:
                    # If conversion fails, return original string
                    return value
            
            if isinstance(value, Decimal):
                return value
                    
            return Decimal(str(value))
        except:
            # If all conversion attempts fail, return original value or '0'
            return value if isinstance(value, str) else Decimal('0')    
    @staticmethod
    def calculate_position_effect(side: str, quantity: Decimal) -> Decimal:
        """
        Calculate position effect based on side and quantity.
        
        Args:
            side: Trade side ('Buy' or 'Sell')
            quantity: Trade quantity
            
        Returns:
            Decimal: Positive for Buy, negative for Sell
        """
        if side.lower() == 'sell':
            return quantity * Decimal('-1')
        
        return quantity


def transform_json_items(json_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Transform JSON items to DynamoDB-compatible items.
    
    Args:
        json_items: List of JSON items from json_conversion handler
        
    Returns:
        List[Dict[str, Any]]: List of DynamoDB-compatible items
    """
    # Create TradingExecution instances
    executions = []
    for item in json_items:
        # Make a copy and remove class variables
        item_copy = item.copy()
        if 'FIELD_MAPPING' in item_copy:
            del item_copy['FIELD_MAPPING']
        executions.append(TradingExecution.from_json_item(item_copy))
    
    # Filter out invalid items and convert to DynamoDB format
    return [execution.to_dynamodb_dict() for execution in executions if execution.is_valid()]


def transform_dataframe(df: pd.DataFrame, 
                       symbol_conversion: Dict[str, str] = None) -> List[Dict[str, Any]]:
    """
    Transform a DataFrame into a list of DynamoDB-compatible items.
    
    Args:
        df: Pandas DataFrame
        symbol_conversion: Symbol conversion lookup table
        
    Returns:
        List[Dict[str, Any]]: List of DynamoDB-compatible items
    """
    if symbol_conversion is None:
        symbol_conversion = {}
    
    # Process each row
    items = []
    for _, row in df.iterrows():
        # Convert row to dictionary
        row_dict = {str(k): v for k, v in row.items()}
        
        # Create TradingExecution instance
        execution = TradingExecution.from_original_data(row_dict, symbol_conversion)
        
        # Add to items if valid
        if execution.is_valid():
            items.append(execution.to_dynamodb_dict())
    
    return items