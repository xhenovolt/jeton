'use client';

/**
 * Theme Provider - Jeton Global Theming System
 * Manages theme presets, dark mode, and CSS variable injection
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const THEME_PRESETS = {
  'jeton-blue': {
    name: 'Jeton Blue',
    primary: '#3b82f6',
    sidebar: '#0f172a',
    navbar: '#0f172a',
    accent: '#6366f1',
    contentBg: '#f8fafc',
    contentBgDark: '#0a0a0a',
  },
  emerald: {
    name: 'Emerald',
    primary: '#10b981',
    sidebar: '#022c22',
    navbar: '#022c22',
    accent: '#34d399',
    contentBg: '#f0fdf4',
    contentBgDark: '#0a0a0a',
  },
  crimson: {
    name: 'Crimson',
    primary: '#ef4444',
    sidebar: '#1c0a0a',
    navbar: '#1c0a0a',
    accent: '#f97316',
    contentBg: '#fef2f2',
    contentBgDark: '#0a0a0a',
  },
  midnight: {
    name: 'Midnight',
    primary: '#8b5cf6',
    sidebar: '#0c0a1d',
    navbar: '#0c0a1d',
    accent: '#a78bfa',
    contentBg: '#faf5ff',
    contentBgDark: '#09090b',
  },
  'futuristic-neon': {
    name: 'Futuristic Neon',
    primary: '#06b6d4',
    sidebar: '#0a0f1a',
    navbar: '#0a0f1a',
    accent: '#22d3ee',
    contentBg: '#f0fdfa',
    contentBgDark: '#030712',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('jeton-blue');
  const [darkMode, setDarkModeState] = useState(true);
  const [customColors, setCustomColors] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('jeton-theme') || 'jeton-blue';
    const savedDark = localStorage.getItem('jeton-dark-mode');
    const savedCustom = localStorage.getItem('jeton-custom-colors');

    setThemeState(savedTheme);
    setDarkModeState(savedDark !== 'false');
    if (savedCustom) {
      try { setCustomColors(JSON.parse(savedCustom)); } catch (_) {}
    }
    setMounted(true);
  }, []);

  // Apply dark mode class and CSS variables
  useEffect(() => {
    if (!mounted) return;

    const html = document.documentElement;

    // Dark mode
    if (darkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem('jeton-dark-mode', String(darkMode));

    // Theme CSS variables
    const colors = customColors || THEME_PRESETS[theme] || THEME_PRESETS['jeton-blue'];
    html.style.setProperty('--theme-primary', colors.primary);
    html.style.setProperty('--theme-sidebar', colors.sidebar);
    html.style.setProperty('--theme-navbar', colors.navbar);
    html.style.setProperty('--theme-accent', colors.accent);
    html.style.setProperty('--theme-content-bg', darkMode ? (colors.contentBgDark || '#0a0a0a') : (colors.contentBg || '#f8fafc'));

    localStorage.setItem('jeton-theme', theme);
    if (customColors) {
      localStorage.setItem('jeton-custom-colors', JSON.stringify(customColors));
    }
  }, [theme, darkMode, customColors, mounted]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    setCustomColors(null);
    localStorage.removeItem('jeton-custom-colors');
  }, []);

  const setDarkMode = useCallback((dm) => {
    setDarkModeState(dm);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkModeState(prev => !prev);
  }, []);

  const setCustomTheme = useCallback((colors) => {
    setCustomColors(colors);
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      darkMode,
      setDarkMode,
      toggleDarkMode,
      customColors,
      setCustomTheme,
      presets: THEME_PRESETS,
      mounted,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export { THEME_PRESETS };
