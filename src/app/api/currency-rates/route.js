/**
 * GET /api/currency-rates
 * Fetch latest exchange rates with caching
 * Converts UGX to other currencies
 */

import { NextResponse } from 'next/server.js';

// In-memory cache for exchange rates
let ratesCache = {
  rates: null,
  timestamp: null,
  ttl: 60 * 60 * 1000, // 1 hour in milliseconds
};

/**
 * Fetch exchange rates from external API
 * Using exchangerate.host (free, no API key required)
 */
async function fetchExchangeRates() {
  try {
    // Check if cache is still valid
    if (
      ratesCache.rates &&
      ratesCache.timestamp &&
      Date.now() - ratesCache.timestamp < ratesCache.ttl
    ) {
      console.log('📦 Using cached exchange rates');
      return ratesCache.rates;
    }

    console.log('🔄 Fetching fresh exchange rates from API');

    // Fetch rates from exchangerate.host (free API, no authentication needed)
    const response = await fetch(
      'https://api.exchangerate.host/latest?base=UGX&symbols=USD,EUR,GBP,JPY,CAD,AUD,CHF,INR,ZAR,KES',
      {
        headers: {
          'User-Agent': 'Jeton-Finance/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.rates || typeof data.rates !== 'object') {
      throw new Error('Invalid API response format');
    }

    // Ensure UGX is included as base (rate = 1)
    const rates = {
      UGX: 1,
      ...data.rates,
    };

    // Update cache
    ratesCache = {
      rates,
      timestamp: Date.now(),
      ttl: ratesCache.ttl,
    };

    console.log('✅ Exchange rates fetched and cached');
    return rates;
  } catch (error) {
    console.error('❌ Error fetching exchange rates:', error.message);

    // If cache exists but is expired, return it anyway
    if (ratesCache.rates) {
      console.log('⚠️ Returning stale cached rates due to API error');
      return ratesCache.rates;
    }

    // Fallback rates if API fails and no cache exists
    return {
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
  }
}

export async function GET(request) {
  try {
    // Optional: Allow query parameter to force refresh
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (forceRefresh) {
      console.log('🔄 Force refreshing exchange rates');
      ratesCache = { rates: null, timestamp: null, ttl: ratesCache.ttl };
    }

    const rates = await fetchExchangeRates();

    return NextResponse.json(
      {
        success: true,
        base: 'UGX',
        rates,
        timestamp: new Date().toISOString(),
        cacheExpiry: new Date(
          ratesCache.timestamp + ratesCache.ttl
        ).toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300', // 5 minute browser cache
        },
      }
    );
  } catch (error) {
    console.error('Currency rates error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch exchange rates',
        rates: {
          UGX: 1,
          USD: 0.00027,
        },
      },
      { status: 200 } // Return 200 with fallback rates
    );
  }
}
