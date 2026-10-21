/**
 * Zod validation schemas for Prisma services
 * These schemas validate data before it hits the database
 */

import { z } from 'zod';
import { s3ImageSchema, imageFieldSchema, s3FileSchema, fileFieldSchema } from '@/modules/s3_images/validation/schemas';

// Common validation patterns
const emailSchema = z.string().email('Invalid email format').max(255);
// const nonEmptyString = z.string().min(1, 'Field cannot be empty').max(1000);
// const optionalString = z.string().max(1000).optional();
const positiveNumber = z.number().positive('Must be a positive number');
// const safeString = z.string().max(500).regex(/^[a-zA-Z0-9\s\-_.@#$%&*()]+$/, 'Contains invalid characters');

// S3 validation schemas - Re-exported from s3_images module
export { s3ImageSchema, imageFieldSchema, s3FileSchema, fileFieldSchema };

// ====================================
// ACCOUNT USER SERVICE SCHEMAS
// ====================================

export const createContactSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: emailSchema,
  access: z.string().min(1, 'Access level is required').max(50),
  account_id: positiveNumber,
  user_id: z.number().min(0),
  status: z.string().min(1, 'Status is required').max(50),
  salesforceContactId: z.string().max(100).optional()
});

export const updateContactSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100).optional(),
  last_name: z.string().min(1, 'Last name is required').max(100).optional(),
  email: emailSchema.optional(),
  access: z.string().min(1, 'Access level is required').max(50).optional(),
  status: z.string().min(1, 'Status is required').max(50).optional()
});

export const createAccountUserSchema = z.object({
  accountId: positiveNumber,
  userId: positiveNumber,
  access: z.string().min(1, 'Access level is required').max(50),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  status: z.string().min(1, 'Status is required').max(50)
});

export const updateAccountUserSchema = z.object({
  access: z.string().min(1, 'Access level is required').max(50).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  status: z.string().min(1, 'Status is required').max(50).optional()
});

// ====================================
// MAPP TEAM SERVICE SCHEMAS
// ====================================

export const createTeamMemberSchema = z.object({
  email: z.string().email().optional(),
  firstname: z.string().max(100).optional(),
  lastname: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  role: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  image: imageFieldSchema,
  // Access control fields
  accessStatus: z.enum(['active', 'suspended', 'denied']).optional(),
  accessLevel: z.enum(['viewer', 'editor', 'admin']).optional(),
  lastLoginAt: z.date().optional(),
  authorizedBy: z.number().optional(),
  authorizedAt: z.date().optional(),
  accessNotes: z.string().max(1000).optional()
});

export const updateTeamMemberSchema = z.object({
  firstname: z.string().max(100).optional(),
  lastname: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  role: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  image: imageFieldSchema,
  // Access control fields
  accessStatus: z.enum(['active', 'suspended', 'denied']).optional(),
  accessLevel: z.enum(['viewer', 'editor', 'admin']).optional(),
  lastLoginAt: z.date().optional(),
  authorizedBy: z.number().optional(),
  authorizedAt: z.date().optional(),
  accessNotes: z.string().max(1000).optional()
});

// ====================================
// ACCOUNT SERVICE SCHEMAS
// ====================================

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  companyName: z.string().min(1, 'Company name is required').max(200),
  region: z.string().min(1, 'Region is required').max(100),
  currency: z.string().min(1, 'Currency is required').max(10),
  vertical: z.string().max(100).optional(),
  status: z.string().min(1, 'Status is required').max(50),
  stage: z.string().min(1, 'Stage is required').max(50),
  sfAccountId: z.string().max(100).optional()
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200).optional(),
  companyName: z.string().max(200).optional(),
  region: z.string().max(100).optional(),
  currency: z.string().max(10).optional(),
  vertical: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  stage: z.string().max(50).optional(),
  domains: z.array(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})$/, 'Invalid domain format')).optional(),
  sfAccountId: z.string().max(100).optional()
});

// ====================================
// CONTENT SERVICE SCHEMAS
// ====================================

export const createContentSchema = z.object({
  type: z.string().min(1, 'Content type is required').max(50),
  status: z.string().max(50).optional(),
  image: imageFieldSchema,
  data: z.record(z.string(), z.any()).optional()
});

export const updateContentSchema = z.object({
  type: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  image: imageFieldSchema,
  data: z.record(z.string(), z.any()).optional()
});

// ====================================
// ACCOUNT DATA SERVICE SCHEMAS
// ====================================

export const createAccountDataSchema = z.object({
  user_id: positiveNumber,
  account_id: positiveNumber,
  type: z.string().min(1, 'Type is required').max(100),
  data: z.record(z.string(), z.any()),
  status: z.string().max(50).optional()
});

export const updateAccountDataSchema = z.object({
  user_id: positiveNumber.optional(),
  account_id: positiveNumber.optional(),
  type: z.string().max(100).optional(),
  data: z.record(z.string(), z.any()).optional(),
  status: z.string().max(50).optional(),
  updated_at: z.string().optional()
});

// ====================================
// TYPE EXPORTS
// ====================================

export type CreateContactRequest = z.infer<typeof createContactSchema>;
export type UpdateContactRequest = z.infer<typeof updateContactSchema>;
export type CreateAccountUserRequest = z.infer<typeof createAccountUserSchema>;
export type UpdateAccountUserRequest = z.infer<typeof updateAccountUserSchema>;
export type CreateTeamMemberRequest = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberRequest = z.infer<typeof updateTeamMemberSchema>;
export type CreateAccountRequest = z.infer<typeof createAccountSchema>;
export type UpdateAccountRequest = z.infer<typeof updateAccountSchema>;
export type CreateContentRequest = z.infer<typeof createContentSchema>;
export type UpdateContentRequest = z.infer<typeof updateContentSchema>;
export type CreateAccountDataRequest = z.infer<typeof createAccountDataSchema>;
export type UpdateAccountDataRequest = z.infer<typeof updateAccountDataSchema>;

// ====================================
// VALIDATION HELPER
// ====================================

/**
 * Helper function to validate data with Zod schemas
 * Provides consistent error formatting across all services
 */
export function validateWithZod<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    ).join(', ');
    
    const contextPrefix = context ? `[${context}] ` : '';
    throw new Error(`${contextPrefix}Validation failed: ${errors}`);
  }
  
  return result.data;
}