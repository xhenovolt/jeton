/**
 * Currency Context
 * Manages global currency state, exchange rates, and conversions
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CurrencyContext = createContext(null);

/**
 * Default exchange rates (fallback if API fails)
 */
const DEFAULT_RATES = {
  UGX: 1,
  USD: 0.00027,
  EUR: 0.00025,
  GBP: 0.00021,
  JPY: 0.041,
  CAD: 0.00038,
  AUD: 0.00042,
  CHF: 0.00024,
  INR: 0.023,
  ZAR: 0.0053,
  KES: 0.035,
};

/**
 * Currency metadata (symbols, names, etc.)
 */
const CURRENCY_METADATA = {
  UGX: { symbol: 'UGX', name: 'Ugandan Shilling', decimals: 0 },
  USD: { symbol: '$', name: 'US Dollar', decimals: 2 },
  EUR: { symbol: '€', name: 'Euro', decimals: 2 },
  GBP: { symbol: '£', name: 'British Pound', decimals: 2 },
  JPY: { symbol: '¥', name: 'Japanese Yen', decimals: 0 },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', decimals: 2 },
  AUD: { symbol: 'A$', name: 'Australian Dollar', decimals: 2 },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', decimals: 2 },
  INR: { symbol: '₹', name: 'Indian Rupee', decimals: 2 },
  ZAR: { symbol: 'R', name: 'South African Rand', decimals: 2 },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling', decimals: 0 },
};

const STORAGE_KEY = 'jeton_preferred_currency';

export function CurrencyProvider({ children }) {
  const [selectedCurrency, setSelectedCurrency] = useState('UGX');
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  // Load preferred currency from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && CURRENCY_METADATA[stored]) {
      setSelectedCurrency(stored);
    }
  }, []);

  // Fetch exchange rates
  const fetchRates = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const query = forceRefresh ? '?refresh=true' : '';
      const response = await fetch(`/api/currency-rates${query}`);
      const data = await response.json();

      if (data.rates) {
        setRates(data.rates);
        setLastUpdated(new Date(data.timestamp));
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch exchange rates:', err);
      setError('Failed to fetch exchange rates');
      // Keep using previous rates
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch rates on mount and set up interval
  useEffect(() => {
    fetchRates();

    // Refresh rates every hour
    const interval = setInterval(() => {
      fetchRates();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchRates]);

  /**
   * Convert an amount from UGX to selected currency
   * @param {number} amountInUGX - Amount in UGX (stored value)
   * @returns {number} Converted amount
   */
  const convert = useCallback(
    (amountInUGX) => {
      if (!amountInUGX || !rates[selectedCurrency]) {
        return 0;
      }
      return amountInUGX * rates[selectedCurrency];
    },
    [rates, selectedCurrency]
  );

  /**
   * Convert from selected currency back to UGX
   * @param {number} amount - Amount in selected currency
   * @returns {number} Amount in UGX
   */
  const convertToUGX = useCallback(
    (amount) => {
      if (!amount || !rates[selectedCurrency]) {
        return 0;
      }
      return amount / rates[selectedCurrency];
    },
    [rates, selectedCurrency]
  );

  /**
   * Format a UGX amount as display string in selected currency
   * @param {number} amountInUGX - Amount in UGX
   * @param {boolean} showCurrencyCode - Show code instead of symbol
   * @returns {string} Formatted string
   */
  const formatCurrency = useCallback(
    (amountInUGX, showCurrencyCode = false) => {
      const converted = convert(amountInUGX);
      const meta = CURRENCY_METADATA[selectedCurrency];

      if (!meta) return `${amountInUGX}`;

      const formatted = converted.toLocaleString('en-US', {
        minimumFractionDigits: meta.decimals,
        maximumFractionDigits: meta.decimals,
      });

      const display = showCurrencyCode ? meta.symbol : meta.symbol;
      return `${display}${formatted}`;
    },
    [convert, selectedCurrency]
  );

  /**
   * Change the selected currency and save preference
   * @param {string} currency - Currency code (UGX, USD, etc.)
   */
  const changeCurrency = useCallback((currency) => {
    if (CURRENCY_METADATA[currency]) {
      setSelectedCurrency(currency);
      localStorage.setItem(STORAGE_KEY, currency);
    }
  }, []);

  /**
   * Get available currencies
   * @returns {Array} Array of currency codes
   */
  const getAvailableCurrencies = useCallback(() => {
    return Object.keys(CURRENCY_METADATA);
  }, []);

  /**
   * Get currency metadata
   * @param {string} currency - Currency code
   * @returns {Object} Currency metadata
   */
  const getCurrencyMetadata = useCallback((currency) => {
    return CURRENCY_METADATA[currency] || null;
  }, []);

  const value = {
    selectedCurrency,
    rates,
    isLoading,
    lastUpdated,
    error,
    convert,
    convertToUGX,
    formatCurrency,
    changeCurrency,
    getAvailableCurrencies,
    getCurrencyMetadata,
    fetchRates,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

/**
 * Hook to use currency context
 * @throws {Error} If used outside CurrencyProvider
 * @returns {Object} Currency context value
 */
export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
}

export default CurrencyContext;
