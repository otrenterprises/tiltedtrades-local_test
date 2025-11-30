import logging
import traceback
from typing import Dict, Any, List, Optional
from models.trading_execution import TradingExecution, transform_dataframe
from utils.config import Config
from utils.historical_context import HistoricalContextService

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def convert_to_json(data: Dict[str, Any],
                   symbol_conversion: Dict[str, str] = None,
                   tick_values: Dict[str, Any] = None,
                   commissions: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Converts transformed data to JSON format for DynamoDB storage.

    This handler:
    1. Takes transformed data from the transformation handler
    2. Uses the TradingExecution model to convert to standardized format
    3. Creates JSON items ready for DynamoDB storage

    Args:
        data (dict): The transformed data with excel_data (DataFrame)
        symbol_conversion (dict): Symbol conversion lookup table
        tick_values (dict): Tick values lookup table for notional value calculation
        commissions (dict): Commissions lookup table for fees calculation

    Returns:
        dict: Conversion result with success/failure status and JSON items if successful
    """
    try:
        # MODIFICATION 3: Extract userId from data
        user_id = data.get('userId')
        if not user_id:
            logger.error("userId not found in data")
            return {
                'success': False,
                'message': 'userId is required but was not provided'
            }

        logger.info(f"Processing JSON conversion for userId: {user_id}")

        # Extract the DataFrame from the data object
        df = data.get('excel_data')

        if df is None or len(df) == 0:
            return {
                'success': False,
                'message': 'No data available for JSON conversion'
            }

        # Initialize lookup tables if None
        if symbol_conversion is None:
            symbol_conversion = {}
            logger.warning("Symbol conversion table not provided, using empty dictionary")
        if tick_values is None:
            tick_values = {}
            logger.warning("Tick values table not provided, using empty dictionary")
        if commissions is None:
            commissions = {}
            logger.warning("Commissions table not provided, using empty dictionary")
        
        logger.info(f"Starting JSON conversion for {len(df)} rows")

        # Extract unique CQGSymbols from the batch for optimized querying
        unique_symbols = df['Orders_OrderFills_SymbolCommodity'].unique().tolist() if 'Orders_OrderFills_SymbolCommodity' in df.columns else []
        logger.info(f"Batch contains {len(unique_symbols)} unique symbols: {unique_symbols}")

        # Extract DBKeys from current batch to exclude from historical context
        # This prevents double-counting when the batch has already been written to DynamoDB
        current_batch_dbkeys = set()
        min_batch_dbkey = None
        if 'Orders_Transactions_TransactionID' in df.columns:
            dbkeys = df['Orders_Transactions_TransactionID'].dropna()
            current_batch_dbkeys = set(dbkeys.astype(str).tolist())
            # Find minimum DBKey to establish chronological cutoff
            min_batch_dbkey = int(dbkeys.min()) if len(dbkeys) > 0 else None
            logger.info(f"Current batch: {len(current_batch_dbkeys)} DBKeys, min DBKey: {min_batch_dbkey}")
            logger.info(f"Will exclude current batch and ignore trades after DBKey {min_batch_dbkey}")

        # Initialize historical context service with optimized query
        logger.info(f"Initializing historical context from DynamoDB for userId: {user_id} (optimized query)...")
        context_service = HistoricalContextService()
        historical_context = context_service.build_historical_context(
            user_id=user_id,  # MODIFICATION: Pass userId to filter historical trades
            symbols_in_batch=unique_symbols,
            exclude_dbkeys=current_batch_dbkeys,
            max_dbkey=min_batch_dbkey  # Only use trades BEFORE current batch
        )

        # Extract context components (these are mutable dicts that will be updated as we process)
        historical_positions = historical_context['positions'].copy()  # Running position quantities
        # Initialize symbol_occurrence_tracker with symbols that have historical positions
        # This ensures the first trade in the current batch doesn't get marked as "To Open"
        # if the symbol already has an open position from prior batches
        symbol_occurrence_tracker = {symbol: 1 for symbol in historical_positions.keys()}

        # Initialize P&L accumulator for calculating PnLPerPosition
        pnl_accumulators = {}  # Will track running NotionalValue sum per ticker

        logger.info(f"Historical context loaded: {len(historical_positions)} symbols, "
                   f"{len(historical_context['trades'])} historical trades")

        # Sort DataFrame by DBKey (TransactionID) to ensure chronological processing
        if 'Orders_Transactions_TransactionID' in df.columns:
            df = df.sort_values('Orders_Transactions_TransactionID')
            logger.info("Sorted batch by TransactionID for chronological processing")

        # Use the TradingExecution model to transform the DataFrame into JSON items
        json_items = []

        # Process each row in the DataFrame and create TradingExecution instances
        for _, row in df.iterrows():
            try:
                # Convert row to dictionary
                row_dict = {str(k): v for k, v in row.items()}

                # Create TradingExecution instance with all lookup tables and historical context
                execution = TradingExecution.from_original_data(
                    row_dict,
                    symbol_conversion,
                    tick_values,
                    commissions,
                    historical_positions,
                    symbol_occurrence_tracker,
                    pnl_accumulators  # Pass P&L accumulator
                )

                # Add to items if valid
                if execution.is_valid():
                    # Convert to dict for JSON serialization
                    execution_dict = execution.to_dict()
                    # Add userId to execution
                    execution_dict['userId'] = user_id
                    json_items.append(execution_dict)

            except Exception as row_error:
                # Log error but continue processing other rows
                logger.error(f"Error processing row: {str(row_error)}")
                logger.error(traceback.format_exc())
        
        logger.info(f"Successfully converted {len(json_items)} rows to JSON format")
        
        return {
            'success': True,
            'message': f'Successfully converted {len(json_items)} rows to JSON format',
            'data': json_items,
            'items_converted': len(json_items)
        }
        
    except Exception as e:
        error_msg = f"Error in JSON conversion: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'message': error_msg
        }