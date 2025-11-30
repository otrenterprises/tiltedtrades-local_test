"""
Calculation Utilities

This module provides calculation functions for trading data fields including:
- Commission/Fees calculation based on symbol and tier
- Notional value calculation based on contract specifications
"""

import logging
from decimal import Decimal
from datetime import datetime
from typing import Dict, Any, Optional
from utils.config import Config

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def calculate_commission(ticker_symbol: str, quantity: int, trade_date: datetime,
                        commissions_data: Dict[str, Any]) -> Decimal:
    """
    Calculate commission/fees for a trade based on ticker symbol and quantity.

    Uses the configured COMMISSION_TIER (default: 'fixed', which uses tier 3 rates).
    Commission tiers are valid for all traders of this broker (multi-user).
    Future enhancement: User-specific tier will be stored in UserPreferencesTable.

    Args:
        ticker_symbol (str): The ticker symbol (e.g., "MES", "NQ")
        quantity (int): The quantity traded (can be positive or negative)
        trade_date (datetime): The date of the trade (kept for compatibility, not used)
        commissions_data (dict): The loaded commissions.json data

    Returns:
        Decimal: The commission amount (negative value representing cost)
    """
    try:
        # Use configured tier (default: 'fixed')
        tier = Config.COMMISSION_TIER

        # Handle 'fixed' tier by using tier 3 rates (as defined in commissions.json)
        if tier == 'fixed':
            tier = '3'

        # Get broker data (currently only AMP in the file)
        broker_data = commissions_data.get('AMP', {})
        rates = broker_data.get('rates', {})

        # Get the symbol's commission rates
        symbol_rates = rates.get(ticker_symbol, {})
        if not symbol_rates:
            logger.warning(f"Commission rates not found for symbol: {ticker_symbol}")
            return Decimal('0')

        # Get the tiers for this symbol
        tiers = symbol_rates.get('tiers', {})
        commission_rate = tiers.get(tier)

        if commission_rate is None:
            logger.warning(f"Commission rate not found for symbol {ticker_symbol}, tier {tier}")
            return Decimal('0')

        # Calculate commission: -1 * rate * abs(quantity)
        # Negative because commissions are a cost
        commission = Decimal(str(commission_rate)) * abs(quantity) * Decimal('-1')

        return commission

    except Exception as e:
        logger.error(f"Error calculating commission for {ticker_symbol}: {str(e)}")
        return Decimal('0')


def calculate_notional_value(ticker_symbol: str, execution_price: Decimal,
                             position_effect: int, tick_values_data: Dict[str, Any]) -> Decimal:
    """
    Calculate the notional value of a trade.

    Formula: Multiplier * ExecutionPrice * PositionEffect * -1

    Args:
        ticker_symbol (str): The ticker symbol (e.g., "MES", "NQ")
        execution_price (Decimal): The execution price of the trade
        position_effect (int): The position effect (positive for buy, negative for sell)
        tick_values_data (dict): The loaded tick-values.json data

    Returns:
        Decimal: The notional value of the trade
    """
    try:
        # Get the symbol's contract specifications
        symbol_data = tick_values_data.get(ticker_symbol, {})
        if not symbol_data:
            logger.warning(f"Tick values not found for symbol: {ticker_symbol}")
            return Decimal('0')

        # Get the multiplier
        multiplier = symbol_data.get('multiplier')
        if multiplier is None:
            logger.warning(f"Multiplier not found for symbol: {ticker_symbol}")
            return Decimal('0')

        # Calculate notional value: Multiplier * ExecutionPrice * PositionEffect * -1
        notional = Decimal(str(multiplier)) * execution_price * Decimal(str(position_effect)) * Decimal('-1')

        return notional

    except Exception as e:
        logger.error(f"Error calculating notional value for {ticker_symbol}: {str(e)}")
        return Decimal('0')


def get_value_per_tick(ticker_symbol: str, tick_values_data: Dict[str, Any]) -> Optional[Decimal]:
    """
    Get the value per tick for a given symbol.

    Args:
        ticker_symbol (str): The ticker symbol (e.g., "MES", "NQ")
        tick_values_data (dict): The loaded tick-values.json data

    Returns:
        Decimal or None: The value per tick, or None if not found
    """
    try:
        symbol_data = tick_values_data.get(ticker_symbol, {})
        if not symbol_data:
            logger.warning(f"Tick values not found for symbol: {ticker_symbol}")
            return None

        value_per_tick = symbol_data.get('valuePerTick')
        if value_per_tick is None:
            logger.warning(f"Value per tick not found for symbol: {ticker_symbol}")
            return None

        return Decimal(str(value_per_tick))

    except Exception as e:
        logger.error(f"Error getting value per tick for {ticker_symbol}: {str(e)}")
        return None


def get_tick_size(ticker_symbol: str, tick_values_data: Dict[str, Any]) -> Optional[Decimal]:
    """
    Get the tick size for a given symbol.

    Args:
        ticker_symbol (str): The ticker symbol (e.g., "MES", "NQ")
        tick_values_data (dict): The loaded tick-values.json data

    Returns:
        Decimal or None: The tick size, or None if not found
    """
    try:
        symbol_data = tick_values_data.get(ticker_symbol, {})
        if not symbol_data:
            logger.warning(f"Tick values not found for symbol: {ticker_symbol}")
            return None

        tick_size = symbol_data.get('tickSize')
        if tick_size is None:
            logger.warning(f"Tick size not found for symbol: {ticker_symbol}")
            return None

        return Decimal(str(tick_size))

    except Exception as e:
        logger.error(f"Error getting tick size for {ticker_symbol}: {str(e)}")
        return None
