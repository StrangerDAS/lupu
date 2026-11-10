import crypto from 'crypto'

/**
 * Modular Verification Provider Adapter Framework for LUPU
 * 
 * Supports:
 * - In-house manual review (default)
 * - HyperVerge (Indian KYC & Biometrics)
 * - Signzy (Indian Identity & Verification)
 *
 * Security:
 * - API secrets remain exclusively in process.env
 * - Webhook HMAC-SHA256 signatures verified
 * - Replay attack prevention via timestamp skew and transaction nonce cache
 * - Frontends CANNOT directly mark users verified
 */

// In-memory cache for processed webhook transaction nonces (replay protection)
const processedWebhooks = new Map()

// Clean up replay nonces older than 1 hour
setInterval(() => {
  const now = Date.now()
  for (const [txId, timestamp] of processedWebhooks.entries()) {
    if (now - timestamp > 3600000) {
      processedWebhooks.delete(txId)
    }
  }
}, 300000).unref()

/**
 * Base Abstract Verification Adapter
 */
export class BaseVerificationAdapter {
  constructor(name) {
    this.name = name
  }

  async createVerificationSession(_params) {
    throw new Error(`createVerificationSession not implemented in ${this.name}`)
  }

  verifyWebhookSignature(_req) {
    throw new Error(`verifyWebhookSignature not implemented in ${this.name}`)
  }

  async processWebhookPayload(_payload) {
    throw new Error(`processWebhookPayload not implemented in ${this.name}`)
  }

  async getTransactionStatus(_transactionId) {
    throw new Error(`getTransactionStatus not implemented in ${this.name}`)
  }
}

/**
 * Manual Verification Adapter (Default In-House Process)
 * Keeps accurate labeling: manual admin side-by-side review.
 */
export class ManualVerificationAdapter extends BaseVerificationAdapter {
  constructor() {
    super('manual_admin_review')
  }

  async createVerificationSession({ userId, documentType }) {
    const transactionId = `MANUAL-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    return {
      provider: this.name,
      transactionId,
      sessionStatus: 'pending_submission',
      requiresSdk: false,
      instructions: 'Capture identity document and live selfie for manual administrator review.',
      metadata: { userId, documentType }
    }
  }

  verifyWebhookSignature(_req) {
    // Manual review does not accept external webhooks
    return false
  }

  async processWebhookPayload(_payload) {
    throw new Error('Manual review provider does not support external webhooks.')
  }

  async getTransactionStatus(transactionId) {
    return {
      provider: this.name,
      transactionId,
      status: 'pending_manual_review'
    }
  }
}

/**
 * HyperVerge Adapter
 * High-precision Indian KYC, ISO 30107-3 compliant passive liveness, and DL verification.
 */
export class HyperVergeAdapter extends BaseVerificationAdapter {
  constructor() {
    super('hyperverge')
    this.appId = process.env.HYPERVERGE_APP_ID || null
    this.appKey = process.env.HYPERVERGE_APP_KEY || null
    this.webhookSecret = process.env.HYPERVERGE_WEBHOOK_SECRET || null
    this.baseUrl = process.env.HYPERVERGE_BASE_URL || 'https://ind-docs.hyperverge.co'
  }

  isConfigured() {
    return Boolean(this.appId && this.appKey && this.webhookSecret)
  }

  async createVerificationSession({ userId, documentType, redirectUrl }) {
    if (!this.isConfigured()) {
      return {
        provider: this.name,
        error: 'HyperVerge credentials not configured in environment variables. Falling back to manual admin review.',
        fallback: true
      }
    }

    const transactionId = `HV-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    
    // Structure session request payload for HyperVerge KYC Workflow
    return {
      provider: this.name,
      transactionId,
      sessionStatus: 'session_created',
      requiresSdk: true,
      sdkConfig: {
        appId: this.appId,
        workflowId: documentType === 'driving_license' ? 'dl_and_face_v2' : 'id_and_face_v2',
        transactionId,
        inputs: {
          documentType,
          userId: String(userId),
          redirectUrl
        }
      }
    }
  }

  /**
   * Validates HyperVerge Webhook HMAC-SHA256 signature and timestamp replay protection
   */
  verifyWebhookSignature(req) {
    if (!this.webhookSecret) return false

    const signature = req.headers['x-hyperverge-signature'] || req.headers['x-signature']
    const timestamp = req.headers['x-hyperverge-timestamp'] || req.headers['x-timestamp']

    if (!signature || !timestamp) return false

    // 1. Clock skew check: Reject requests older than 5 minutes (300 seconds)
    const now = Math.floor(Date.now() / 1000)
    const reqTime = parseInt(timestamp, 10)
    if (Math.abs(now - reqTime) > 300) {
      console.warn('[HyperVerge] Webhook rejected: timestamp outside 5-minute window.')
      return false
    }

    // 2. HMAC-SHA256 validation
    const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body)
    const expectedPayload = `${timestamp}.${rawBody}`
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(expectedPayload)
      .digest('hex')

