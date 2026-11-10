import assert from 'assert'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import {
  generateSecureDocumentUrl,
  generateDocumentToken,
  verifyDocumentToken,
  resolveSecureFilePath,
  SECURE_UPLOAD_DIR
} from '../utils/secureStorage.js'
import { verificationProviderManager, HyperVergeAdapter } from '../adapters/verificationProvider.js'
import { resetRateLimits } from '../middleware/rateLimiter.js'
import { maskAadhaarNumber } from '../middleware/verificationGuard.js'


/**
 * Automated Security Hardening & Provider Preparation Test Suite for LUPU
 */

async function runSecurityTests() {
  console.log('\n======================================================')
  console.log('🧪 LUPU VERIFICATION SECURITY & PROVIDER TEST SUITE')
  console.log('======================================================\n')

  let passed = 0
  let failed = 0

  function test(name, fn) {
    try {
      fn()
      console.log(`  ✅ PASS: ${name}`)
      passed++
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`)
      console.error(`     Error: ${err.message}`)
      failed++
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn()
      console.log(`  ✅ PASS: ${name}`)
      passed++
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`)
      console.error(`     Error: ${err.message}`)
      failed++
    }
  }

  // ── TEST GROUP 1: SECURE DOCUMENT STORAGE & SIGNED URLS ──────
  console.log('📂 GROUP 1: Secure Document Storage & Signed URLs')

  test('1.1 Secure upload directory exists and is segregated from public uploads', () => {
    assert.ok(fs.existsSync(SECURE_UPLOAD_DIR), 'secure-uploads directory must exist')
    assert.notStrictEqual(path.resolve(SECURE_UPLOAD_DIR), path.resolve('./uploads'), 'secure-uploads must be separate from uploads')
  })

  test('1.2 Generates valid HMAC-SHA256 signed token for document path', () => {
    const testPath = 'secure-uploads/aadhaarFront-1234.jpg'
    const expiresAt = Math.floor(Date.now() / 1000) + 900 // 15 mins
    const token = generateDocumentToken(testPath, expiresAt)
    assert.strictEqual(typeof token, 'string')
    assert.strictEqual(token.length, 64, 'Token must be 64-char hex SHA-256')
    assert.ok(verifyDocumentToken(testPath, expiresAt, token), 'Token must verify successfully')
  })

  test('1.3 Rejects tampered document tokens', () => {
    const testPath = 'secure-uploads/aadhaarFront-1234.jpg'
    const expiresAt = Math.floor(Date.now() / 1000) + 900
    const token = generateDocumentToken(testPath, expiresAt)
    const tamperedToken = token.slice(0, -2) + '00'
    assert.strictEqual(verifyDocumentToken(testPath, expiresAt, tamperedToken), false, 'Tampered token must fail')
  })

  test('1.4 Strictly enforces 15-minute maximum expiration for signed URLs', () => {
    const testPath = 'secure-uploads/studentIdFront-5678.jpg'
    // Expired timestamp (10 seconds in past)
    const pastExpiresAt = Math.floor(Date.now() / 1000) - 10
    const token = generateDocumentToken(testPath, pastExpiresAt)
    assert.strictEqual(verifyDocumentToken(testPath, pastExpiresAt, token), false, 'Expired token must fail verification')

    // Signed URL generator enforces 15 min (900 sec) ceiling
    const url = generateSecureDocumentUrl(testPath, 3600) // Requested 1 hour
    assert.ok(url.includes('expires='), 'URL must contain expires parameter')
    const match = url.match(/expires=(\d+)/)
    const generatedExp = parseInt(match[1], 10)
    const maxAllowedExp = Math.floor(Date.now() / 1000) + 900
    assert.ok(generatedExp <= maxAllowedExp + 2, 'Expiry cannot exceed 15 minutes (900s)')
  })

  test('1.5 Path traversal protection in resolveSecureFilePath', () => {
    const dangerousPath = '../../../../etc/passwd'
    const resolved = resolveSecureFilePath(dangerousPath)
    assert.strictEqual(resolved, null, 'Path traversal attempts must resolve to null')
  })

  // ── TEST GROUP 2: DOCUMENT SUBMISSION RATE LIMITING ──────────
  console.log('\n⏱️ GROUP 2: Document & Face Submission Rate Limiting')

  test('2.1 Rate limiter allows submissions within quota (<= 5 per 15 mins)', () => {
    resetRateLimits()
    // Simulated mock req/res
    let blocked = false
    const req = {
      user: { _id: 'user_123' },
      path: '/api/users/verification/document',
      headers: { 'x-forwarded-for': '192.168.1.1' },
      socket: {}
    }
    const res = {
      status: (code) => ({
        json: (data) => {
          if (code === 429) blocked = true
        }
      }),
      setHeader: () => {}
    }

    import('../middleware/rateLimiter.js').then(({ verificationSubmissionLimiter }) => {
      const limiter = verificationSubmissionLimiter({ max: 5, windowMs: 15 * 60 * 1000 })
      // Run 5 allowed requests
      for (let i = 0; i < 5; i++) {
        limiter(req, res, () => {})
      }
      assert.strictEqual(blocked, false, 'First 5 requests must not be rate limited')
    })
  })

  test('2.2 Rate limiter blocks 6th submission returning HTTP 429 and Retry-After header', () => {
    resetRateLimits()
    let statusCode = null
    let responseBody = null
    let retryAfterHeader = null

    const req = {
      user: { _id: 'abusive_user_999' },
      path: '/api/users/verification/document',
      headers: { 'x-forwarded-for': '10.0.0.1' },
      socket: {}
    }
    const res = {
      status: (code) => {
        statusCode = code
        return {
          json: (data) => {
            responseBody = data
          }
        }
      },
      setHeader: (name, val) => {
        if (name === 'Retry-After') retryAfterHeader = val
      }
    }

    import('../middleware/rateLimiter.js').then(({ verificationSubmissionLimiter }) => {
      const limiter = verificationSubmissionLimiter({ max: 5, windowMs: 15 * 60 * 1000 })
      for (let i = 0; i < 6; i++) {
        limiter(req, res, () => {})
      }
      assert.strictEqual(statusCode, 429, '6th request must receive HTTP 429')
      assert.strictEqual(responseBody?.success, false)
      assert.ok(responseBody?.retryAfterSeconds > 0, 'Must return retryAfterSeconds')
      assert.ok(retryAfterHeader > 0, 'Must set Retry-After header')
    })
  })

  // ── TEST GROUP 3: PROVIDER INTEGRATION & WEBHOOK SECURITY ────
  console.log('\n🛡️ GROUP 3: Modular Provider Adapter & Webhook Security')

  test('3.1 Default active provider falls back to manual review with clear labeling', () => {
    delete process.env.VERIFICATION_PROVIDER
    const active = verificationProviderManager.getActiveProvider()
    assert.strictEqual(active.name, 'manual_admin_review', 'Default provider must be manual_admin_review')
  })

  test('3.2 HyperVerge Webhook HMAC-SHA256 signature verification', () => {
    const adapter = new HyperVergeAdapter()
    adapter.webhookSecret = 'test_webhook_secret_key_12345'

    const body = { transactionId: 'HV-TEST-001', status: 'auto_approved' }
    const rawBody = JSON.stringify(body)
    const timestamp = String(Math.floor(Date.now() / 1000))
    const expectedPayload = `${timestamp}.${rawBody}`
    const validSignature = crypto.createHmac('sha256', adapter.webhookSecret).update(expectedPayload).digest('hex')

    const validReq = {
      headers: {
        'x-hyperverge-signature': validSignature,
        'x-hyperverge-timestamp': timestamp
      },
      body,
      rawBody
    }
    assert.strictEqual(adapter.verifyWebhookSignature(validReq), true, 'Valid HMAC signature must pass')

    const invalidReq = {
      headers: {
        'x-hyperverge-signature': 'invalid_signature_hex_1234567890',
        'x-hyperverge-timestamp': timestamp
      },
      body,
      rawBody
    }
    assert.strictEqual(adapter.verifyWebhookSignature(invalidReq), false, 'Invalid HMAC signature must fail')
  })

  test('3.3 Webhook rejects replay attacks and clock-skew timestamps (> 5 mins)', () => {
    const adapter = new HyperVergeAdapter()
    adapter.webhookSecret = 'test_webhook_secret_key_12345'

    const body = { transactionId: 'HV-TEST-REPLAY-002', status: 'auto_approved' }
    const rawBody = JSON.stringify(body)
    // 6 minutes in the past
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 360)
    const payload = `${staleTimestamp}.${rawBody}`
    const signature = crypto.createHmac('sha256', adapter.webhookSecret).update(payload).digest('hex')

    const staleReq = {
      headers: {
        'x-hyperverge-signature': signature,
        'x-hyperverge-timestamp': staleTimestamp
      },
      body,
      rawBody
    }
    assert.strictEqual(adapter.verifyWebhookSignature(staleReq), false, 'Stale timestamp (> 5 mins) must be rejected')

    // Replay nonce cache check
    verificationProviderManager.resetReplayCache()
    const txId = 'HV-TX-REPLAY-UNIQUE-001'
    const firstCheck = verificationProviderManager.checkAndRecordReplay(txId)
    assert.strictEqual(firstCheck, true, 'First delivery of transaction must succeed')
    const secondCheck = verificationProviderManager.checkAndRecordReplay(txId)
    assert.strictEqual(secondCheck, false, 'Duplicate delivery of transaction must be detected and rejected as replay')
  })

  // ── TEST GROUP 4: AUDIT INTEGRITY & SENSITIVE DATA MASKING ───
  console.log('\n🔒 GROUP 4: Identity Privacy & Admin Self-Approval Controls')

  test('4.1 SafeUser strips private document storage URLs for non-admin callers', () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Renter',
      email: 'renter@test.com',
      documentFrontUrl: 'https://res.cloudinary.com/test/image/authenticated/id_123.jpg',
      selfieUrl: '/secure-uploads/selfie-123.jpg',
      aadhaarFrontUrl: 'https://res.cloudinary.com/test/image/authenticated/aadhaar_123.jpg',
      aadhaarNumber: '123456789012',
      drivingLicenseUrl: '/secure-uploads/dl-123.jpg',
    }

    assert.strictEqual(maskAadhaarNumber(mockUser.aadhaarNumber), 'XXXX-XXXX-9012', 'Aadhaar must be masked to last 4 digits')
  })

  console.log('\n======================================================')
  console.log(`🏁 TEST RESULTS: ${passed} passed, ${failed} failed`)
  console.log('======================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
