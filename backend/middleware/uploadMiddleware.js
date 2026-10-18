import multer from 'multer'
import path from 'path'
import fs from 'fs'

const UPLOAD_DIR = './uploads'

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'image/pjpeg',
  'image/x-png',
  'application/pdf',
  'application/octet-stream', // often sent by Safari/macOS for .heic/.heif files
]

const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.pdf',
]

const fileFilter = (req, file, cb) => {
  const mime = (file.mimetype || '').toLowerCase()
  const ext = path.extname(file.originalname || '').toLowerCase()

  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(mime)
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext)

  // If MIME is octet-stream, require a recognized extension
  if (mime === 'application/octet-stream') {
    if (isExtAllowed) {
      return cb(null, true)
    }
    return cb(new Error('Only JPEG, PNG, WEBP, HEIC images and PDF files are allowed'), false)
  }

  // Allow if either MIME is recognized or extension is recognized
  if (isMimeAllowed || isExtAllowed) {
    cb(null, true)
  } else {
    cb(new Error('Only JPEG, PNG, WEBP, HEIC images and PDF files are allowed'), false)
  }
}

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max to support high-res mobile photos
  }
})

// Configure fields
export const vehicleUpload = upload.fields([
  { name: 'RC', maxCount: 1 },
  { name: 'Insurance', maxCount: 1 },
  { name: 'PUC', maxCount: 1 },
  { name: 'photos', maxCount: 10 }
])

export const kycUpload = upload.fields([
  { name: 'governmentIdUrl', maxCount: 1 },
  { name: 'collegeIdUrl', maxCount: 1 },
  { name: 'governmentId', maxCount: 1 },
  { name: 'collegeId', maxCount: 1 },
  { name: 'drivingLicense', maxCount: 1 },
  { name: 'drivingLicenseUrl', maxCount: 1 },
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarFrontUrl', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'aadhaarBackUrl', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'panUrl', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'selfieUrl', maxCount: 1 },
  { name: 'document', maxCount: 1 }
])

export const avatarUpload = upload.single('avatar')

