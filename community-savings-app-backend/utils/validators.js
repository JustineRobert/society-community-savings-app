// utils/validators.js

const { body, validationResult } = require('express-validator');

/**
 * Validation Rules
 */
const validationRules = {
  // Auth Validators
  register: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
      .isLength({ max: 100 }).withMessage('Name must not exceed 100 characters'),
    
    body('email')
      .trim()
      .toLowerCase()
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
  ],

  login: [
    body('email')
      .trim()
      .toLowerCase()
      .isEmail().withMessage('Please provide a valid email'),
    
    body('password')
      .notEmpty().withMessage('Password is required'),
  ],

  // Group Validators
  createGroup: [
    body('name')
      .trim()
      .notEmpty().withMessage('Group name is required')
      .isLength({ min: 3 }).withMessage('Group name must be at least 3 characters')
      .isLength({ max: 100 }).withMessage('Group name must not exceed 100 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
  ],

  // Contribution Validators
  addContribution: [
    body('groupId')
      .notEmpty().withMessage('Group ID is required')
      .isMongoId().withMessage('Invalid group ID'),
    
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  ],

  // Loan Validators
  createLoan: [
    body('groupId')
      .notEmpty().withMessage('Group ID is required')
      .isMongoId().withMessage('Invalid group ID'),
    
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    
    body('dueDate')
      .notEmpty().withMessage('Due date is required')
      .isISO8601().withMessage('Invalid date format'),
    
    body('reason')
      .trim()
      .notEmpty().withMessage('Loan reason is required')
      .isLength({ max: 300 }).withMessage('Reason must not exceed 300 characters'),
  ],

  // Settings Validators
  updateProfile: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
      .isLength({ max: 100 }).withMessage('Name must not exceed 100 characters'),
    
    body('phone')
      .optional()
      .trim()
      .isMobilePhone().withMessage('Please provide a valid phone number'),
    
    body('profile.occupation')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Occupation must not exceed 100 characters'),
    
    body('profile.city')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('City must not exceed 100 characters'),
  ],
};

/**
 * Validation Middleware
 * Catches and returns validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Custom Validators
 */
const isValidMongoId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

const isValidEmail = (email) => {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

const isStrongPassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
};

module.exports = {
  validationRules,
  handleValidationErrors,
  isValidMongoId,
  isValidEmail,
  isStrongPassword,
};