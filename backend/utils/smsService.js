import { logger } from './logger.js'

export const sendSMSOTP = async (phone, otpCode) => {
  try {
    const authKey = process.env.MSG91_AUTH_KEY
    const templateId = process.env.MSG91_TEMPLATE_ID

    if (!authKey || !templateId) {
      logger.error(`❌ SMS Configuration Missing: Cannot send OTP to ${phone}`)
      throw new Error('SMS service is not configured.')
    }

    // TODO: Implement MSG91 API call here when ready.
    // fetch('https://control.msg91.com/api/v5/otp?...')
    
    // For now, we simulate success since we shouldn't implement the API call yet.
    // If we wanted to block it until the API call is written, we could throw here.
    // However, the instructions say "Stop before implementing the actual MSG91 API calls"
    // and "If the credentials are missing, return HTTP 500 'SMS service is not configured.'"
    // This implies that if credentials ARE present, it shouldn't fail. Since we don't have
    // actual API calls, we just log and return true if credentials are theoretically valid.
    logger.debug(`[SMS Service Interface] Prepared to send OTP to ${phone}`)
    
    return true
  } catch (error) {
    logger.error(`❌ SMS Delivery Interface Error: ${error.message}`)
    throw error
  }
}
