'use client';

import { useState } from 'react';
import { Save, Bell, Lock, Palette, Database, DollarSign } from 'lucide-react';
import { useCurrency } from '@/lib/currency-context';

/**
 * Settings Page
 * Application configuration and preferences
 */
export default function SettingsPage() {
  const { selectedCurrency, getAvailableCurrencies, getCurrencyMetadata, changeCurrency, lastUpdated, isLoading } = useCurrency();
  const [settings, setSettings] = useState({
    appName: 'Jeton',
    notifications: true,
    darkMode: false,
    autoSave: true,
    theme: 'ocean',
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCurrencyChange = (newCurrency) => {
    changeCurrency(newCurrency);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Configure application preferences</p>
        </div>

        {/* Success Message */}
        {saved && (
          <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg text-green-800">
            Settings saved successfully!
          </div>
        )}

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* General Settings */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Palette size={20} /> General
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Application Name</label>
                <input
                  type="text"
                  value={settings.appName}
                  onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Theme Color</label>
                <select
                  value={settings.theme}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ocean">Ocean (Blue)</option>
                  <option value="purple">Royal Purple</option>
                  <option value="forest">Forest Green</option>
                </select>
              </div>
            </div>
          </div>

          {/* Currency Settings */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <DollarSign size={20} /> Currency & Localization
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Preferred Currency</label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {getAvailableCurrencies().map((currency) => {
                    const meta = getCurrencyMetadata(currency);
                    return (
                      <option key={currency} value={currency}>
                        {currency} - {meta.name} ({meta.symbol})
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-muted-foreground mt-2">
                  All amounts are stored internally in UGX. Display currency can be changed anytime.
                </p>
              </div>

              {lastUpdated && (
                <div className="text-xs text-muted-foreground">
                  <p>Exchange rates last updated: {new Date(lastUpdated).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Bell size={20} /> Notifications
            </h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-foreground">Enable Notifications</span>
              </label>
            </div>
          </div>

          {/* Privacy & Security */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Lock size={20} /> Privacy & Security
            </h2>

            <div className="space-y-4">
              <button className="w-full px-4 py-2 border border-border rounded-lg hover:bg-muted text-foreground text-sm font-medium text-left">
                Change Password
              </button>
              <button className="w-full px-4 py-2 border border-border rounded-lg hover:bg-muted text-foreground text-sm font-medium text-left">
                Two-Factor Authentication
              </button>
            </div>
          </div>

          {/* Data Management */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Database size={20} /> Data Management
            </h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => setSettings({ ...settings, autoSave: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-foreground">Auto-save Changes</span>
              </label>
              <button className="w-full px-4 py-2 border border-border rounded-lg hover:bg-muted text-foreground text-sm font-medium text-left">
                Export Data
              </button>
              <button className="w-full px-4 py-2 border border-red-300 rounded-lg hover:bg-red-50 text-red-600 text-sm font-medium text-left">
                Clear Cache
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex justify-end gap-4">
          <button className="px-6 py-2 border border-border rounded-lg text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Save size={20} /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
