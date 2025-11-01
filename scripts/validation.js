/**
 * Form Validation Module
 * Comprehensive client-side validation with real-time feedback
 * Author: Eng. Eslam Osama Saad (EOPeak)
 */

class FormValidator {
  constructor(config) {
    this.config = config;
    this.errors = {};
    this.init();
  }

  init() {
    // Set up real-time validation listeners
    this.setupValidationListeners();
  }

  /**
   * Set up real-time validation for form fields
   */
  setupValidationListeners() {
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const emailInput = document.getElementById('email');
    const messageInput = document.getElementById('message');

    if (nameInput) {
      nameInput.addEventListener('blur', () => this.validateName());
      nameInput.addEventListener('input', () => this.clearError('name'));
    }

    if (phoneInput) {
      phoneInput.addEventListener('blur', () => this.validatePhone());
      phoneInput.addEventListener('input', () => this.clearError('phone'));
    }

    if (emailInput) {
      emailInput.addEventListener('blur', () => this.validateEmail());
      emailInput.addEventListener('input', () => this.clearError('email'));
    }

    if (messageInput) {
      messageInput.addEventListener('blur', () => this.validateMessage());
      messageInput.addEventListener('input', () => this.clearError('message'));
    }
  }

  /**
   * Sanitize input to prevent XSS attacks
   * @param {string} str - Input string to sanitize
   * @returns {string} - Sanitized string
   */
  sanitizeInput(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.textContent || div.innerText || '';
  }

  /**
   * Validate name field
   * @returns {boolean} - True if valid
   */
  validateName() {
    const nameInput = document.getElementById('name');
    const value = this.sanitizeInput(nameInput.value.trim());
    const rules = this.config.validation.name;

    // Check if empty
    if (!value) {
      this.setError('name', 'Name is required');
      return false;
    }

    // Check minimum length
    if (value.length < rules.minLength) {
      this.setError('name', `Name must be at least ${rules.minLength} characters`);
      return false;
    }

    // Check maximum length
    if (value.length > rules.maxLength) {
      this.setError('name', `Name must not exceed ${rules.maxLength} characters`);
      return false;
    }

    // Check pattern
    if (!rules.pattern.test(value)) {
      this.setError('name', 'Name can only contain letters, spaces, hyphens, and apostrophes');
      return false;
    }

    this.setSuccess('name');
    return true;
  }

  /**
   * Validate phone field
   * @returns {boolean} - True if valid
   */
  validatePhone() {
    const phoneInput = document.getElementById('phone');
    const rawValue = phoneInput.value.trim();
    const value = this.sanitizeInput(rawValue);
    const rules = this.config.validation.phone;

    // Required
    if (!value) {
      this.setError('phone', 'Phone number is required');
      return false;
    }

    // Allowed characters check
    if (!rules.allowedPattern.test(value)) {
      this.setError('phone', 'Phone can include digits, +, spaces, -, . and ()');
      return false;
    }

    // Digit count check (strip non-digits)
    const digitsOnly = value.replace(/\D+/g, '');
    if (digitsOnly.length < rules.minDigits || digitsOnly.length > rules.maxDigits) {
      this.setError('phone', `Phone must have ${rules.minDigits}-${rules.maxDigits} digits`);
      return false;
    }

    this.setSuccess('phone');
    return true;
  }

  /**
   * Validate email field
   * @returns {boolean} - True if valid
   */
  validateEmail() {
    const emailInput = document.getElementById('email');
    const value = this.sanitizeInput(emailInput.value.trim());
    const rules = this.config.validation.email;

    // Check if empty
    if (!value) {
      this.setError('email', 'Email is required');
      return false;
    }

    // Check pattern
    if (!rules.pattern.test(value)) {
      this.setError('email', 'Please enter a valid email address');
      return false;
    }

    // Additional email validation (check for common typos)
    if (value.includes('..') || value.startsWith('.') || value.startsWith('@')) {
      this.setError('email', 'Please enter a valid email address');
      return false;
    }

    this.setSuccess('email');
    return true;
  }

  /**
   * Validate message field
   * @returns {boolean} - True if valid
   */
  validateMessage() {
    const messageInput = document.getElementById('message');
    const value = this.sanitizeInput(messageInput.value.trim());
    const rules = this.config.validation.message;

    // Check if empty
    if (!value) {
      this.setError('message', 'Message is required');
      return false;
    }

    // Check minimum length
    if (value.length < rules.minLength) {
      this.setError('message', `Message must be at least ${rules.minLength} characters`);
      return false;
    }

    // Check maximum length
    if (value.length > rules.maxLength) {
      this.setError('message', `Message must not exceed ${rules.maxLength} characters`);
      return false;
    }

    this.setSuccess('message');
    return true;
  }

  /**
   * Display error for a field
   * @param {string} fieldName - Name of the field
   * @param {string} message - Error message to display
   */
  setError(fieldName, message) {
    const field = document.getElementById(fieldName);
    const fieldWrapper = field.closest('.field-wrapper') || field.parentElement;
    const errorElement = fieldWrapper.querySelector('.error-message') || 
                        document.querySelector(`#${fieldName}-error`);

    if (field) {
      field.classList.remove('success');
      field.classList.add('error');
      fieldWrapper?.classList.remove('success');
    }

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('show');
    }

    this.errors[fieldName] = message;
  }

  /**
   * Mark field as successful
   * @param {string} fieldName - Name of the field
   */
  setSuccess(fieldName) {
    const field = document.getElementById(fieldName);
    const fieldWrapper = field?.closest('.field-wrapper') || field?.parentElement;
    const errorElement = fieldWrapper?.querySelector('.error-message') || 
                        document.querySelector(`#${fieldName}-error`);

    if (field) {
      field.classList.remove('error');
      field.classList.add('success');
      fieldWrapper?.classList.add('success');
    }

    if (errorElement) {
      errorElement.classList.remove('show');
    }

    delete this.errors[fieldName];
  }

  /**
   * Clear error for a field
   * @param {string} fieldName - Name of the field
   */
  clearError(fieldName) {
    if (!this.errors[fieldName]) {
      const field = document.getElementById(fieldName);
      if (field) {
        field.classList.remove('error');
      }
    }
  }

  /**
   * Validate entire form
   * @returns {boolean} - True if all fields are valid
   */
  validateForm() {
    const isNameValid = this.validateName();
    const isPhoneValid = this.validatePhone();
    const isEmailValid = this.validateEmail();
    const isMessageValid = this.validateMessage();

    return isNameValid && isPhoneValid && isEmailValid && isMessageValid;
  }

  /**
   * Get all validation errors
   * @returns {Object} - Object containing all errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Check if form is valid
   * @returns {boolean} - True if form has no errors
   */
  isValid() {
    return Object.keys(this.errors).length === 0;
  }

  /**
   * Reset all validation states
   */
  reset() {
    const fields = ['name', 'phone', 'email', 'message'];
    fields.forEach(fieldName => {
      const field = document.getElementById(fieldName);
      const fieldWrapper = field?.closest('.field-wrapper') || field?.parentElement;
      const errorElement = fieldWrapper?.querySelector('.error-message') || 
                          document.querySelector(`#${fieldName}-error`);

      if (field) {
        field.classList.remove('error', 'success');
        fieldWrapper?.classList.remove('success');
      }

      if (errorElement) {
        errorElement.classList.remove('show');
      }
    });

    this.errors = {};
  }
}

