/**
 * Shared Zod validation schemas used across forms.
 */
import { z } from 'zod'

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
})

export const verifySchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
})

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  identifier: z.string().min(1, 'Email or phone is required'),
  role: z.enum(['user', 'owner']).default('user'),
})

export const addVehicleSchema = z.object({
  name: z.string().min(3, 'Vehicle name is required'),
  type: z.enum(['bike', 'scooty']),
  vehicleNumber: z.string().optional(),
  pricePerHour: z.coerce.number().min(1, 'Price must be at least ₹1'),
  pricePerDay: z.coerce.number().optional(),
  location: z.string().min(3, 'Location is required'),
  description: z.string().optional(),
  year: z.coerce.number().optional(),
})

export const editVehicleSchema = z.object({
  name: z.string().min(3, 'Vehicle name is required'),
  type: z.enum(['bike', 'scooty']),
  vehicleNumber: z.string().optional(),
  pricePerHour: z.coerce.number().min(1, 'Price must be at least ₹1'),
  pricePerDay: z.coerce.number().optional(),
  location: z.string().min(3, 'Location is required'),
  description: z.string().optional(),
})

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
