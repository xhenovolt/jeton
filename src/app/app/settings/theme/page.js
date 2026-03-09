'use client';

import { useContext, useState, useEffect, createContext } from 'react';
import { Palette, Sun, Moon, Check, Monitor } from 'lucide-react';

/**
 * Theme presets must match ThemeProvider exactly.
 * We read from the ThemeContext if available, or manage independently.
 */
const THEME_PRESETS = {
  'jeton-blue': { name: 'Jeton Blue', primary: '#3b82f6', accent: '#6366f1', sidebar: '#0f172a' },
  emerald: { name: 'Emerald', primary: '#10b981', accent: '#34d399', sidebar: '#022c22' },
  crimson: { name: 'Crimson', primary: '#ef4444', accent: '#f97316', sidebar: '#1c0a0a' },
  midnight: { name: 'Midnight', primary: '#8b5cf6', accent: '#a78bfa', sidebar: '#0c0a1d' },
  'futuristic-neon': { name: 'Futuristic Neon', primary: '#06b6d4', accent: '#22d3ee', sidebar: '#0a0f1a' },
};

export default function ThemeSettingsPage() {
  const [activePreset, setActivePreset] = useState('jeton-blue');
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('jeton-theme-preset');
    if (saved && THEME_PRESETS[saved]) setActivePreset(saved);
    const dm = localStorage.getItem('jeton-dark-mode');
    setIsDark(dm !== 'false');
  }, []);

  const applyPreset = (key) => {
    setActivePreset(key);
    localStorage.setItem('jeton-theme-preset', key);
    // Apply CSS variables directly
    const preset = THEME_PRESETS[key];
    if (preset) {
      document.documentElement.style.setProperty('--theme-primary', preset.primary);
      document.documentElement.style.setProperty('--theme-accent', preset.accent);
      document.documentElement.style.setProperty('--theme-sidebar', preset.sidebar);
      document.documentElement.style.setProperty('--theme-navbar', preset.sidebar);
    }
    // Dispatch event for ThemeProvider to pick up
    window.dispatchEvent(new CustomEvent('theme-preset-changed', { detail: key }));
  };

  const toggleDarkMode = (dark) => {
    setIsDark(dark);
    localStorage.setItem('jeton-dark-mode', String(dark));
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="p-6 space-y-8 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Palette size={24} style={{ color: 'var(--theme-primary, #3b82f6)' }} />
          Theme Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Customize the look and feel of your workspace</p>
      </div>

      {/* Dark Mode Toggle */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Appearance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => toggleDarkMode(true)}
            className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
              isDark ? 'border-white/[0.15] bg-white/[0.06]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-gray-900 border border-white/[0.1] flex items-center justify-center">
              <Moon size={20} className="text-blue-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Dark Mode</p>
              <p className="text-xs text-gray-500">Optimized for low-light environments</p>
            </div>
            {isDark && (
              <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--theme-primary, #3b82f6)' }}>
                <Check size={12} className="text-white" />
              </div>
            )}
          </button>

          <button
            onClick={() => toggleDarkMode(false)}
            className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
              !isDark ? 'border-white/[0.15] bg-white/[0.06]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <Sun size={20} className="text-amber-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Light Mode</p>
              <p className="text-xs text-gray-500">Classic bright interface</p>
            </div>
            {!isDark && (
              <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--theme-primary, #3b82f6)' }}>
                <Check size={12} className="text-white" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Color Presets */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Color Theme</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(THEME_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className={`relative flex flex-col p-4 rounded-xl border transition-all ${
                activePreset === key
                  ? 'border-white/[0.15] bg-white/[0.06]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              {/* Color preview */}
              <div className="flex gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg" style={{ background: preset.primary }} />
                <div className="w-8 h-8 rounded-lg" style={{ background: preset.accent }} />
                <div className="w-8 h-8 rounded-lg border border-white/[0.1]" style={{ background: preset.sidebar }} />
              </div>
              <p className="text-sm font-medium text-white">{preset.name}</p>
              {activePreset === key && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: preset.primary }}>
                  <Check size={12} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Preview</h2>
        <div className="flex gap-4 items-start">
          {/* Mini sidebar preview */}
          <div
            className="w-16 h-32 rounded-lg flex flex-col items-center py-3 gap-2"
            style={{ background: THEME_PRESETS[activePreset].sidebar }}
          >
            <div className="w-6 h-6 rounded" style={{ background: THEME_PRESETS[activePreset].primary }} />
            <div className="w-8 h-1.5 rounded-full bg-white/10" />
            <div className="w-8 h-1.5 rounded-full bg-white/10" />
            <div className="w-8 h-1.5 rounded-full" style={{ background: THEME_PRESETS[activePreset].primary + '40' }} />
            <div className="w-8 h-1.5 rounded-full bg-white/10" />
          </div>
          {/* Mini content preview */}
          <div className="flex-1 space-y-2">
            <div className="h-8 rounded-lg" style={{ background: THEME_PRESETS[activePreset].sidebar, borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 rounded-lg bg-white/[0.03] border border-white/[0.06]" />
              <div className="h-16 rounded-lg bg-white/[0.03] border border-white/[0.06]" />
              <div className="h-16 rounded-lg bg-white/[0.03] border border-white/[0.06]" />
            </div>
            <div className="h-24 rounded-lg bg-white/[0.02] border border-white/[0.06]" />
            <div className="flex gap-2">
              <div className="px-3 py-1.5 rounded-lg text-xs text-white font-medium" style={{ background: THEME_PRESETS[activePreset].primary }}>
                Primary
              </div>
              <div className="px-3 py-1.5 rounded-lg text-xs text-white font-medium" style={{ background: THEME_PRESETS[activePreset].accent }}>
                Accent
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
