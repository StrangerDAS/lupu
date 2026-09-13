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

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only JPEG, PNG, WEBP images and PDF files are allowed'), false)
  }
}

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
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

