/**
 * Shared Zod validation schemas used across forms.
 */
import { z } from 'zod'

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email is required').email('Invalid email address'),
})

export const verifySchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
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
})

export const addVehicleSchema = vehicleSchema
export const editVehicleSchema = vehicleSchema

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
