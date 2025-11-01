/**
 * Application Configuration
 * Centralized configuration management for API endpoints and settings
 * Author: Eng. Eslam Osama Saad (EOPeak)
 */

const AppConfig = {
  // Google Apps Script Web App endpoint
  apiEndpoint: "https://script.google.com/macros/s/AKfycbyc_oJtbz2SqsISszXVrbB2mDjyhXEYApR8edmpPekGrxokbdc55hHaR_GqC59_tJ1k/exec",
  
  // Request format: 'form-urlencoded' or 'json'
  // Using 'form-urlencoded' to avoid CORS preflight issues with Google Apps Script
  requestFormat: 'form-urlencoded',
  
  // Request timeout in milliseconds
  requestTimeout: 30000,
  
  // Button re-enable delay after submission (ms)
  buttonReenableDelay: 1500,
  
  // Form validation settings
  validation: {
    name: {
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-Z\s'-]+$/ // Letters, spaces, hyphens, apostrophes
    },
    phone: {
      // Allow international formats with +, spaces, dashes, dots, parentheses
      // We'll additionally enforce digit count in validator (7-15 digits)
      allowedPattern: /^[0-9+()\-\.\s]+$/,
      minDigits: 7,
      maxDigits: 15
    },
    email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ // Basic email pattern
    },
    message: {
      minLength: 10,
      maxLength: 2000
    }
  },
  
  // Animation durations
  animation: {
    fadeIn: 500,
    shake: 300,
    messageShow: 300
  },
  
  // Message display settings
  message: {
    successDisplayDuration: 4000, // How long to show success message (ms)
    autoDismissDelay: 500 // Delay before starting fade-out animation (ms)
  },

  // Network retry policy (CORS attempt only)
  retry: {
    maxAttempts: 3,
    initialDelayMs: 600,
    backoffFactor: 2,
    maxDelayMs: 4000
  },

  // Form state persistence
  persistence: {
    enabled: true,
    storageKey: 'contactFormDraft',
    debounceMs: 300
  },

  // Iframe integration settings
  iframe: {
    enabled: true,
    // If empty, messages are posted with '*'. For stricter security,
    // add allowed parent origins: ["https://yourdomain.com"]
    allowedParentOrigins: [],
    // Minimum delay between height posts (ms) to avoid spamming parent
    heightPostThrottleMs: 120
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppConfig;
}

