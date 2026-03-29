/**
 * Jeton Logo Component
 * Used in Navbar and Sidebar
 */
export function JetonLogo({ size = 'sm', variant = 'gradient' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  const variants = {
    gradient: 'bg-gradient-to-br from-blue-500 to-purple-600',
    solid: 'bg-blue-600',
    outline: 'border-2 border-blue-500 bg-transparent',
  };

  return (
    <div
      className={`${sizeClasses[size]} ${variants[variant]} rounded-lg flex items-center justify-center font-bold text-white shadow-lg transition-transform hover:scale-105`}
      style={variant === 'gradient' ? { boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' } : {}}
    >
      J
    </div>
  );
}

export function JetonLogoBrand({ showText = true, size = 'sm' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg`}
        style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}
      >
        J
      </div>
      {showText && <span className="text-sm font-bold text-foreground">Jeton</span>}
    </div>
  );
}
