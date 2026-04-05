/**
 * Jeton Logo Component
 * Used in Navbar and Sidebar
 */

export function JetonIcon({ size = 32 }) {
  const px = typeof size === 'number' ? size : 32;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 125"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="jeton-logo-grad" x1="50" y1="0" x2="50" y2="125" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#46DC88" />
          <stop offset="100%" stopColor="#0A5D40" />
        </linearGradient>
      </defs>

      {/* Left leaf */}
      <path
        d="M54 42 C40 30 24 18 26 8 C36 12 50 28 54 42Z"
        stroke="url(#jeton-logo-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Center leaf (tallest) */}
      <path
        d="M54 42 C49 26 51 12 54 4 C57 12 59 26 54 42Z"
        stroke="url(#jeton-logo-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right leaf */}
      <path
        d="M54 42 C68 30 76 18 74 8 C64 12 58 28 54 42Z"
        stroke="url(#jeton-logo-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* J body */}
      <path
        d="M54 40 L54 88 C54 106 44 116 30 116 C18 116 15 106 16 100"
        stroke="url(#jeton-logo-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function JetonLogo({ size = 'sm' }) {
  const pxMap = { sm: 32, md: 40, lg: 48 };
  return <JetonIcon size={pxMap[size] ?? 32} />;
}

export function JetonLogoBrand({ showText = true, size = 'sm' }) {
  const pxMap = { sm: 32, md: 40, lg: 48 };
  return (
    <div className="flex items-center gap-2">
      <JetonIcon size={pxMap[size] ?? 32} />
      {showText && <span className="text-sm font-bold text-foreground">Jeton</span>}
    </div>
  );
}
