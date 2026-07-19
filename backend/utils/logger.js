/**
 * LUPU Structured Logger
 * 
 * In production: Outputs structured JSON logs to stdout/stderr.
 * In development: Outputs human-readable, colorized terminal logs.
 * Masks sensitive fields (password, token, otp, secret, keys, etc.).
 */

const SENSITIVE_FIELDS = ['password', 'token', 'otp', 'otpVerified', 'code', '_dev_otp', 'secret', 'key_secret', 'authorization']

/** Helper to recursively mask sensitive fields in objects */
function maskSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(maskSensitive)
  }

  const masked = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
      masked[key] = '[MASKED]'
    } else if (typeof value === 'object') {
      masked[key] = maskSensitive(value)
    } else {
      masked[key] = value
    }
  }
  return masked
}

function formatMessage(level, message, meta = {}) {
  const isProduction = process.env.NODE_ENV === 'production'
  const cleanMeta = maskSensitive(meta)
  
  if (isProduction) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(Object.keys(cleanMeta).length > 0 ? { metadata: cleanMeta } : {})
    })
  } else {
    const colors = {
      info: '\x1b[36m',  // Cyan
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      debug: '\x1b[90m', // Gray
      reset: '\x1b[0m'
    }
    const color = colors[level] || colors.reset
    const metaStr = Object.keys(cleanMeta).length > 0 ? ` ${JSON.stringify(cleanMeta)}` : ''
    return `[${new Date().toLocaleTimeString()}] ${color}${level.toUpperCase()}${colors.reset}: ${message}${metaStr}`
  }
}

export const logger = {
  info: (message, meta) => {
    console.log(formatMessage('info', message, meta))
  },
  warn: (message, meta) => {
    console.warn(formatMessage('warn', message, meta))
  },
  error: (message, error, meta = {}) => {
    const errorMeta = error instanceof Error 
      ? { ...meta, error: { message: error.message, stack: error.stack } } 
      : { ...meta, error }
    console.error(formatMessage('error', message, errorMeta))
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(formatMessage('debug', message, meta))
    }
  }
}

// Redirect all standard console.error calls to use structured logger in production
const originalConsoleError = console.error
let isLogging = false

console.error = (message, ...args) => {
  if (isLogging) {
    originalConsoleError(message, ...args)
    return
  }
  
  isLogging = true
  try {
    const errorObj = args.find(arg => arg instanceof Error)
    const otherArgs = args.filter(arg => arg !== errorObj)
    logger.error(String(message), errorObj || new Error(String(message)), { extra: otherArgs })
  } catch (err) {
    originalConsoleError(message, ...args)
  } finally {
    isLogging = false
  }
}

