/**
 * Lightweight, dependency-free in-memory rate limiter middleware.
 * Uses sliding-window filter to count requests from a specific IP/identifier.
 */

const rateLimitStore = new Map()

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of rateLimitStore.entries()) {
    // Keep only timestamps that are less than 1 hour old
    const validTimestamps = timestamps.filter(t => now - t < 3600000)
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key)
    } else {
      rateLimitStore.set(key, validTimestamps)
    }
  }
}, 300000).unref()

export function rateLimiter({ windowMs = 60000, max = 5, message = 'Too many requests, please try again later.' } = {}) {
  return (req, res, next) => {
    const identifier = req.body.identifier || req.user?._id || ''
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip
    const key = `${ip}_${identifier}_${req.path}`
    const now = Date.now()

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, [])
    }

    let timestamps = rateLimitStore.get(key)
    // Filter timestamps within current window
    timestamps = timestamps.filter(t => now - t < windowMs)

    if (timestamps.length >= max) {
      return res.status(429).json({
        success: false,
        message
      })
    }

    timestamps.push(now)
    rateLimitStore.set(key, timestamps)
    next()
  }
}
