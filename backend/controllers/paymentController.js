import Booking from '../models/Booking.js'
import Payment from '../models/Payment.js'

/**
 * Payment Controller
 * Note: Payment Gateway integration (Razorpay) is temporarily disabled.
 * It will be reintegrated after project completion.
 */

/**
 * Payment order creation placeholder
 * 
 * @route POST /api/payment/create-order
 */
export const createOrder = async (req, res) => {
  return res.status(200).json({
    message: 'Online payment gateway is temporarily disabled. Bookings can be confirmed directly.',
    status: 'not_integrated',
  })
}

/**
 * Payment verification placeholder
 * 
 * @route POST /api/payment/verify
 */
export const verifyPayment = async (req, res) => {
  return res.status(200).json({
    message: 'Online payment gateway verification is temporarily disabled.',
    status: 'not_integrated',
  })
}
