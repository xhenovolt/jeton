/**
 * Valuation and Financial Calculation Utilities
 * 
 * Core business logic for:
 * - Asset depreciation
 * - IP valuation
 * - Company valuations
 * - Net worth calculations
 */

/**
 * Calculate depreciation for a given period
 * 
 * @param {number} acquisitionCost - Original cost
 * @param {number} depreciationRate - Annual rate (0-100)
 * @param {string} method - 'straight_line', 'accelerated', 'units_of_production'
 * @param {number} years - Years since acquisition
 * @param {number} unitsProduced - For units_of_production method
 * @param {number} totalUnitsExpected - For units_of_production method
 * @returns {number} Depreciation amount
 */
export function calculateDepreciation(
  acquisitionCost,
  depreciationRate,
  method = 'straight_line',
  years = 1,
  unitsProduced = 0,
  totalUnitsExpected = 0
) {
  const cost = parseFloat(acquisitionCost);
  const rate = parseFloat(depreciationRate) / 100;

  switch (method) {
    case 'straight_line':
      // Annual depreciation = Cost × Rate
      return cost * rate * years;

    case 'accelerated':
      // Double declining balance
      const annualRate = rate * 2;
      let accumulated = 0;
      let bookValue = cost;
      for (let i = 0; i < years; i++) {
        const yearlyDepreciation = bookValue * annualRate;
        accumulated += yearlyDepreciation;
        bookValue -= yearlyDepreciation;
      }
      return accumulated;

    case 'units_of_production':
      // Cost per unit × units produced
      if (totalUnitsExpected <= 0) return 0;
      const costPerUnit = cost / totalUnitsExpected;
      return costPerUnit * (unitsProduced || 0);

    default:
      return cost * rate * years;
  }
}

/**
 * Calculate current book value of an asset
 * 
 * @param {number} acquisitionCost
 * @param {number} accumulatedDepreciation
 * @returns {number} Book value
 */
export function calculateBookValue(acquisitionCost, accumulatedDepreciation) {
  const bookValue = parseFloat(acquisitionCost) - parseFloat(accumulatedDepreciation);
  return Math.max(0, bookValue); // Book value can't be negative
}

/**
 * Calculate asset carrying value for financial statements
 * 
 * @param {Object} asset - Asset object
 * @returns {number} Carrying value
 */
export function getAssetCarryingValue(asset) {
  return calculateBookValue(asset.acquisition_cost, asset.accumulated_depreciation);
}

/**
 * Calculate total assets book value
 * 
 * @param {Array} assets - Array of asset objects
 * @returns {number} Total book value
 */
export function calculateTotalAssetsBookValue(assets) {
  return assets.reduce((sum, asset) => {
    return sum + getAssetCarryingValue(asset);
  }, 0);
}

/**
 * Calculate IP portfolio value
 * 
 * @param {Array} ipItems - Array of IP objects
 * @returns {number} Total strategic IP valuation
 */
export function calculateTotalIPValuation(ipItems) {
  return ipItems.reduce((sum, ip) => {
    const valuation = parseFloat(ip.valuation_estimate || 0);
    return sum + valuation;
  }, 0);
}

/**
 * Calculate infrastructure replacement value
 * 
 * @param {Array} infrastructure - Array of infrastructure objects
 * @returns {number} Total replacement cost
 */
export function calculateInfrastructureValue(infrastructure) {
  return infrastructure.reduce((sum, infra) => {
    const cost = parseFloat(infra.replacement_cost || 0);
    return sum + cost;
  }, 0);
}

/**
 * Calculate accounting net worth
 * (Assets - Liabilities, using only accounting values)
 * 
 * @param {number} totalAssetsBookValue
 * @param {number} totalLiabilities
 * @returns {number} Accounting net worth
 */
export function calculateAccountingNetWorth(totalAssetsBookValue, totalLiabilities) {
  return parseFloat(totalAssetsBookValue) - parseFloat(totalLiabilities);
}

