/**
 * Lightweight, dependency-free in-memory rate limiter middleware.
 * Uses sliding-window filter to count requests from IP and authenticated user.
 */

const rateLimitStore = new Map()

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const validTimestamps = timestamps.filter(t => now - t < 3600000)
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key)
    } else {
      rateLimitStore.set(key, validTimestamps)
    }
  }
}, 300000).unref()

/**
 * Standard generic rate limiter
 */
export function rateLimiter({ windowMs = 60000, max = 5, message = 'Too many requests, please try again later.' } = {}) {
  return (req, res, next) => {
    const identifier = req.body?.identifier || req.user?._id || ''
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown_ip'
    const key = `${ip}_${identifier}_${req.baseUrl || ''}${req.path}`
    const now = Date.now()

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, [])
    }

    let timestamps = rateLimitStore.get(key)
    timestamps = timestamps.filter(t => now - t < windowMs)

    if (timestamps.length >= max) {
      const oldest = timestamps[0]
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
      res.setHeader('Retry-After', retryAfterSeconds)
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds
      })
    }

    timestamps.push(now)
    rateLimitStore.set(key, timestamps)
    next()
  }
}

/**
 * Dedicated verification submission rate limiter.
 * Limits document uploads and face captures per authenticated user and client IP.
 * Default: Max 5 submissions per 15 minutes window.
 */
export function verificationSubmissionLimiter({
  windowMs = 15 * 60 * 1000, // 15 minutes
  max = 5,
  message = 'Too many verification attempts. Please wait 15 minutes before submitting again.'
} = {}) {
  return (req, res, next) => {
    const userId = req.user?._id?.toString() || req.body?.userId || 'anonymous'
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown_ip').split(',')[0].trim()
    const now = Date.now()

    // Enforce limits on both user ID and client IP
    const userKey = `verif_user_${userId}_${req.path}`
    const ipKey = `verif_ip_${ip}_${req.path}`

    for (const key of [userKey, ipKey]) {
      if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, [])
      }

      let timestamps = rateLimitStore.get(key)
      timestamps = timestamps.filter(t => now - t < windowMs)
      rateLimitStore.set(key, timestamps)

      if (timestamps.length >= max) {
        const oldest = timestamps[0]
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
        res.setHeader('Retry-After', retryAfterSeconds)
        return res.status(429).json({
          success: false,
          message,
          retryAfterSeconds
        })
      }
    }

    // Record request timestamp for both keys
    for (const key of [userKey, ipKey]) {
      const timestamps = rateLimitStore.get(key) || []
      timestamps.push(now)
      rateLimitStore.set(key, timestamps)
    }

    next()
  }
}

/**
 * Helper to reset rate limit stores in test environments
 */
export function resetRateLimits() {
  rateLimitStore.clear()
}
