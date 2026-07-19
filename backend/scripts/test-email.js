import { sendOTPEmail, verifySMTPConnection } from '../utils/emailService.js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

async function runTests() {
  console.log('🔄 Starting SMTP Testing...')
  
  // 1. Check SMTP Verification
  console.log('\n[1] Verifying SMTP Connection...')
  const isConnected = await verifySMTPConnection()
  if (isConnected) {
    console.log('✅ SMTP Connection successful.')
  } else {
    console.log('❌ SMTP Connection failed. (Expected if credentials are missing/invalid)')
  }

  // 2. Try to send an email
  console.log('\n[2] Attempting to send test email to ruhandas67@gmail.com...')
  try {
    await sendOTPEmail('ruhandas67@gmail.com', '123456')
    console.log('✅ Email sent successfully!')
  } catch (error) {
    console.log('❌ Expected Error caught (graceful failure):', error.message)
  }

  console.log('\n✅ Testing Script Finished.')
  process.exit(0)
}

runTests()
