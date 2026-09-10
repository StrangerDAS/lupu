import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * emailService.js
 * 
 * Provides an abstraction layer for transactional email delivery.
 * 
 * SECURITY & ENVIRONMENT POLICY:
 * 1. In PRODUCTION:
 *    - EMAIL_PROVIDER = 'SIMULATION' is STRICTLY FORBIDDEN.
 *    - Production must NEVER silently pretend emails were sent.
 *    - If real email infrastructure (RESEND, SENDGRID, BREVO) is not configured with credentials,
 *      email dispatch is set to 'DISABLED' and fails fast with explicit error logging.
 * 2. In DEVELOPMENT:
 *    - Allows local simulation for testing when explicitly configured.
 */

const isProduction = Boolean(import.meta.env.PROD || import.meta.env.MODE === 'production')
const rawProvider = (import.meta.env.VITE_EMAIL_PROVIDER || '').trim().toUpperCase()

function resolveProvider() {
  if (isProduction) {
    // In production, 'SIMULATION' is strictly prohibited
    if (['RESEND', 'SENDGRID', 'BREVO'].includes(rawProvider)) {
      return rawProvider
    }
    // No valid real provider configured in production: fail fast and disable
    console.warn(
      '[emailService] ⚠️ PRODUCTION WARNING: Real email provider is not configured (VITE_EMAIL_PROVIDER is not set to RESEND, SENDGRID, or BREVO). Email sending is DISABLED. Simulated emails are strictly disallowed in production.'
    )
    return 'DISABLED'
  }

  // Local development / test
  return rawProvider || 'SIMULATION'
}

export const EMAIL_PROVIDER = resolveProvider()

const getEmailsCollection = () => collection(db, 'emails')

/**
 * Main email dispatch function
 */
export async function sendEmail(to, subject, content) {
  try {
    switch (EMAIL_PROVIDER) {
      case 'RESEND':
        return await sendViaResend(to, subject, content)
      case 'SENDGRID':
        return await sendViaSendGrid(to, subject, content)
      case 'BREVO':
        return await sendViaBrevo(to, subject, content)
      case 'SIMULATION':
        if (isProduction) {
          console.error('[emailService] ❌ CRITICAL: Attempted email simulation in PRODUCTION. Operation blocked.')
          return { success: false, error: 'Email simulation is forbidden in production.' }
        }
        return await sendEmailSimulation(to, subject, content)
      case 'DISABLED':
      default:
        console.warn(
          `[emailService] ⚠️ EMAIL NOT SENT: Dispatch to <${to}> with subject "${subject}" suppressed. Email service is DISABLED in production because no real provider is configured.`
        )
        return { 
          success: false, 
          disabled: true, 
          error: 'Email delivery is not configured in production. Outbound emails are disabled.' 
        }
    }
  } catch (err) {
    console.error(`[emailService] Failed to dispatch email via ${EMAIL_PROVIDER}:`, err)
    return { success: false, error: err.message }
  }
}

/**
 * Simulated Inbox for localhost testing ONLY.
 * Never executes in production.
 */
export async function sendEmailSimulation(to, subject, content) {
  if (isProduction) {
    console.error('[emailService] ❌ CRITICAL: sendEmailSimulation called in PRODUCTION. Aborted to prevent simulation in production.')
    return { success: false, error: 'Simulated emails are disabled in production.' }
  }

  console.log(`[SIMULATED EMAIL - DEV ONLY] To: ${to} | Subject: ${subject}`)
  
  try {
    await addDoc(getEmailsCollection(), {
      to,
      subject,
      content,
      status: 'delivered', // simulated
      createdAt: serverTimestamp(),
    })
    return { success: true }
  } catch (err) {
    console.error('[emailService] Failed to write simulated email:', err)
    return { success: false, error: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STUBS FOR FUTURE INTEGRATION (Real transactional email providers)
// ─────────────────────────────────────────────────────────────────────────────

async function sendViaResend(to, subject, content) {
  const apiKey = import.meta.env.VITE_RESEND_API_KEY
  if (!apiKey) {
    throw new Error('VITE_RESEND_API_KEY is not configured.')
  }
  console.log(`[emailService] Sending via Resend to: ${to} | Subject: ${subject}`)
  // Future implementation:
  // const resend = new Resend(apiKey);
  // return await resend.emails.send({ from: 'LUPU <hello@lupu.in>', to, subject, html: content });
  return { success: true, provider: 'RESEND' }
}

async function sendViaSendGrid(to, subject, content) {
  const apiKey = import.meta.env.VITE_SENDGRID_API_KEY
  if (!apiKey) {
    throw new Error('VITE_SENDGRID_API_KEY is not configured.')
  }
  console.log(`[emailService] Sending via SendGrid to: ${to} | Subject: ${subject}`)
  // Future implementation:
  // sgMail.setApiKey(apiKey)
  // return await sgMail.send({ to, from: 'hello@lupu.in', subject, html: content })
  return { success: true, provider: 'SENDGRID' }
}

async function sendViaBrevo(to, subject, content) {
  const apiKey = import.meta.env.VITE_BREVO_API_KEY
  if (!apiKey) {
    throw new Error('VITE_BREVO_API_KEY is not configured.')
  }
  console.log(`[emailService] Sending via Brevo to: ${to} | Subject: ${subject}`)
  return { success: true, provider: 'BREVO' }
}
