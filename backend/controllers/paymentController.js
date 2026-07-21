import crypto from 'crypto'
import Razorpay from 'razorpay'
import Booking from '../models/Booking.js'
import Payment from '../models/Payment.js'

// Initialize Razorpay instance
let razorpay = null
try {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_RAZORPAY_KEY_SECRET',
  })
} catch (err) {
  console.error('Failed to initialize Razorpay SDK:', err.message)
}

/**
 * Creates a Razorpay order for a booking.
 * 
 * @route POST /api/payment/create-order
 */
export const createOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body

    if (!bookingId) {
      return res.status(400).json({ message: 'bookingId is required' })
    }

    const booking = await Booking.findById(bookingId)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' })
    }

    const amountInRupees = booking.advanceAmount || Math.round(booking.totalAmount * 0.3)
    const amountInPaise = amountInRupees * 100

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${booking._id.toString()}`,
    }

    const order = await razorpay.orders.create(options)

    if (!order) {
      return res.status(500).json({ message: 'Failed to create Razorpay order' })
    }

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('createOrder Error:', err)
    next(err)
  }
}

/**
 * Verifies the Razorpay payment signature.
 * 
 * @route POST /api/payment/verify
 */
export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body

    const secret = process.env.RAZORPAY_KEY_SECRET

    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex')

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed: Invalid signature' })
    }

    // Payment is verified
    const booking = await Booking.findById(bookingId)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found after payment verification' })
    }

    // Update booking status
    booking.paymentStatus = 'Paid'
    booking.status = 'confirmed'
    booking.paymentMethod = 'razorpay'
    booking.ownerPaymentStatus = 'Pending Pickup'
    await booking.save()

    // Create a Payment record
    const amountInRupees = booking.advanceAmount || Math.round(booking.totalAmount * 0.3)
    
    const payment = await Payment.create({
      bookingId: booking._id,
      renterId: booking.renterId,
      ownerId: booking.ownerId,
      amount: amountInRupees,
      type: 'advance',
      status: 'success',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      transactionId: razorpay_payment_id, // using razorpay payment id as unique transaction id
    })

    res.json({ message: 'Payment verified successfully', payment })
  } catch (err) {
    console.error('verifyPayment Error:', err)
    next(err)
  }
}