/**
 * Calculate strategic company value
 * (Accounting net worth + IP valuation + infrastructure value)
 * 
 * @param {number} accountingNetWorth
 * @param {number} totalIPValuation
 * @param {number} totalInfrastructureValue
 * @returns {number} Strategic company value
 */
export function calculateStrategicCompanyValue(
  accountingNetWorth,
  totalIPValuation = 0,
  totalInfrastructureValue = 0
) {
  return (
    parseFloat(accountingNetWorth) +
    parseFloat(totalIPValuation || 0) +
    parseFloat(totalInfrastructureValue || 0)
  );
}

/**
 * Get IP revenue multiple
 * Useful for valuation using revenue multiples
 * 
 * @param {number} monthlyRevenue
 * @param {number} multiple - Revenue multiple (e.g., 5, 10, 20)
 * @returns {number} Valuation based on revenue
 */
export function calculateIPValueByRevenue(monthlyRevenue, multiple = 10) {
  const annual = parseFloat(monthlyRevenue) * 12;
  return annual * multiple;
}

/**
 * Calculate IP valuation status
 * Returns color coding for UI
 * 
 * @param {number} valuation
 * @param {number} developmentCost
 * @returns {string} Status: 'above_cost', 'at_cost', 'below_cost'
 */
export function getIPValuationStatus(valuation, developmentCost) {
  const val = parseFloat(valuation || 0);
  const cost = parseFloat(developmentCost);

  if (val > cost * 1.5) return 'above_cost';
  if (val >= cost * 0.5) return 'at_cost';
  return 'below_cost';
}

/**
 * Calculate years until asset fully depreciated
 * 
 * @param {number} acquisitionCost
 * @param {number} accumulatedDepreciation
 * @param {number} depreciationRate - Annual percentage (0-100)
 * @returns {number} Years remaining
 */
export function calculateYearsToFullDepreciation(
  acquisitionCost,
  accumulatedDepreciation,
  depreciationRate
) {
  const remaining = parseFloat(acquisitionCost) - parseFloat(accumulatedDepreciation);
  if (remaining <= 0) return 0;

  const annualDepreciation = (parseFloat(acquisitionCost) * parseFloat(depreciationRate)) / 100;
  if (annualDepreciation <= 0) return Infinity;

  return remaining / annualDepreciation;
}

/**
 * Format currency for display
 * 
 * @param {number} value
 * @param {string} currency - ISO currency code (default: 'USD')
 * @returns {string} Formatted currency
 */
export function formatCurrency(value, currency = 'USD') {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
}

/**
 * Get valuation summary
 * Returns complete financial overview
 * 
 * @param {Object} params - { assets, liabilities, ip, infrastructure }
 * @returns {Object} Complete valuation summary
 */
export function getValuationSummary({ assets = [], liabilities = 0, ip = [], infrastructure = [] }) {
  const totalAssetsBookValue = calculateTotalAssetsBookValue(assets);
  const totalIPValuation = calculateTotalIPValuation(ip);
  const totalInfrastructureValue = calculateInfrastructureValue(infrastructure);
  const accountingNetWorth = calculateAccountingNetWorth(totalAssetsBookValue, liabilities);
  const strategicCompanyValue = calculateStrategicCompanyValue(
    accountingNetWorth,
    totalIPValuation,
    totalInfrastructureValue
  );

  return {
    totalAssetsBookValue,
    totalIPValuation,
    totalInfrastructureValue,
    totalLiabilities: liabilities,
    accountingNetWorth,
    strategicCompanyValue,
    valuationDifference: strategicCompanyValue - accountingNetWorth,
  };
}

export default {
  calculateDepreciation,
  calculateBookValue,
  getAssetCarryingValue,
  calculateTotalAssetsBookValue,
  calculateTotalIPValuation,
  calculateInfrastructureValue,
  calculateAccountingNetWorth,
  calculateStrategicCompanyValue,
  calculateIPValueByRevenue,
  getIPValuationStatus,
  calculateYearsToFullDepreciation,
  formatCurrency,
  getValuationSummary,
};
