/**
 * Sales calculation and formatting utilities
 */

export function calculateTotalAmount(quantity, unitPrice) {
  return parseFloat((quantity * unitPrice).toFixed(2));
}

export function calculateRemainingBalance(totalAmount, totalPaid) {
  return parseFloat((totalAmount - totalPaid).toFixed(2));
}

export function getStatusColor(status) {
  switch (status) {
    case 'Paid':
      return 'text-green-600 dark:text-green-400';
    case 'Partially Paid':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'Pending':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

export function getStatusBgColor(status) {
  switch (status) {
    case 'Paid':
      return 'bg-green-100 dark:bg-green-900';
    case 'Partially Paid':
      return 'bg-yellow-100 dark:bg-yellow-900';
    case 'Pending':
      return 'bg-red-100 dark:bg-red-900';
    default:
      return 'bg-gray-100 dark:bg-gray-800';
  }
}

export function formatPaymentMethod(method) {
  const methods = {
    'Cash': '💵 Cash',
    'Bank Transfer': '🏦 Bank Transfer',
    'Mobile Money': '📱 Mobile Money',
    'Other': '📝 Other',
  };
  return methods[method] || method;
}

export function calculatePaymentProgress(totalAmount, totalPaid) {
  if (totalAmount === 0) return 0;
  return Math.min(100, (totalPaid / totalAmount) * 100);
}

export function getDaysOverdue(saleDate, status) {
  if (status === 'Paid') return 0;
  
  const sale = new Date(saleDate);
  const dueDate = new Date(sale.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const today = new Date();
  
  if (today <= dueDate) return 0;
  
  const diff = today - dueDate;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getSaleStatusLabel(status) {
  const labels = {
    'Paid': 'Completed',
    'Partially Paid': 'In Progress',
    'Pending': 'Awaiting Payment',
  };
  return labels[status] || status;
}

export function formatCurrency(value, currency = 'UGX') {
  const formatter = new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
}
