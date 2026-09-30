import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

/**
 * ESLint (flat config). Baseline: Next.js core-web-vitals + react-hooks.
 * The existing codebase predates linting, so the noisiest legacy rules are
 * warnings for now; tighten them to errors as each area is cleaned up.
 */
export default [
  ...nextCoreWebVitals,
  {
    ignores: [
      '.next/**', 'node_modules/**', 'public/**', 'Backup/**', 'Documentation/**',
      'scripts/**', 'migrations/**', '*.mjs', '*.cjs',
    ],
  },
  {
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-img-element': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      'import/no-anonymous-default-export': 'warn',
      'jsx-a11y/alt-text': 'warn',
      // React-Compiler advisory rules: valid guidance, but not bugs in the
      // existing code. Warn until each area is refactored.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
];
