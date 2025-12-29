/**
 * Validation Schemas
 * Input validation for authentication and authorization
 */

import { z } from 'zod';

/**
 * Login request validation
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Register request validation
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

/**
 * Asset creation/update validation
 */
export const assetSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(255),
  category: z.string().min(1, 'Category is required').max(100),
  acquisition_source: z.string().max(255).optional().or(z.literal(null)),
  acquisition_date: z.string().date().optional().or(z.literal(null)),
  acquisition_cost: z.coerce.number().nonnegative().optional().or(z.literal(null)),
  current_value: z.coerce.number().nonnegative('Current value must be non-negative'),
  depreciation_rate: z.coerce.number().min(0).max(100).optional().default(0),
  notes: z.string().optional().or(z.literal(null)),
});

/**
 * Liability creation/update validation
 */
export const liabilitySchema = z.object({
  name: z.string().min(1, 'Liability name is required').max(255),
  category: z.string().min(1, 'Category is required').max(100),
  creditor: z.string().max(255).optional().or(z.literal(null)),
  principal_amount: z.coerce.number().nonnegative('Principal amount must be non-negative'),
  outstanding_amount: z.coerce.number().nonnegative('Outstanding amount must be non-negative'),
  interest_rate: z.coerce.number().min(0).max(100).optional().default(0),
  due_date: z.string().date().optional().or(z.literal(null)),
  status: z.enum(['ACTIVE', 'CLEARED', 'DEFAULTED', 'DEFERRED']).default('ACTIVE'),
  notes: z.string().optional().or(z.literal(null)),
});

/**
 * Deal creation/update validation
 */
export const dealSchema = z.object({
  title: z.string().min(1, 'Deal title is required').max(255),
  client_name: z.string().max(255).optional().or(z.literal(null)),
  value_estimate: z.coerce.number().nonnegative('Value estimate must be non-negative').optional().default(0),
  stage: z.enum(['Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost']).default('Lead'),
  probability: z.coerce.number().min(0).max(100).optional().default(50),
  expected_close_date: z.string().date().optional().or(z.literal(null)),
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']).default('ACTIVE'),
  notes: z.string().optional().or(z.literal(null)),
});

/**
 * Validate deal input
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result { success, data, errors }
 */
export function validateDeal(data) {
  try {
    const validated = dealSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      data: null,
      errors: { general: ['Validation failed'] },
    };
  }
}

/**
 * Validate deal stage change
 * @param {string} newStage - New stage value
 * @returns {boolean} Whether stage is valid
 */
export function isValidDealStage(newStage) {
  const validStages = ['Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
  return validStages.includes(newStage);
}

/**
 * Validate deal probability
 * @param {number} probability - Probability value (0-100)
 * @returns {boolean} Whether probability is valid
 */
export function isValidDealProbability(probability) {
  return typeof probability === 'number' && probability >= 0 && probability <= 100;
}


/**
 * Validate login input
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result { success, data, errors }
 */
export function validateLogin(data) {
  try {
    const validated = loginSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      data: null,
      errors: { general: ['Validation failed'] },
    };
  }
}

/**
 * Validate register input
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result { success, data, errors }
 */
export function validateRegister(data) {
  try {
    const validated = registerSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      data: null,
      errors: { general: ['Validation failed'] },
    };
  }
}

/**
 * Validate asset input
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result { success, data, errors }
 */
export function validateAsset(data) {
  try {
    const validated = assetSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      data: null,
      errors: { general: ['Validation failed'] },
    };
  }
}

/**
 * Validate liability input
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result { success, data, errors }
 */
export function validateLiability(data) {
  try {
    const validated = liabilitySchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      data: null,
      errors: { general: ['Validation failed'] },
    };
  }
}

export default {
  loginSchema,
  registerSchema,
  assetSchema,
  liabilitySchema,
  dealSchema,
  validateLogin,
  validateRegister,
  validateAsset,
  validateLiability,
  validateDeal,
  isValidDealStage,
  isValidDealProbability,
};
