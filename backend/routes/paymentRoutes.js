import express from 'express'
import { createOrder, verifyPayment } from '../controllers/paymentController.js'
// Note: You can add authMiddleware here if required, but for now we keep it simple as per instructions.
// Usually payment creation should be authenticated.

const router = express.Router()

router.post('/create-order', createOrder)
router.post('/verify', verifyPayment)

export default router
