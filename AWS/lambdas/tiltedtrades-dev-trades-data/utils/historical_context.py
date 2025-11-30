"""
Historical Context Service

This module provides functionality to retrieve and process historical trading data
from DynamoDB to calculate running position quantities, trade sequences, and status.
"""

import logging
import boto3
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal
from datetime import datetime
from utils.config import Config

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


class HistoricalContextService:
    """Service to manage historical trading context from DynamoDB"""

    def __init__(self):
        """Initialize DynamoDB resource"""
        self.dynamodb = boto3.resource('dynamodb', region_name=Config.REGION)
        self.table = self.dynamodb.Table(Config.TRADING_TABLE)

    def get_all_historical_trades(self, user_id: str = None) -> List[Dict[str, Any]]:
        """
        Retrieve all historical trades from TradingExecutions table for a specific user.

        NOTE: This is the fallback method for full scans. Use get_relevant_trades_for_symbols()
        for optimized queries when you know which symbols are in the new batch.

        Args:
            user_id: The userId to filter trades for (required for multi-user support)

        Returns:
            List[Dict]: All trading execution records from DynamoDB for the specified user
        """
        try:
            if not user_id:
                logger.error("userId is required for get_all_historical_trades")
                return []

            # Query using partition key (userId) instead of scanning entire table
            response = self.table.query(
                KeyConditionExpression='userId = :userId',
                ExpressionAttributeValues={':userId': user_id}
            )
            items = response.get('Items', [])

            # Handle pagination
            while 'LastEvaluatedKey' in response:
                response = self.table.query(
                    KeyConditionExpression='userId = :userId',
                    ExpressionAttributeValues={':userId': user_id},
                    ExclusiveStartKey=response['LastEvaluatedKey']
                )
                items.extend(response.get('Items', []))

            logger.info(f"Retrieved {len(items)} historical trades for userId: {user_id}")
            return items

        except Exception as e:
            logger.error(f"Error retrieving historical trades for user {user_id}: {str(e)}")
            return []

    def get_relevant_trades_for_symbols(self, user_id: str, symbols: List[str], max_trades_per_symbol: int = 1000) -> List[Dict[str, Any]]:
        """
        Retrieve only the relevant historical trades needed for position calculations for a specific user.

        For each symbol, queries user's trades and scans backwards from most recent trades until
        finding a trade where PositionQty = 0 (position closed).

        Args:
            user_id: The userId to filter trades for (required for multi-user support)
            symbols: List of CQGSymbol values to query
            max_trades_per_symbol: Maximum trades to retrieve per symbol before stopping

        Returns:
            List[Dict]: Relevant historical trades for position calculation
        """
        try:
            if not user_id:
                logger.error("userId is required for get_relevant_trades_for_symbols")
                return []

            all_relevant_trades = []

            for symbol in symbols:
                # Query using partition key (userId) with filter for symbol
                # This is much more efficient than scanning entire table
                response = self.table.query(
                    KeyConditionExpression='userId = :userId',
                    FilterExpression='CQGSymbol = :symbol',
                    ExpressionAttributeValues={
                        ':userId': user_id,
                        ':symbol': symbol
                    }
                )

                symbol_trades = response.get('Items', [])

                # Handle pagination - get all trades for this user/symbol
                while 'LastEvaluatedKey' in response:
                    response = self.table.query(
                        KeyConditionExpression='userId = :userId',
                        FilterExpression='CQGSymbol = :symbol',
                        ExpressionAttributeValues={
                            ':userId': user_id,
                            ':symbol': symbol
                        },
                        ExclusiveStartKey=response['LastEvaluatedKey']
                    )
                    new_items = response.get('Items', [])
                    symbol_trades.extend(new_items)

                # Sort chronologically
                sorted_symbol_trades = self.sort_trades_chronologically(symbol_trades)

                # Find trades up to last position close (PositionQty = 0)
                relevant_trades = self._get_trades_since_last_close(sorted_symbol_trades, symbol)
                all_relevant_trades.extend(relevant_trades)

            logger.info(f"Retrieved {len(all_relevant_trades)} relevant trades for userId: {user_id}")
            return all_relevant_trades

        except Exception as e:
            logger.error(f"Error retrieving relevant trades for user {user_id}: {str(e)}")
            logger.warning("Falling back to full user query...")
            return self.get_all_historical_trades(user_id)

    def _get_trades_since_last_close(self, sorted_trades: List[Dict[str, Any]], symbol: str) -> List[Dict[str, Any]]:
        """
        Get trades since the last position close (PositionQty = 0).

        Scans from the end (most recent) backwards until finding a trade where
        PositionQty = 0, then returns all trades from that point forward.

        Args:
            sorted_trades: Chronologically sorted trades for a symbol
            symbol: The CQGSymbol being processed

        Returns:
            List[Dict]: Trades since last position close
        """
        if not sorted_trades:
            return []

        # Check if trades already have PositionQty calculated
        has_position_qty = any('PositionQty' in trade for trade in sorted_trades)

        if not has_position_qty:
            # No PositionQty in historical data - need all trades to calculate from scratch
            return sorted_trades

        # Scan backwards to find last close
        last_close_index = -1

        for i in range(len(sorted_trades) - 1, -1, -1):
            trade = sorted_trades[i]
            position_qty = trade.get('PositionQty', None)

            # Convert Decimal to int if needed
            if position_qty is not None:
                from decimal import Decimal
                if isinstance(position_qty, Decimal):
                    position_qty = int(position_qty)

                if position_qty == 0:
                    # Found last close - check if this is a "To Close" status
                    status = trade.get('Status', '')
                    if 'To Close' in status:
                        last_close_index = i
                        break

        # If no close found, return all trades
        if last_close_index == -1:
            return sorted_trades

        # Return trades from after the last close
        relevant_trades = sorted_trades[last_close_index + 1:]
        return relevant_trades

    def sort_trades_chronologically(self, trades: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Sort trades chronologically by DBKey (TransactionID) if available,
        otherwise fallback to Date + Time.

        Args:
            trades: List of trade dictionaries

        Returns:
            List[Dict]: Sorted trades
        """
        try:
            # Check if DBKey exists in the trades
            has_dbkey = any('DBKey' in trade for trade in trades)

            if has_dbkey:
                # Sort by DBKey (TransactionID) - most reliable chronological order
                sorted_trades = sorted(
                    trades,
                    key=lambda x: self._parse_dbkey_for_sort(x.get('DBKey', 0))
                )
            else:
                # Fallback: Sort by Date first, then by Time
                # Use Date (not TradingDay) as it represents actual execution date/time
                sorted_trades = sorted(
                    trades,
                    key=lambda x: (
                        self._parse_date_for_sort(x.get('Date', '')),
                        self._parse_time_for_sort(x.get('Time', ''))
                    )
                )
            return sorted_trades

        except Exception as e:
            logger.error(f"Error sorting trades: {str(e)}")
            return trades

    def _parse_date_for_sort(self, date_str: str) -> str:
        """
        Convert date string to sortable format (YYYY-MM-DD).

        Args:
            date_str: Date string in various formats

        Returns:
            str: Date in YYYY-MM-DD format
        """
        if not date_str:
            return '1900-01-01'

        try:
            # Already in YYYY-MM-DD format
            if '-' in date_str and len(date_str.split('-')[0]) == 4:
                return date_str.split(' ')[0]  # Remove time if present

            # MM/DD/YYYY format
            if '/' in date_str:
                parts = date_str.split(' ')[0].split('/')
                if len(parts) == 3:
                    return f"{parts[2]}-{parts[0].zfill(2)}-{parts[1].zfill(2)}"

            return date_str

        except Exception:
            return '1900-01-01'

    def _parse_dbkey_for_sort(self, dbkey: Any) -> int:
        """
        Convert DBKey to sortable integer.

        Args:
            dbkey: DBKey value (can be int, str, Decimal, etc.)

        Returns:
            int: DBKey as integer for sorting
        """
        try:
            from decimal import Decimal

            if isinstance(dbkey, Decimal):
                return int(dbkey)
            elif isinstance(dbkey, (int, float)):
                return int(dbkey)
            elif isinstance(dbkey, str):
                # Try to convert string to int
                return int(float(dbkey))
            else:
                return 0
        except Exception:
            return 0

    def _parse_time_for_sort(self, time_str: str) -> str:
        """
        Convert time string to sortable format (HH:MM:SS.mmm).

        Args:
            time_str: Time string

        Returns:
            str: Time in sortable format
        """
        if not time_str:
            return '00:00:00.000'

        try:
            # Extract time portion if datetime
            if isinstance(time_str, str):
                # If it contains a space, it might be a datetime
                if ' ' in time_str:
                    time_str = time_str.split(' ')[1]
                return time_str

            return str(time_str)

        except Exception:
            return '00:00:00.000'

    def calculate_running_positions(self, sorted_trades: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Calculate running position quantities for each CQGSymbol.

        Args:
            sorted_trades: Chronologically sorted trades

        Returns:
            Dict[str, int]: Current position quantity for each CQGSymbol
        """
        positions = {}

        for trade in sorted_trades:
            symbol = trade.get('CQGSymbol', '')
            position_effect = trade.get('PositionEffect', 0)

            if isinstance(position_effect, Decimal):
                position_effect = int(position_effect)

            if symbol:
                positions[symbol] = positions.get(symbol, 0) + position_effect

        return positions

    def build_historical_context(self, user_id: str, symbols_in_batch: List[str] = None, exclude_dbkeys: set = None, max_dbkey: int = None) -> Dict[str, Any]:
        """
        Build complete historical context including:
        - All historical trades sorted chronologically for a specific user
        - Running position quantities by symbol

        Args:
            user_id: The userId to filter trades for (required for multi-user support)
            symbols_in_batch: Optional list of CQGSymbol values in the new batch.
                            If provided, only queries relevant trades for these symbols (optimized).
                            If None, performs full user query (fallback).
            exclude_dbkeys: Optional set of DBKey values to exclude from historical context.
                          This prevents double-counting when current batch is already in DynamoDB.
            max_dbkey: Optional maximum DBKey value. Only trades with DBKey < max_dbkey will be included.
                      This ensures we only use trades chronologically BEFORE the current batch.

        Returns:
            Dict containing:
                - trades: List of all trades sorted chronologically
                - positions: Dict of current positions by CQGSymbol
        """
        try:
            if not user_id:
                logger.error("userId is required for build_historical_context")
                return {
                    'trades': [],
                    'positions': {}
                }

            # Use optimized query if symbols provided, otherwise full user query
            if symbols_in_batch and len(symbols_in_batch) > 0:
                all_trades = self.get_relevant_trades_for_symbols(user_id, symbols_in_batch)
            else:
                all_trades = self.get_all_historical_trades(user_id)

            # Filter trades for position calculation
            # Step 1: Exclude trades that are in the current batch (exclude_dbkeys)
            # Step 2: Exclude trades that come AFTER the current batch (DBKey >= max_dbkey)
            original_count = len(all_trades)
            filtered_trades = []
            excluded_in_batch = 0
            excluded_after_batch = 0

            for trade in all_trades:
                dbkey = trade.get('DBKey', None)
                dbkey_str = str(dbkey)

                # Exclude if in current batch
                if exclude_dbkeys and dbkey_str in exclude_dbkeys:
                    excluded_in_batch += 1
                    continue

                # Exclude if after current batch (only if max_dbkey is specified)
                if max_dbkey is not None and dbkey is not None:
                    try:
                        from decimal import Decimal
                        if isinstance(dbkey, Decimal):
                            dbkey = int(dbkey)
                        elif isinstance(dbkey, str):
                            dbkey = int(float(dbkey))

                        if int(dbkey) >= max_dbkey:
                            excluded_after_batch += 1
                            continue
                    except (ValueError, TypeError):
                        # If we can't parse DBKey, include it (safe default)
                        pass

                filtered_trades.append(trade)

            all_trades = filtered_trades

            if excluded_in_batch > 0 or excluded_after_batch > 0:
                logger.info(f"Filtered historical trades for positions: {original_count} -> {len(all_trades)}")
                logger.info(f"  Excluded {excluded_in_batch} from current batch (prevent double-counting)")
                logger.info(f"  Excluded {excluded_after_batch} after current batch (maintain chronology)")

            if not all_trades:
                logger.warning("No historical trades found for positions (after exclusions)")
                return {
                    'trades': [],
                    'positions': {}
                }

            # Sort chronologically
            sorted_trades = self.sort_trades_chronologically(all_trades)

            # Calculate running positions (from filtered trades)
            positions = self.calculate_running_positions(sorted_trades)

            return {
                'trades': sorted_trades,
                'positions': positions
            }

        except Exception as e:
            logger.error(f"Error building historical context: {str(e)}")
            return {
                'trades': [],
                'positions': {}
            }

    def _calculate_sequence_counters(self, sorted_trades: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Calculate sequence counters based on existing Status fields.

        Args:
            sorted_trades: Chronologically sorted trades

        Returns:
            Dict[str, int]: Count of "To Open" sequences per TickerConversion
        """
        counters = {}

        for trade in sorted_trades:
            status = trade.get('Status', '')
            ticker = trade.get('TickerConversion', '')

            if ticker and 'To Open' in status:
                counters[ticker] = counters.get(ticker, 0) + 1

        return counters

    def _get_max_sequence_numbers(self, trades: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Get the maximum sequence number for each ticker from existing trades.

        Parses Sequence field (format: "TICKER-N") to extract the highest N for each ticker.
        This allows new trades to continue sequencing from the current maximum.

        Args:
            trades: List of trade dictionaries

        Returns:
            Dict[str, int]: Maximum sequence number per ticker
        """
        max_sequences = {}

        for trade in trades:
            sequence = trade.get('Sequence', '')
            if not sequence or not isinstance(sequence, str):
                continue

            # Parse sequence format: "TICKER-N"
            try:
                if '-' in sequence:
                    ticker, seq_num_str = sequence.rsplit('-', 1)  # rsplit in case ticker has dashes
                    seq_num = int(seq_num_str)

                    # Keep track of maximum sequence number for this ticker
                    if ticker not in max_sequences or seq_num > max_sequences[ticker]:
                        max_sequences[ticker] = seq_num
            except (ValueError, AttributeError):
                # Skip trades with invalid sequence format
                continue

        return max_sequences

    def calculate_position_qty_for_trade(self,
                                         cqg_symbol: str,
                                         position_effect: int,
                                         current_positions: Dict[str, int]) -> int:
        """
        Calculate PositionQty for a new trade.

        Args:
            cqg_symbol: The CQG symbol
            position_effect: The position effect of the new trade
            current_positions: Current running positions

        Returns:
            int: The new position quantity after this trade
        """
        current_qty = current_positions.get(cqg_symbol, 0)
        new_qty = current_qty + position_effect

        # Update the running position
        current_positions[cqg_symbol] = new_qty

        return new_qty

    def calculate_status_for_trade(self,
                                   cqg_symbol: str,
                                   ticker_conversion: str,
                                   position_qty: int,
                                   current_positions: Dict[str, int],
                                   is_first_occurrence: bool) -> str:
        """
        Calculate Status for a trade based on Excel formula logic.

        Formula logic:
        - If first occurrence of symbol OR position becomes 0: "To Open {Ticker}"
        - If PositionQty = 0 after trade: "To Close {Ticker}"
        - Otherwise: ""

        Args:
            cqg_symbol: The CQG symbol
            ticker_conversion: The ticker conversion symbol
            position_qty: Position quantity after this trade
            current_positions: Current running positions before this trade
            is_first_occurrence: Whether this is the first trade for this symbol

        Returns:
            str: Status string
        """
        # First occurrence is always "To Open"
        if is_first_occurrence:
            return f"To Open {ticker_conversion}"

        # If position becomes 0, it's "To Close"
        if position_qty == 0:
            return f"To Close {ticker_conversion}"

        # If previous position was 0, this is "To Open"
        previous_qty = current_positions.get(cqg_symbol, 0)
        if previous_qty == 0:
            return f"To Open {ticker_conversion}"

        # Otherwise, no status
        return ""

    def calculate_sequence_for_trade(self,
                                     ticker_conversion: str,
                                     status: str,
                                     sequence_counters: Dict[str, int]) -> str:
        """
        Calculate Sequence for a trade.

        Formula: {TickerConversion}-{Count of "To Open" for this ticker}

        Args:
            ticker_conversion: The ticker conversion symbol
            status: The status of this trade
            sequence_counters: Current sequence counters

        Returns:
            str: Sequence string
        """
        # If this is a "To Open" trade, increment the counter
        if 'To Open' in status:
            sequence_counters[ticker_conversion] = sequence_counters.get(ticker_conversion, 0) + 1

        # Get current count for this ticker
        count = sequence_counters.get(ticker_conversion, 0)

        return f"{ticker_conversion}-{count}"
