/**
 * Form Handler Module
 * Handles form submission, API communication, and user feedback
 * Author: Eng. Eslam Osama Saad (EOPeak)
 */

class FormHandler {
  constructor(config, validator) {
    this.config = config;
    this.validator = validator;
    this.isSubmitting = false;
    this.messageTimeout = null; // Track message auto-dismiss timeout
    this.lastSubmittedData = null; // Store last submitted data for iframe notifications
    this.persistDebounceId = null; // Debounce timer for draft save
    this.init();
  }

  /**
   * Initialize form handler
   */
  init() {
    const form = document.getElementById('serviceForm');
    if (!form) {
      console.error('Form element not found');
      return;
    }

    // Set up form submission handler
    form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Draft persistence: restore on load and persist on input
    if (this.config.persistence && this.config.persistence.enabled) {
      this.restoreDraft();
      const form = document.getElementById('serviceForm');
      const persistHandler = () => this.debouncedSaveDraft();
      ['input', 'change'].forEach(evt => {
        form.addEventListener(evt, persistHandler, true);
      });
    }
  }

  /**
   * Handle form submission
   * @param {Event} e - Submit event
   */
  async handleSubmit(e) {
    e.preventDefault();

    // Prevent double submission
    if (this.isSubmitting) {
      return;
    }

    // Validate form before submission
    if (!this.validator.validateForm()) {
      this.showMessage('Please correct the errors before submitting', 'error');
      this.focusFirstError();
      return;
    }

    // Get form data
    const formData = this.getFormData();
    if (!formData) {
      return;
    }

    // Submit form
    await this.submitForm(formData);
  }