    try {
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))
    } catch (_) {
      return false
    }
  }

  async processWebhookPayload(payload) {
    const { transactionId, status, result } = payload

    if (!transactionId) {
      throw new Error('HyperVerge payload missing transactionId')
    }

    // Normalized status mapping
    let normalizedStatus = 'under_review'
    let isSuccess = false
    let isRejected = false

    if (status === 'auto_approved' || status === 'success') {
      normalizedStatus = 'verified'
      isSuccess = true
    } else if (status === 'auto_declined' || status === 'rejected' || status === 'failed') {
      normalizedStatus = 'rejected'
      isRejected = true
    } else if (status === 'needs_review') {
      normalizedStatus = 'under_review'
    }

    return {
      provider: this.name,
      transactionId,
      status: normalizedStatus,
      isSuccess,
      isRejected,
      livenessScore: result?.liveness?.score || null,
      livenessPassed: result?.liveness?.live === 'yes',
      faceMatchScore: result?.faceMatch?.match_score || null,
      faceMatchPassed: result?.faceMatch?.match === 'yes',
      extractedData: {
        documentNumber: result?.details?.documentNumber || null,
        name: result?.details?.name || null,
        dob: result?.details?.dob || null,
        expiryDate: result?.details?.expiryDate || null,
        categories: result?.details?.vehicleCategories || []
      },
      rawResult: result
    }
  }
}

/**
 * Signzy Adapter
 * Comprehensive Indian identity workflows, DigiLocker gateway, and Parivahan DL lookup.
 */
export class SignzyAdapter extends BaseVerificationAdapter {
  constructor() {
    super('signzy')
    this.username = process.env.SIGNZY_USERNAME || null
    this.password = process.env.SIGNZY_PASSWORD || null
    this.apiKey = process.env.SIGNZY_API_KEY || null
    this.webhookSecret = process.env.SIGNZY_WEBHOOK_SECRET || null
    this.baseUrl = process.env.SIGNZY_BASE_URL || 'https://api.signzy.app'
  }

  isConfigured() {
    return Boolean((this.apiKey || (this.username && this.password)) && this.webhookSecret)
  }

  async createVerificationSession({ userId, documentType, redirectUrl }) {
    if (!this.isConfigured()) {
      return {
        provider: this.name,
        error: 'Signzy credentials not configured in environment variables. Falling back to manual admin review.',
        fallback: true
      }
    }

    const transactionId = `SZY-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`

    return {
      provider: this.name,
      transactionId,
      sessionStatus: 'session_created',
      requiresSdk: true,
      sdkConfig: {
        transactionId,
        documentType,
        userId: String(userId),
        callbackUrl: redirectUrl
      }
    }
  }

  /**
   * Validates Signzy Webhook HMAC-SHA256 signature and timestamp
   */
  verifyWebhookSignature(req) {
    if (!this.webhookSecret) return false

    const signature = req.headers['x-signzy-signature'] || req.headers['x-signature']
    const timestamp = req.headers['x-signzy-timestamp'] || req.headers['x-timestamp']

    if (!signature) return false

    // Optional timestamp window check if header provided
    if (timestamp) {
      const now = Math.floor(Date.now() / 1000)
      const reqTime = parseInt(timestamp, 10)
      if (Math.abs(now - reqTime) > 300) {
        console.warn('[Signzy] Webhook rejected: timestamp outside 5-minute window.')
        return false
      }
    }

    const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body)
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex')

    try {
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))
    } catch (_) {
      return false
    }
  }

  async processWebhookPayload(payload) {
    const transactionId = payload.patronId || payload.transactionId || payload.identityId

    if (!transactionId) {
      throw new Error('Signzy payload missing transaction/patron ID')
    }

    const isVerified = payload.status === 'success' || payload.result?.verified === true
    const isRejected = payload.status === 'failed' || payload.result?.verified === false

    return {
      provider: this.name,
      transactionId,
      status: isVerified ? 'verified' : isRejected ? 'rejected' : 'under_review',
      isSuccess: isVerified,
      isRejected: isRejected,
      livenessScore: payload.result?.liveness?.score || null,
      livenessPassed: payload.result?.liveness?.passed === true,
      faceMatchScore: payload.result?.matchPercentage || null,
      faceMatchPassed: (payload.result?.matchPercentage || 0) >= 80,
      extractedData: {
        documentNumber: payload.result?.extractedData?.idNumber || null,
        name: payload.result?.extractedData?.name || null,
        dob: payload.result?.extractedData?.dob || null,
        expiryDate: payload.result?.extractedData?.expiryDate || null,
        categories: payload.result?.extractedData?.categories || []
      },
      rawResult: payload
    }
  }
}

/**
 * Verification Provider Manager (Singleton Coordinator)
 */
class VerificationProviderManager {
  constructor() {
    this.adapters = {
      manual: new ManualVerificationAdapter(),
      hyperverge: new HyperVergeAdapter(),
      signzy: new SignzyAdapter(),
    }
  }

  /**
   * Get the active provider specified by environment variable or fallback to manual
   */
  getActiveProvider() {
    const selected = (process.env.VERIFICATION_PROVIDER || 'manual').toLowerCase().trim()
    const adapter = this.adapters[selected] || this.adapters.manual

    // If an external provider is selected but missing credentials, fall back safely
    if (selected !== 'manual' && typeof adapter.isConfigured === 'function' && !adapter.isConfigured()) {
      console.warn(`[VerificationManager] Provider '${selected}' is not configured. Falling back to manual admin review.`)
      return this.adapters.manual
    }

    return adapter
  }

  getAdapter(name) {
    return this.adapters[name] || null
  }

  /**
   * Validates replay protection: ensures transactionId is not reprocessed maliciously
   */
  checkAndRecordReplay(transactionId) {
    if (!transactionId) return false
    if (processedWebhooks.has(transactionId)) {
      return false // Duplicate / replay detected!
    }
    processedWebhooks.set(transactionId, Date.now())
    return true
  }

  /**
   * Helper to reset replay cache in test suites
   */
  resetReplayCache() {
    processedWebhooks.clear()
  }
}

export const verificationProviderManager = new VerificationProviderManager()
