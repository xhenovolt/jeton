/**
 * GET/POST /api/shares/price-history
 * Manage share price history and candlestick data
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await query(
      `
      SELECT 
        date,
        opening_price,
        closing_price,
        high_price,
        low_price,
        company_valuation,
        total_shares
      FROM share_price_history
      WHERE date >= $1
      ORDER BY date ASC
      `,
      [startDate.toISOString().split('T')[0]]
    );

    // Calculate statistics
    const prices = result.rows.map(r => parseFloat(r.closing_price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const currentPrice = prices[prices.length - 1];
    const previousPrice = prices[0];
    const priceChange = currentPrice - previousPrice;
    const percentChange = ((priceChange / previousPrice) * 100).toFixed(2);

    return Response.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        opening_price: parseFloat(row.opening_price || row.closing_price),
        closing_price: parseFloat(row.closing_price),
        high_price: parseFloat(row.high_price || row.closing_price),
        low_price: parseFloat(row.low_price || row.closing_price),
        company_valuation: parseFloat(row.company_valuation || 0),
        total_shares: parseInt(row.total_shares),
      })),
      statistics: {
        currentPrice: parseFloat(currentPrice),
        previousPrice: parseFloat(previousPrice),
        priceChange: parseFloat(priceChange),
        percentChange: parseFloat(percentChange),
        minPrice: parseFloat(minPrice),
        maxPrice: parseFloat(maxPrice),
        avgPrice: parseFloat(avgPrice),
        daysInPeriod: days,
      },
    });
  } catch (error) {
    console.error('Share price history GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      date,
      opening_price,
      closing_price,
      high_price,
      low_price,
      company_valuation,
      total_shares,
    } = body;

    // Validation
    if (!date || !closing_price) {
      return Response.json(
        { success: false, error: 'Date and closing price required' },
        { status: 400 }
      );
    }

    const result = await query(
      `
      INSERT INTO share_price_history (
        date, opening_price, closing_price, high_price, low_price, 
        company_valuation, total_shares
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (date) DO UPDATE SET
        opening_price = $2,
        closing_price = $3,
        high_price = $4,
        low_price = $5,
        company_valuation = $6,
        total_shares = $7
      RETURNING *
      `,
      [
        date,
        opening_price || closing_price,
        closing_price,
        high_price || closing_price,
        low_price || closing_price,
        company_valuation || null,
        total_shares || null,
      ]
    );

    return Response.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Share price history POST error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
