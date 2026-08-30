/**
 * Payment Utilities
 * Note: Payment Gateway integration (Razorpay) is temporarily disabled.
 * To be reintegrated after project completion.
 */

export const isPaymentGatewayEnabled = false

export const formatCurrency = (amount) => {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}
