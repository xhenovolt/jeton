/**
 * CurrencyDisplay Component
 * Converts and displays monetary amounts in the selected currency
 */

'use client';

import { useCurrency } from '@/lib/currency-context';

/**
 * Display a monetary amount converted to selected currency
 * @component
 * @param {Object} props
 * @param {number} props.amount - Amount in UGX
 * @param {boolean} [props.showCode=false] - Show currency code instead of symbol
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.showTooltip=false] - Show tooltip indicating conversion
 * @returns {JSX.Element}
 */
export default function CurrencyDisplay({
  amount,
  showCode = false,
  className = '',
  showTooltip = false,
}) {
  const { formatCurrency, selectedCurrency, convert } = useCurrency();

  if (amount === null || amount === undefined) {
    return <span className={className}>—</span>;
  }

  const convertedAmount = convert(amount);
  const formatted = formatCurrency(amount, showCode);

  if (!showTooltip) {
    return <span className={className}>{formatted}</span>;
  }

  return (
    <span className={className} title={`${amount.toLocaleString()} UGX`}>
      {formatted}
    </span>
  );
}

/**
 * Display a range of amounts (e.g., min - max)
 */
export function CurrencyRange({
  min,
  max,
  showCode = false,
  className = '',
}) {
  const { formatCurrency } = useCurrency();

  if (min === null || max === null) {
    return <span className={className}>—</span>;
  }

  return (
    <span className={className}>
      {formatCurrency(min, showCode)} - {formatCurrency(max, showCode)}
    </span>
  );
}

/**
 * Display a total/sum amount
 */
export function CurrencyTotal({
  amount,
  label = '',
  showCode = false,
  className = '',
}) {
  const { formatCurrency } = useCurrency();

  if (amount === null || amount === undefined) {
    return <span className={className}>—</span>;
  }

  const formatted = formatCurrency(amount, showCode);

  return (
    <span className={className}>
      {label && <span className="font-semibold">{label}: </span>}
      <span className="font-bold">{formatted}</span>
    </span>
  );
}

/**
 * Display currency with additional context (e.g., per unit)
 */
export function CurrencyWithContext({
  amount,
  context = '',
  showCode = false,
  className = '',
}) {
  const { formatCurrency } = useCurrency();

  if (amount === null || amount === undefined) {
    return <span className={className}>—</span>;
  }

  const formatted = formatCurrency(amount, showCode);

  return (
    <span className={className}>
      {formatted}
      {context && <span className="text-xs text-muted-foreground ml-1">{context}</span>}
    </span>
  );
}