  /**
   * Get sanitized form data
   * @returns {Object|null} - Form data object or null if invalid
   */
  getFormData() {
    const form = document.getElementById('serviceForm');
    if (!form) return null;

    return {
      name: this.validator.sanitizeInput(form.name.value.trim()),
      phone: this.validator.sanitizeInput(form.phone.value.trim()),
      email: this.validator.sanitizeInput(form.email.value.trim()),
      message: this.validator.sanitizeInput(form.message.value.trim()),
      // Anti-bot & telemetry fields (non-PII tokens)
      honeypot: (form.company && typeof form.company.value === 'string') ? form.company.value : '',
      pageLoadTs: (typeof window.__FORM_PAGELOAD_TS__ === 'number') ? window.__FORM_PAGELOAD_TS__ : Date.now(),
      elapsedMs: (typeof window.__FORM_PAGELOAD_TS__ === 'number') ? (Date.now() - window.__FORM_PAGELOAD_TS__) : 0,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  }

  /**
   * Convert form data to URLSearchParams for form-urlencoded format
   * @param {Object} data - Form data object
   * @returns {URLSearchParams} - URL-encoded parameters
   */
  convertToFormData(data) {
    const params = new URLSearchParams();
    
    // Add all fields to URLSearchParams
    Object.keys(data).forEach(key => {
      const value = data[key];
      // Convert non-string values to strings
      if (value !== null && value !== undefined) {
        params.append(key, String(value));
      }
    });
    
    return params;
  }

  /**
   * Submit form to API
   * Uses fallback mechanism: tries CORS first, falls back to no-cors with optimistic handling
   * @param {Object} formData - Form data to submit
   */
  async submitForm(formData) {
    this.isSubmitting = true;
    const submitBtn = document.getElementById('submitBtn');
    const responseMessage = document.getElementById('responseMessage');

    // Update UI state
    this.setLoadingState(true);
    this.showMessage('Submitting your request...', 'info');

    // Client-side rate limiting (cooldown & exponential backoff)
    const cooldownKey = 'form_submission_cooldown';
    const attemptsKey = 'form_submission_attempts';
    const now = Date.now();
    try {
      const lastTs = parseInt(localStorage.getItem(cooldownKey) || '0', 10);
      const attempts = parseInt(localStorage.getItem(attemptsKey) || '0', 10);
      const baseCooldown = 5000; // 5s
      const backoff = Math.min(60000, baseCooldown * Math.pow(2, Math.max(0, attempts - 1))); // up to 60s
      const remaining = (lastTs + backoff) - now;
      if (remaining > 0) {
        this.setLoadingState(false);
        this.isSubmitting = false;
        this.showMessage(`Please wait ${Math.ceil(remaining/1000)}s before trying again.`, 'error');
        return;
      }
    } catch (_) {}

    // Store submitted data for later notifications (success/error)
    this.lastSubmittedData = { ...formData };
    // Notify parent (iframe) that submission started
    if (window.IframeIntegration && typeof window.IframeIntegration.notifySubmitStart === 'function') {
      window.IframeIntegration.notifySubmitStart();
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);

      // Prepare request based on configured format
      let requestBody;
      let requestHeaders = {};

      if (this.config.requestFormat === 'form-urlencoded') {
        // Use form-urlencoded format to avoid CORS preflight issues
        // Google Apps Script Web Apps handle form-urlencoded natively without CORS preflight
        // Using URLSearchParams directly lets the browser set Content-Type automatically (no preflight)
        requestBody = this.convertToFormData(formData);
        // Don't set Content-Type header - browser will set it automatically with URLSearchParams
        // This avoids CORS preflight requests
      } else {
        // Fallback to JSON format
        requestBody = JSON.stringify(formData);
        requestHeaders['Content-Type'] = 'application/json';
      }

      // Try CORS mode first (allows reading response)
      let response;
      let result;
      let corsSucceeded = false;

      try {
        response = await this.retryCorsRequest({
          url: this.config.apiEndpoint,
          options: {
            method: 'POST',
            headers: requestHeaders,
            body: requestBody,
            signal: controller.signal,
            mode: 'cors',
            credentials: 'omit'
          }
        });

        clearTimeout(timeoutId);

        // Check response status
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Parse response - Google Apps Script may return text or JSON
        const responseContentType = response.headers.get('content-type');
        
        if (responseContentType && responseContentType.includes('application/json')) {
          result = await response.json();
        } else {
          // Handle text response and try to parse as JSON
          const text = await response.text();
          try {
            result = JSON.parse(text);
          } catch (e) {
            // If not JSON, treat as success message
            result = { status: 'success', message: text || 'Thank you! Your message has been sent successfully.' };
          }
        }

        corsSucceeded = true;
      } catch (corsError) {
        // CORS failed - this is common with Google Apps Script Web Apps
        // Fallback to no-cors (cannot read response), avoid false success.
        clearTimeout(timeoutId);
        
        // Create new abort controller for no-cors request
        const noCorsController = new AbortController();
        const noCorsTimeoutId = setTimeout(() => noCorsController.abort(), this.config.requestTimeout);

        try {
          // Submit with no-cors mode (can't read response, but request goes through)
          await fetch(this.config.apiEndpoint, {
            method: 'POST',
            headers: requestHeaders,
            body: requestBody,
            signal: noCorsController.signal,
            mode: 'no-cors', // This bypasses CORS but we can't read the response
            credentials: 'omit'
          });

          clearTimeout(noCorsTimeoutId);

          // We cannot read the response in no-cors mode. Report pending.
          result = {
            status: 'pending',
            message: 'Submitted. Awaiting confirmation...'
          };

        } catch (noCorsError) {
          // Even no-cors failed - this indicates a network issue
          throw new Error('Network request failed. Please check your connection.');
        }
      }

      // Handle response (from CORS or optimistic from no-cors)
      if (result.status === 'success') {
        this.handleSuccess(result.message || 'Thank you! Your message has been sent successfully.');
        // Reset attempts on success
        try {
          localStorage.setItem('form_submission_attempts', '0');
          localStorage.setItem('form_submission_cooldown', String(Date.now()));
        } catch (_) {}
      } else if (result.status === 'pending') {
        this.showMessage(result.message || 'Submitted. Awaiting confirmation...', 'info');
        this.trackEvent('form_submission', 'pending');
      } else {
        this.handleError(result.message || 'An error occurred. Please try again.');
        // Increase attempts and set cooldown
        try {
          const attempts = parseInt(localStorage.getItem('form_submission_attempts') || '0', 10) + 1;
          localStorage.setItem('form_submission_attempts', String(attempts));
          localStorage.setItem('form_submission_cooldown', String(Date.now()));
        } catch (_) {}
      }

    } catch (error) {
      this.handleNetworkError(error);
      try {
        const attempts = parseInt(localStorage.getItem('form_submission_attempts') || '0', 10) + 1;
        localStorage.setItem('form_submission_attempts', String(attempts));
        localStorage.setItem('form_submission_cooldown', String(Date.now()));
      } catch (_) {}
    } finally {
      // Reset UI state
      this.setLoadingState(false);
      this.isSubmitting = false;

      // Re-enable button after delay
      setTimeout(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
        }
      }, this.config.buttonReenableDelay);

