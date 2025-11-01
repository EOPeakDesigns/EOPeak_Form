(function () {
  'use strict';

  var pageLoadTimestamp = Date.now();
  window.__FORM_PAGELOAD_TS__ = pageLoadTimestamp;

  /**
   * Mobile keyboard detection helper for iOS Safari
   * Detects when virtual keyboard opens/closes to improve scroll behavior
   */
  function initKeyboardDetection() {
    if (window.innerWidth > 768) return; // Desktop only, skip
    
    var body = document.body;
    var viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    var initialHeight = viewportHeight;
    
    function handleViewportResize() {
      if (!window.visualViewport) return;
      var currentHeight = window.visualViewport.height;
      var heightDiff = initialHeight - currentHeight;
      
      // If viewport shrunk significantly (likely keyboard opened)
      if (heightDiff > 150) {
        body.classList.add('keyboard-open');
      } else {
        body.classList.remove('keyboard-open');
      }
    }
    
    // Use Visual Viewport API if available (modern iOS Safari)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    } else {
      // Fallback: detect input focus/blur (less reliable but works on older browsers)
      var inputs = document.querySelectorAll('.form-input, .form-textarea');
      inputs.forEach(function(input) {
        input.addEventListener('focus', function() {
          setTimeout(function() {
            var currentHeight = window.innerHeight;
            if (currentHeight < initialHeight * 0.75) {
              body.classList.add('keyboard-open');
            }
          }, 300); // Delay to allow keyboard animation
        });
        
        input.addEventListener('blur', function() {
          body.classList.remove('keyboard-open');
        });
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    try {
      var validator = new FormValidator(AppConfig);
      var formHandler = new FormHandler(AppConfig, validator);

      // Initialize mobile keyboard detection
      initKeyboardDetection();

      var firstField = document.getElementById('name');
      if (firstField && typeof firstField.focus === 'function') {
        firstField.focus();
      }

      if (typeof console !== 'undefined' && console.log) {
        console.log('Form application initialized successfully');
      }
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('Initialization error:', err);
      }
    }
  });
})();


