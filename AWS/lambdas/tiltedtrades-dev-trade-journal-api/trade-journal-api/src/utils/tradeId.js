"use strict";
/**
 * Trade ID Utilities
 *
 * Helper functions for working with method-prefixed trade IDs.
 * Format: {calculationMethod}#{tradeId} (e.g., "fifo#123_456_0")
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildJournalTradeId = buildJournalTradeId;
exports.extractRawTradeId = extractRawTradeId;
exports.extractCalculationMethod = extractCalculationMethod;

/**
 * Build method-prefixed tradeId for journal storage
 * Format: {calculationMethod}#{tradeId} (e.g., "fifo#123_456_0")
 */
function buildJournalTradeId(tradeId, calculationMethod) {
    const method = calculationMethod || 'fifo';
    // If already prefixed, return as-is
    if (tradeId.startsWith('fifo#') || tradeId.startsWith('perPosition#')) {
        return tradeId;
    }
    return `${method}#${tradeId}`;
}

/**
 * Extract raw tradeId from method-prefixed format
 */
function extractRawTradeId(prefixedTradeId) {
    if (prefixedTradeId.startsWith('fifo#')) {
        return prefixedTradeId.substring(5);
    }
    if (prefixedTradeId.startsWith('perPosition#')) {
        return prefixedTradeId.substring(12);
    }
    return prefixedTradeId;
}

/**
 * Extract calculationMethod from method-prefixed format
 */
function extractCalculationMethod(prefixedTradeId) {
    if (prefixedTradeId.startsWith('fifo#')) {
        return 'fifo';
    }
    if (prefixedTradeId.startsWith('perPosition#')) {
        return 'perPosition';
    }
    return 'fifo'; // default
}
