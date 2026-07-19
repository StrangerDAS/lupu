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
  { name: 'collegeIdUrl', maxCount: 1 }
])
