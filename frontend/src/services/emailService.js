import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * emailService.js
 * 
 * Provides an abstract layer for sending emails. 
 * Currently defaults to 'SIMULATION' for localhost testing.
 * Future integration ready for Resend, SendGrid, or Brevo.
 */

// Toggle this via env vars in production (e.g. import.meta.env.VITE_EMAIL_PROVIDER)
const EMAIL_PROVIDER = 'SIMULATION' // 'RESEND' | 'SENDGRID' | 'BREVO' | 'SIMULATION'

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
      default:
        return await sendEmailSimulation(to, subject, content)
    }
  } catch (err) {
    console.error(`[emailService] Failed to send email via ${EMAIL_PROVIDER}:`, err)
  }
}

/**
 * Simulated Inbox for localhost testing
 */
export async function sendEmailSimulation(to, subject, content) {
  console.log(`[SIMULATED EMAIL] To: ${to} | Subject: ${subject}`)
  
  await addDoc(getEmailsCollection(), {
    to,
    subject,
    content,
    status: 'delivered', // simulated
    createdAt: serverTimestamp(),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// STUBS FOR FUTURE INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

async function sendViaResend(to, subject, content) {
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({ from: 'LUPU <hello@lupu.in>', to, subject, html: content });
  console.log('Sending via Resend...')
}

async function sendViaSendGrid(to, subject, content) {
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  // await sgMail.send({ to, from: 'hello@lupu.in', subject, html: content })
  console.log('Sending via SendGrid...')
}

async function sendViaBrevo(to, subject, content) {
  // const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  // ... configure and send via Brevo ...
  console.log('Sending via Brevo...')
}
