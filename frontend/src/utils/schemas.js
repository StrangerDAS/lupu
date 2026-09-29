/**
 * Shared Zod validation schemas used across forms.
 */
import { z } from 'zod'

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email is required').email('Invalid email address'),
})


export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  identifier: z.string().min(1, 'Email is required').email('Invalid email address'),
  role: z.enum(['user', 'owner']).default('user'),
})

export const vehicleSchema = z.object({
  name: z.string().min(3, 'Vehicle name is required'),
  brand: z.string().min(2, 'Brand is required'),
  model: z.string().min(2, 'Model is required'),
  type: z.enum(['bike', 'scooty']),
  registrationNumber: z.string().min(4, 'Registration number is required'),
  pricePerHour: z.coerce.number().min(1, 'Price must be at least ₹1'),
  pricePerDay: z.coerce.number().optional(),
  securityDeposit: z.coerce.number().optional(),
  location: z.string().min(3, 'Location is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  year: z.coerce.number().optional(),
  fuel: z.string().optional(),
  transmission: z.enum(['Manual', 'Automatic']).optional(),
  helmetAvailable: z.boolean().optional(),
  ownerName: z.string().min(2, "Owner's full name is required (min 2 characters)"),
  ownerPhone: z.string().min(1, 'Valid 10-digit Indian phone number is required')
    .refine((val) => {
      // Strip common formatting characters and optional +91 / 91 country-code prefix.
      // IMPORTANT: Only strip the '91' prefix when the total digit count is > 10
      // (i.e., the input is in +91XXXXXXXXXX / 91XXXXXXXXXX format).
      // Stripping it unconditionally would corrupt numbers like 9101097945.
      const stripped = (val || '').replace(/[\s\-\(\)\+]/g, '')
      const clean = stripped.length > 10 ? stripped.replace(/^91/, '') : stripped
      return /^[6-9]\d{9}$/.test(clean)
    }, { message: 'Enter a valid 10-digit Indian mobile number starting with 6-9.' }),
})

export const addVehicleSchema = vehicleSchema
export const editVehicleSchema = vehicleSchema.partial({ ownerName: true, ownerPhone: true })

export const bookingStep1Schema = z.object({
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
}).refine(
  (d) => new Date(d.endTime) > new Date(d.startTime),
  { message: 'End time must be after start time', path: ['endTime'] }
)

export const profileSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
})
