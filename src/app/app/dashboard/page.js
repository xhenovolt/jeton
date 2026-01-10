'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Zap, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import CurrencyDisplay, { CurrencyTotal } from '@/components/common/CurrencyDisplay';

/**
 * Dashboard - Executive Valuation Summary
 * Comprehensive view of company financial health and strategic value
 */
export default function DashboardPage() {
  const [valuation, setValuation] = useState(null);
  const [shareData, setShareData] = useState(null);
  const [salesMetrics, setSalesMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [valuationRes, sharesRes, salesRes] = await Promise.all([
        fetchWithAuth('/api/valuations'),
        fetchWithAuth('/api/shares'),
        fetchWithAuth('/api/sales/report'),
      ]);

      const valuationData = await valuationRes.json();
      const sharesData = await sharesRes.json();
      const salesData = await salesRes.json();

      if (valuationData.success) {
        setValuation(valuationData.data);
      }
      if (sharesData.success) {
        setShareData(sharesData.data);
      }
      if (salesData.success) {
        setSalesMetrics(salesData.data.metrics);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !valuation) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  const valuationDifference =
    (valuation.summary.strategic_company_value || 0) - (valuation.summary.accounting_net_worth || 0);
  
  const sharePrice = shareData && shareData.total_shares 
    ? (valuation.summary.strategic_company_value || 0) / shareData.total_shares 
    : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Company Valuation Dashboard</h1>
          <p className="text-muted-foreground">Real-time financial health and strategic value assessment</p>
        </div>

        {/* Primary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Accounting Net Worth */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-8 text-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-blue-100 text-sm font-semibold mb-2">ACCOUNTING NET WORTH</p>
                <p className="text-4xl font-bold">
                  <CurrencyDisplay amount={valuation.summary.accounting_net_worth || 0} className="text-white" />
                </p>
                <p className="text-blue-100 text-sm mt-2">Balance Sheet Foundation</p>
              </div>
              <DollarSign size={48} className="opacity-80" />
            </div>
            <div className="border-t border-blue-400/30 pt-4 text-sm">
              <div className="flex justify-between mb-2">
                <span>Total Assets:</span>
                <span><CurrencyDisplay amount={valuation.summary.total_assets_book_value || 0} className="text-white" /></span>
              </div>
              <div className="flex justify-between">
                <span>Total Liabilities:</span>
                <span><CurrencyDisplay amount={valuation.summary.total_liabilities || 0} className="text-white" /></span>
              </div>
            </div>
          </div>

          {/* Strategic Company Value */}
          <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg p-8 text-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-purple-100 text-sm font-semibold mb-2">STRATEGIC COMPANY VALUE</p>
                <p className="text-4xl font-bold">
                  <CurrencyDisplay amount={valuation.summary.strategic_company_value || 0} className="text-white" />
                </p>
                <p className="text-purple-100 text-sm mt-2">Executive Perspective</p>
              </div>
              <TrendingUp size={48} className="opacity-80" />
            </div>
            <div className="border-t border-purple-400/30 pt-4 text-sm">
              <div className="flex justify-between mb-2">
                <span>Net Worth Basis:</span>
                <span><CurrencyDisplay amount={valuation.summary.accounting_net_worth || 0} className="text-white" /></span>
              </div>
              <div className="flex justify-between">
                <span>+ Strategic IP Value:</span>
                <span><CurrencyDisplay amount={valuation.summary.total_ip_valuation || 0} className="text-white" /></span>
              </div>
            </div>
          </div>

          {/* Share Price Widget */}
          {shareData && (
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-lg p-8 text-white">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-emerald-100 text-sm font-semibold mb-2">SHARE PRICE</p>
                  <p className="text-4xl font-bold">
                    <CurrencyDisplay amount={sharePrice} className="text-white" />
                  </p>
                  <p className="text-emerald-100 text-sm mt-2">Per Share</p>
                </div>
                <TrendingUp size={48} className="opacity-80" />
              </div>
              <div className="border-t border-emerald-400/30 pt-4 text-sm">
                <div className="flex justify-between mb-2">
                  <span>Total Shares:</span>
                  <span>{(shareData.total_shares || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Allocated:</span>
                  <span>{(shareData.shares_allocated || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Sales Revenue Widget */}
          {salesMetrics && (
            <div className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg p-8 text-white">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-orange-100 text-sm font-semibold mb-2">REVENUE COLLECTED</p>
                  <p className="text-4xl font-bold">
                    <CurrencyDisplay amount={salesMetrics.total_collected || 0} className="text-white" />
                  </p>
                  <p className="text-orange-100 text-sm mt-2">This Period</p>
                </div>
                <DollarSign size={48} className="opacity-80" />
              </div>
              <div className="border-t border-orange-400/30 pt-4 text-sm">
                <div className="flex justify-between mb-2">
                  <span>Total Sales:</span>
                  <span><CurrencyDisplay amount={salesMetrics.total_revenue || 0} className="text-white" /></span>
                </div>
                <div className="flex justify-between">
                  <span>Outstanding:</span>
                  <span><CurrencyDisplay amount={salesMetrics.total_outstanding || 0} className="text-white" /></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Value Bridge */}
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <h2 className="text-lg font-bold text-foreground mb-6">Value Bridge Analysis</h2>
          <div className="space-y-4">
            {/* Starting point */}
            <div className="flex items-center gap-4">
              <div className="w-32 text-right">
                <p className="text-sm text-muted-foreground">Starting Point</p>
                <p className="text-xl font-bold text-foreground">
                  <CurrencyDisplay amount={valuation.summary.accounting_net_worth || 0} />
                </p>
              </div>
              <div className="flex-1 h-2 bg-muted rounded-full"></div>
              <span className="text-muted-foreground text-sm">Accounting Net Worth</span>
            </div>

            {/* IP Value Addition */}
            {(valuation.summary.total_ip_valuation || 0) > 0 && (
              <div className="flex items-center gap-4 pl-8">
                <div className="w-24 text-right">
                  <p className="text-sm text-green-600 font-semibold">+ <CurrencyDisplay amount={valuation.summary.total_ip_valuation || 0} /></p>
                </div>
                <div className="flex-1 h-1 bg-green-300 rounded-full"></div>
                <span className="text-muted-foreground text-sm">IP Assets</span>
              </div>
            )}

            {/* Infrastructure Value Addition */}
            {(valuation.summary.infrastructure_risk_coverage || 0) > 0 && (
              <div className="flex items-center gap-4 pl-8">
                <div className="w-24 text-right">
                  <p className="text-sm text-yellow-600 font-semibold">+ <CurrencyDisplay amount={valuation.summary.infrastructure_risk_coverage || 0} /></p>
                </div>
                <div className="flex-1 h-1 bg-yellow-300 rounded-full"></div>
                <span className="text-muted-foreground text-sm">Infrastructure Buffer</span>
              </div>
            )}

            {/* Final value */}
            <div className="flex items-center gap-4 border-t border-border pt-4">
              <div className="w-32 text-right">
                <p className="text-sm text-muted-foreground">Final Valuation</p>
                <p className="text-2xl font-bold text-purple-600">
                  <CurrencyDisplay amount={valuation.summary.strategic_company_value || 0} />
                </p>
              </div>
              <div className="flex-1 h-3 bg-purple-300 rounded-full"></div>
              <span className="text-muted-foreground text-sm">Strategic Value</span>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Assets Breakdown */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Zap size={20} className="text-primary" />
              Assets by Type
            </h3>
            <div className="space-y-3">
              {Object.entries(valuation.assetsByType || {}).map(([type, data]) => (
                <div key={type} className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{type}</p>
                    <p className="text-xs text-muted-foreground">{data.count} items</p>
                  </div>
                  <CurrencyDisplay amount={data.total || 0} className="text-sm font-bold text-foreground" />
                </div>
              ))}
              <div className="border-t border-border pt-3 flex justify-between">
                <p className="font-semibold text-foreground">Total Assets</p>
                <CurrencyDisplay amount={valuation.summary.total_assets_book_value || 0} className="font-bold text-foreground" />
              </div>
            </div>
          </div>

          {/* IP Breakdown */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-purple-600" />
              IP Value by Type
            </h3>
            <div className="space-y-3">
              {Object.entries(valuation.ipByType || {}).map(([type, data]) => (
                <div key={type} className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{data.count} items</p>
                  </div>
                  <CurrencyDisplay amount={data.total || 0} className="text-sm font-bold text-purple-600" />
                </div>
              ))}
              <div className="border-t border-border pt-3 flex justify-between">
                <p className="font-semibold text-foreground">Total IP Value</p>
                <CurrencyDisplay amount={valuation.summary.total_ip_valuation || 0} className="font-bold text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Infrastructure & Risk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Infrastructure by Risk */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-red-500" />
              Infrastructure by Risk Level
            </h3>
            <div className="space-y-3">
              {Object.entries(valuation.infrastructureByRisk || {}).map(([risk, data]) => {
                const riskColors = {
                  critical: 'text-red-600',
                  high: 'text-orange-600',
                  medium: 'text-yellow-600',
                  low: 'text-green-600',
                };
                return (
                  <div key={risk} className="flex justify-between items-center">
                    <p className={`capitalize font-medium ${riskColors[risk]}`}>{risk}</p>
                    <p className="text-sm font-bold text-foreground">{data.count || 0} items</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Summary Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Accounting Assets</span>
                <span className="font-bold text-foreground">{valuation.counts?.accounting_assets || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">IP Assets</span>
                <span className="font-bold text-foreground">{valuation.counts?.intellectual_property || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Infrastructure Items</span>
                <span className="font-bold text-foreground">{valuation.counts?.infrastructure || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Liabilities</span>
                <span className="font-bold text-foreground">{valuation.counts?.liabilities || 0}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="text-sm font-semibold text-foreground">Value Premium</span>
                <span className={`font-bold ${valuationDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <CurrencyDisplay amount={valuationDifference} />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
            <AlertCircle size={20} />
            Key Insights
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • Strategic company value is <CurrencyDisplay amount={valuationDifference} /> higher than accounting net worth
            </li>
            <li>
              • IP assets represent {((valuation.summary.total_ip_valuation || 0) / ((valuation.summary.strategic_company_value || 1)) * 100).toFixed(1)}% of strategic value
            </li>
            {(valuation.counts?.infrastructure || 0) > 0 && (
              <li>
                • {valuation.counts.infrastructure} infrastructure items support operational continuity
              </li>
            )}
            <li>• This dashboard updates automatically every 30 seconds</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
