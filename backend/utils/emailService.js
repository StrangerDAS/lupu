import nodemailer from 'nodemailer'
import { logger } from './logger.js'

// Lazy load the transporter so env vars are read correctly when functions are called.
let transporterInstance = null
const getTransporter = () => {
  if (transporterInstance) return transporterInstance
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('SMTP Credentials missing! Emails will fail if requested.')
  }
  
  transporterInstance = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
  return transporterInstance
}

export const sendOTPEmail = async (toEmail, otpCode) => {
  try {
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #333; border-radius: 10px; background-color: #0d1117; color: #c9d1d9;">
        <div style="text-align: center; border-bottom: 1px solid #30363d; padding-bottom: 20px; margin-bottom: 20px;">
          <h1 style="color: #58a6ff; margin: 0; font-size: 28px;">LUPU</h1>
          <p style="color: #8b949e; margin: 5px 0 0 0; font-size: 14px;">Vehicle Rental Platform</p>
        </div>
        
        <h2 style="color: #f0f6fc;">Verify Your Email Address</h2>
        <p style="font-size: 16px; line-height: 1.5; color: #c9d1d9;">
          Hello, <br/><br/>
          Thank you for signing up or logging into LUPU. Please use the following One-Time Password (OTP) to complete your verification process.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; padding: 15px 30px; font-size: 24px; font-weight: bold; background-color: #21262d; border: 1px solid #30363d; border-radius: 6px; letter-spacing: 5px; color: #58a6ff;">
            ${otpCode}
          </span>
        </div>
        
        <p style="font-size: 14px; color: #8b949e;">
          <strong>Note:</strong> This OTP is valid for <strong>5 minutes</strong>. If you did not request this email, please ignore it.
        </p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #30363d; text-align: center; font-size: 12px; color: #8b949e;">
          &copy; ${new Date().getFullYear()} LUPU. All rights reserved.
        </div>
      </div>
    `

    const mailOptions = {
      from: `"LUPU Authentication" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'LUPU - Your Verification Code',
      html: htmlTemplate,
    }

    const t = getTransporter()
    const info = await t.sendMail(mailOptions)
    logger.debug(`📧 Email sent successfully to ${toEmail}. MessageId: ${info.messageId}`)
    return info
  } catch (error) {
    logger.error(`❌ SMTP Delivery Failed for ${toEmail}: ${error.message}`)
    throw new Error('Email delivery failed: ' + error.message)
  }
}

export const verifySMTPConnection = async () => {
  try {
    const t = getTransporter()
    await t.verify()
    return true
  } catch (error) {
    logger.error('SMTP Connection Verification Failed: ' + error.message)
    return false
  }
}