      // Notify parent (iframe) that submission ended
      if (window.IframeIntegration && typeof window.IframeIntegration.notifySubmitEnd === 'function') {
        window.IframeIntegration.notifySubmitEnd();
      }
    }
  }

  /**
   * Handle successful submission
   * @param {string} message - Success message
   */
  handleSuccess(message) {
    this.showMessage(message, 'success');
    // Notify parent (iframe) of success
    if (window.IframeIntegration && typeof window.IframeIntegration.notifySubmission === 'function') {
      const payload = {
        message,
        data: {
          name: this.lastSubmittedData?.name,
          phone: this.lastSubmittedData?.phone,
          email: this.lastSubmittedData?.email
        }
      };
      window.IframeIntegration.notifySubmission('success', payload);
    }
    
    // Reset form and validation immediately
    const form = document.getElementById('serviceForm');
    if (form) {
      form.reset();
      this.validator.reset();
      // Clear saved draft on success
      this.clearDraft();
    }

    // After message auto-dismisses, reset form visual state completely
    const resetDelay = (this.config.message && this.config.message.successDisplayDuration) 
      ? this.config.message.successDisplayDuration + (this.config.message.autoDismissDelay || 500) + 300
      : 5000;

    setTimeout(() => {
      // Reset all validation states
      const inputs = form.querySelectorAll('.form-input, .form-textarea');
      inputs.forEach(input => {
        input.classList.remove('success', 'error');
        const wrapper = input.closest('.field-wrapper');
        if (wrapper) {
          wrapper.classList.remove('success');
        }
      });

      // Focus on first field for better UX
      const firstField = document.getElementById('name');
      if (firstField) {
        firstField.focus();
      }
    }, resetDelay);

    // Track successful submission (analytics placeholder)
    this.trackEvent('form_submission', 'success');
  }

  /**
   * Handle error response
   * @param {string} message - Error message
   */
  handleError(message) {
    this.showMessage(`Error: ${message}`, 'error');
    this.trackEvent('form_submission', 'error', { message });
    // Notify parent (iframe) of error
    if (window.IframeIntegration && typeof window.IframeIntegration.notifySubmission === 'function') {
      const payload = { message };
      window.IframeIntegration.notifySubmission('error', payload);
    }
  }

  /**
   * Handle network errors
   * @param {Error} error - Error object
   */
  handleNetworkError(error) {
    let message = 'Network error. Please check your connection and try again.';

    if (error.name === 'AbortError') {
      message = 'Request timed out. Please try again.';
    } else if (error.message && (error.message.includes('CORS') || error.message.includes('Failed to fetch'))) {
      // CORS-specific error handling for Google Apps Script
      message = 'Connection issue detected. Please ensure the Google Apps Script Web App is deployed correctly.';
      console.error('CORS or network error:', error);
      
      // Provide helpful debugging info
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (isLocalhost) {
        console.warn('Development Note:');
        console.warn('1. Google Apps Script Web Apps must be deployed with "Anyone" access');
        console.warn('2. Ensure you\'re using the /exec endpoint (not /dev)');
        console.warn('3. The Web App must be deployed, not just saved');
        console.warn('4. CORS issues from localhost are common - test on a deployed domain');
        message += ' (Localhost: Check Google Apps Script deployment settings)';
      } else {
        console.warn('Production Note: Verify Google Apps Script Web App deployment settings.');
      }
    } else if (error.message) {
      console.error('Form submission error:', error);
      // Check for specific error patterns
      if (error.message.includes('network') || error.message.includes('fetch')) {
        message = 'Unable to connect to the server. Please check your internet connection and try again.';
      }
    }

    this.showMessage(message, 'error');
    this.trackEvent('form_submission', 'network_error', { 
      error: error.message || error.toString(),
      errorType: error.name || 'Unknown',
      isCorsError: error.message && (error.message.includes('CORS') || error.message.includes('Failed to fetch'))
    });
  }

  /**
   * Show user message
   * @param {string} message - Message to display
   * @param {string} type - Message type (success, error, info)
   */
  showMessage(message, type = 'info') {
    const responseMessage = document.getElementById('responseMessage');
    if (!responseMessage) return;

    // Clear any existing timeout for auto-dismiss
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
      this.messageTimeout = null;
    }

    // Sanitize message to prevent XSS
    const sanitizedMessage = this.validator.sanitizeInput(message);

    // Clear previous classes
    responseMessage.className = 'response-message';
    responseMessage.classList.add(type);

    // Set icon based on type
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ'
    };

    responseMessage.innerHTML = `
      <span class="response-icon" aria-hidden="true">${icons[type] || ''}</span>
      <span>${sanitizedMessage}</span>
    `;

    // Trigger animation
    setTimeout(() => {
      responseMessage.classList.add('show');
    }, 10);

    // Announce to screen readers
    this.announceToScreenReader(sanitizedMessage, type);

    // Auto-dismiss success messages after display duration
    if (type === 'success' && this.config.message && this.config.message.successDisplayDuration) {
      const displayDuration = this.config.message.successDisplayDuration;
      const fadeOutDelay = this.config.message.autoDismissDelay || 500;

      this.messageTimeout = setTimeout(() => {
        this.hideMessage();
      }, displayDuration);
    }
  }

  /**
   * Hide message and reset form to default state
   */
  hideMessage() {
    const responseMessage = document.getElementById('responseMessage');
    if (!responseMessage) return;

    // Remove show class to trigger fade-out animation
    responseMessage.classList.remove('show');

    // After animation completes, clear the message content
    setTimeout(() => {
      responseMessage.className = 'response-message';
      responseMessage.innerHTML = '';
      responseMessage.style.display = 'none';
      
      // Reset display after a brief moment to allow re-animation
      setTimeout(() => {
        responseMessage.style.display = '';
      }, 100);
    }, this.config.animation.messageShow || 300);
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   * @param {string} type - Message type
   */
  announceToScreenReader(message, type) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0;';
    announcement.textContent = `${type === 'error' ? 'Error: ' : type === 'success' ? 'Success: ' : ''}${message}`;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  /**
   * Set loading state
   * @param {boolean} isLoading - Whether form is loading
   */
  setLoadingState(isLoading) {
    const submitBtn = document.getElementById('submitBtn');
    if (!submitBtn) return;

    submitBtn.disabled = isLoading;

    if (isLoading) {
      submitBtn.classList.add('loading');
      submitBtn.setAttribute('aria-busy', 'true');
    } else {
      submitBtn.classList.remove('loading');
      submitBtn.removeAttribute('aria-busy');
    }
  }

  /**
   * Focus first field with error
   */
  focusFirstError() {
    const firstErrorField = document.querySelector('.form-input.error, .form-textarea.error');
    if (firstErrorField) {
      firstErrorField.focus();
      firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Set up keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Enter to submit form
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const form = document.getElementById('serviceForm');
        if (form && !this.isSubmitting) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    });
  }

  /**
   * Track events (analytics placeholder)
   * @param {string} event - Event name
   * @param {string} action - Action type
   * @param {Object} data - Additional data
   */
  trackEvent(event, action, data = {}) {
    // Placeholder for analytics integration
    if (typeof console !== 'undefined' && console.log) {
      console.log('Event tracked:', { event, action, data, timestamp: new Date().toISOString() });
    }
  }

  /**
   * Retry helper for CORS request with exponential backoff
   * @param {{url:string, options:RequestInit}} req
   */
  async retryCorsRequest(req) {
    const policy = this.config.retry || { maxAttempts: 3, initialDelayMs: 600, backoffFactor: 2, maxDelayMs: 4000 };
    let attempt = 0;
    let delay = policy.initialDelayMs;
    let lastError;
    while (attempt < policy.maxAttempts) {
      try {
        const resp = await fetch(req.url, req.options);
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        return resp;
      } catch (err) {
        lastError = err;
        attempt += 1;
        if (attempt >= policy.maxAttempts) break;
        await this.sleep(Math.min(delay, policy.maxDelayMs || delay));
        delay = Math.min(delay * (policy.backoffFactor || 2), policy.maxDelayMs || delay);
      }
    }
    throw lastError || new Error('Request failed');
  }

  sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  /** Draft persistence **/
  debouncedSaveDraft() {
    clearTimeout(this.persistDebounceId);
    const wait = (this.config.persistence && this.config.persistence.debounceMs) || 300;
    this.persistDebounceId = setTimeout(() => this.saveDraft(), wait);
  }

  saveDraft() {
    if (!this.config.persistence || !this.config.persistence.enabled) return;
    const key = this.config.persistence.storageKey || 'contactFormDraft';
    const form = document.getElementById('serviceForm');
    if (!form) return;
    const draft = {
      name: form.name?.value || '',
      phone: form.phone?.value || '',
      email: form.email?.value || '',
      message: form.message?.value || ''
    };
    try { localStorage.setItem(key, JSON.stringify(draft)); } catch (_) {}
  }

  restoreDraft() {
    if (!this.config.persistence || !this.config.persistence.enabled) return;
    const key = this.config.persistence.storageKey || 'contactFormDraft';
    let raw;
    try { raw = localStorage.getItem(key); } catch (_) { raw = null; }
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const form = document.getElementById('serviceForm');
      if (!form) return;
      if (data.name && form.name) form.name.value = data.name;
      if (data.phone && form.phone) form.phone.value = data.phone;
      if (data.email && form.email) form.email.value = data.email;
      if (data.message && form.message) form.message.value = data.message;
    } catch (_) {}
  }

  clearDraft() {
    if (!this.config.persistence || !this.config.persistence.enabled) return;
    const key = this.config.persistence.storageKey || 'contactFormDraft';
    try { localStorage.removeItem(key); } catch (_) {}
  }
}

