/**
 * Social Carousel Component
 * Intelligent horizontal carousel for social buttons when space is insufficient
 * Author: Eng. Eslam Osama Saad (EOPeak)
 */

class SocialCarousel {
  constructor() {
    this.container = null;
    this.wrapper = null;
    this.buttons = [];
    this.carouselTrack = null;
    this.isCarouselMode = false;
    this.animationFrame = null;
    this.animationSpeed = 8; // pixels per second - smooth, professional movement
    this.currentPosition = 0;
    this.isPaused = false;
    this.resizeTimeout = null;
    this.reducedMotionMediaQuery = null;
    this.isDestroying = false; // Flag to prevent race conditions
    this.setWidth = 0; // Width of a single button set
    this.setWidthWithGap = 0; // Width of set including gap after it
    this.gapBetweenSets = 0; // Gap between button sets
    this.navPrevButton = null; // Previous navigation button
    this.navNextButton = null; // Next navigation button
    this.isManualScrolling = false; // Flag to track manual navigation
    this.manualScrollTimeout = null; // Timeout to resume auto-scroll after manual navigation
    this.buttonWidth = 0; // Width of individual button including gap
    this.init();
  }

  /**
   * Initialize the carousel component
   */
  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  /**
   * Setup carousel after DOM is ready
   */
  setup() {
    this.container = document.querySelector('.social-buttons-container');
    this.wrapper = document.querySelector('.social-buttons-wrapper');
    
    if (!this.container || !this.wrapper) {
      console.warn('Social buttons container not found');
      return;
    }

    // Store original wrapper content for restoration
    this.originalContent = this.wrapper.cloneNode(true);

    // Get carousel buttons (exclude Khamsat - keep it separate)
    this.buttons = Array.from(this.wrapper.querySelectorAll('.social-button'))
      .filter(button => !button.classList.contains('social-button--khamsat'));

    // Store Khamsat button separately (if exists)
    const khamsatButton = this.wrapper.querySelector('.social-button--khamsat');
    this.khamsatButton = khamsatButton ? khamsatButton.cloneNode(true) : null;

    if (this.buttons.length === 0) {
      console.warn('No carousel buttons found');
      return;
    }
    
    // Fix persistent hover state on touch devices for ALL buttons (original + non-carousel mode)
    // Add click handlers to original buttons to blur them on touch
    this.setupButtonBlurHandlers();

    // Setup reactive reduced motion preference listener
    this.setupReducedMotionListener();
    
    // Check initial state - single RAF for better performance
    requestAnimationFrame(() => {
      this.checkAndToggleMode();
    });
    
    // Setup resize listener with debouncing
    this.handleResize = () => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        if (!this.isDestroying) {
          this.checkAndToggleMode();
          // Ensure animation auto-resumes after resize completes
          // Use double RAF to wait for DOM updates from checkAndToggleMode
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.ensureAutoRunAfterResize();
            });
          });
        }
      }, 150);
    };
    window.addEventListener('resize', this.handleResize);

    // Get navigation buttons
    this.navPrevButton = this.container.querySelector('.carousel-nav-button--prev');
    this.navNextButton = this.container.querySelector('.carousel-nav-button--next');

    // Setup navigation button handlers
    if (this.navPrevButton) {
      this.handleNavPrev = (e) => {
        e.preventDefault(); // Prevent form submission
        e.stopPropagation(); // Prevent event bubbling
        this.navigatePrev();
      };
      this.navPrevButton.addEventListener('click', this.handleNavPrev);
      // Keyboard support
      this.navPrevButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.navigatePrev();
        }
      });
    }
    if (this.navNextButton) {
      this.handleNavNext = (e) => {
        e.preventDefault(); // Prevent form submission
        e.stopPropagation(); // Prevent event bubbling
        this.navigateNext();
      };
      this.navNextButton.addEventListener('click', this.handleNavNext);
      // Keyboard support
      this.navNextButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.navigateNext();
        }
      });
    }

    // Pause on hover for better UX (only on devices with actual hover capability)
    // Touch devices should not pause carousel on tap
    this.handleMouseEnter = () => {
      // Only pause if device supports hover (not touch-only devices)
      if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
        this.pause();
      }
    };
    this.handleMouseLeave = () => {
      // Only resume if device supports hover
      if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
        this.resume();
      }
    };
    this.container.addEventListener('mouseenter', this.handleMouseEnter);
    this.container.addEventListener('mouseleave', this.handleMouseLeave);
    
    // Handle page visibility changes: resume carousel when user returns
    // This fixes issue where carousel stays paused after clicking button and navigating away
    this.handleVisibilityChange = () => {
      if (!document.hidden && this.isCarouselMode && !this.isPaused) {
        // Page became visible - ensure carousel is running
        // Small delay to allow page to stabilize
        setTimeout(() => {
          if (this.isCarouselMode && !this.isPaused && !this.isManualScrolling) {
            this.startAnimation();
          }
        }, 100);
      }
    };
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Handle page focus: blur all social buttons to clear persistent hover states
    // This fixes persistent hover effect when user returns to page
    this.handlePageFocus = () => {
      if (this.wrapper) {
        const allButtons = this.wrapper.querySelectorAll('.social-button');
        allButtons.forEach(button => {
          if (button && typeof button.blur === 'function') {
            button.blur();
          }
          // Remove any hover-related classes
          button.classList.remove('hover', 'hovered');
        });
      }
      // Also blur carousel track buttons if they exist
      if (this.carouselTrack) {
        const trackButtons = this.carouselTrack.querySelectorAll('.social-button');
        trackButtons.forEach(button => {
          if (button && typeof button.blur === 'function') {
            button.blur();
          }
          button.classList.remove('hover', 'hovered');
        });
      }
      // Resume carousel if it should be running
      if (!document.hidden && this.isCarouselMode && !this.isPaused && !this.isManualScrolling) {
        setTimeout(() => {
          this.startAnimation();
        }, 100);
      }
    };
    window.addEventListener('focus', this.handlePageFocus);
    // Also handle when page becomes visible (handles cases where focus event doesn't fire)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.handlePageFocus();
      }
    });
  }

  /**
   * Ensure carousel is running after a resize recalculation
   * Forces resume regardless of previous hover pause
   */
  ensureAutoRunAfterResize() {
    if (!this.container) return;
    // If carousel is active and track exists, force resume
    if (this.isCarouselMode && this.carouselTrack) {
      // Clear any manual scrolling lock and hover pause
      this.isManualScrolling = false;
      this.isPaused = false;
      this.startAnimation();
    }
  }

  /**
   * Setup blur handlers for social buttons to prevent persistent hover states on touch
   */
  setupButtonBlurHandlers() {
    if (!this.wrapper) return;
    
    // Setup blur handler for a single button
    const setupBlur = (button) => {
      if (!button || button.dataset.blurHandlerAdded) return;
      button.dataset.blurHandlerAdded = 'true';
      
      // Blur on click to remove focus/hover state
      button.addEventListener('click', function() {
        if (this.blur) {
          this.blur();
        }
        this.classList.remove('hover', 'hovered');
        // Additional blur after small delay to ensure it sticks
        setTimeout(() => {
          if (this.blur) {
            this.blur();
          }
        }, 10);
      }, { passive: true });
      
      // Blur on touchstart to prevent hover activation
      button.addEventListener('touchstart', function() {
        if (this.blur) {
          this.blur();
        }
      }, { passive: true });
    };
    
    // Setup handlers for all current buttons
    const allButtons = this.wrapper.querySelectorAll('.social-button');
    allButtons.forEach(setupBlur);
  }

  /**
   * Setup reactive reduced motion preference listener
   */
  setupReducedMotionListener() {
    if (!window.matchMedia) return;
    
    this.reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    // Set initial state
    if (this.reducedMotionMediaQuery.matches) {
      this.isPaused = true;
    }
    
    // Store handler reference for cleanup
    this.handleReducedMotionChange = (e) => {
      if (e.matches) {
        this.pause();
      } else if (this.isCarouselMode) {
        this.resume();
      }
    };
    
    // Modern browsers
    if (this.reducedMotionMediaQuery.addEventListener) {
      this.reducedMotionMediaQuery.addEventListener('change', this.handleReducedMotionChange);
    } else {
      // Fallback for older browsers
      this.reducedMotionMediaQuery.addListener(this.handleReducedMotionChange);
    }
  }

  /**
   * Check if buttons fit horizontally and toggle between modes
   */
  checkAndToggleMode() {
    if (!this.wrapper || this.buttons.length === 0 || this.isDestroying) return;

    // Check if wrapper is visible
    const wrapperStyle = window.getComputedStyle(this.wrapper);
    if (wrapperStyle.display === 'none' || wrapperStyle.visibility === 'hidden') {
      return;
    }

    // Temporarily disable carousel to measure natural width
    const wasCarouselMode = this.isCarouselMode;
    if (wasCarouselMode) {
      this.destroyCarousel();
      // Single RAF for better performance
      requestAnimationFrame(() => {
        this.performMeasurement(wasCarouselMode);
      });
    } else {
      this.performMeasurement(wasCarouselMode);
    }
  }

  /**
   * Perform measurement and toggle carousel if needed
   * @param {boolean} wasCarouselMode - Whether carousel was active before measurement
   */
  performMeasurement(wasCarouselMode) {
    if (!this.wrapper || this.buttons.length === 0 || this.isDestroying) return;

    // Measure if buttons fit without wrapping
    const wrapperRect = this.wrapper.getBoundingClientRect();
    
    // Validate wrapper dimensions
    if (wrapperRect.width === 0 || wrapperRect.height === 0) {
      return;
    }
    
    const gap = parseFloat(getComputedStyle(this.wrapper).gap) || 16;
    
    // Calculate carousel buttons width with error handling
    let buttonsWidth = 0;
    let validButtons = 0;
    
    this.buttons.forEach(btn => {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        buttonsWidth += rect.width;
        validButtons++;
      }
    });
    
    // If no valid buttons, don't activate carousel
    if (validButtons === 0) {
      return;
    }
    
    // Account for gaps between carousel buttons
    const carouselButtonsWidth = buttonsWidth + (gap * Math.max(0, validButtons - 1));
    
    // Account for Khamsat button if it exists (check in wrapper)
    let khamsatWidth = 0;
    const khamsatRect = this.wrapper.querySelector('.social-button--khamsat');
    if (khamsatRect) {
      const khamsatRectBounds = khamsatRect.getBoundingClientRect();
      if (khamsatRectBounds.width > 0) {
        khamsatWidth = khamsatRectBounds.width + gap;
      }
    }
    
    // Check if carousel buttons alone need carousel, or if total width exceeds container
    const totalWidth = carouselButtonsWidth + khamsatWidth;
    const needsCarousel = totalWidth > wrapperRect.width;

    if (needsCarousel && !this.isCarouselMode) {
      this.activateCarousel();
    } else if (!needsCarousel && this.isCarouselMode) {
      this.destroyCarousel();
    }
  }

  /**
   * Activate carousel mode
   */
  activateCarousel() {
    if (this.isCarouselMode) return;

    this.isCarouselMode = true;
    this.container.classList.add('social-carousel-active');

    // Show navigation buttons
    this.showNavigationButtons();

    // Create carousel track
    this.createCarouselTrack();

    // Animation will start automatically after dimensions are calculated
    // This prevents lagging and ensures smooth start
  }

  /**
   * Create carousel track structure
   */
  createCarouselTrack() {
    // Create track element
    this.carouselTrack = document.createElement('div');
    this.carouselTrack.className = 'social-carousel-track';
    this.carouselTrack.setAttribute('aria-label', 'Social media links carousel');

    // Clone buttons for seamless loop (need at least 3 sets for seamless infinite scroll)
    const buttonSet1 = this.createButtonSet(0);
    const buttonSet2 = this.createButtonSet(1);
    const buttonSet3 = this.createButtonSet(2);

    // Batch DOM operations - append all sets at once
    this.carouselTrack.appendChild(buttonSet1);
    this.carouselTrack.appendChild(buttonSet2);
    this.carouselTrack.appendChild(buttonSet3);

    // Clear wrapper and add track (Khamsat will be added separately if it exists)
    this.wrapper.innerHTML = '';
    this.wrapper.appendChild(this.carouselTrack);
    
    // Add Khamsat button after carousel if it exists
    if (this.khamsatButton) {
      this.khamsatButton.classList.add('social-button--carousel-separate');
      this.wrapper.appendChild(this.khamsatButton);
    }

    // Force synchronous layout calculation for immediate dimension access
    // This ensures WhatsApp appears immediately without delay
    this.calculateDimensionsImmediately();
  }

  /**
   * Create a set of cloned buttons
   * @param {number} setIndex - Index of the button set (0, 1, 2, etc.)
   * @returns {HTMLElement} - Container div with cloned buttons
   */
  createButtonSet(setIndex) {
    const set = document.createElement('div');
    set.className = 'social-carousel-set';
    set.setAttribute('data-set-index', setIndex);

    this.buttons.forEach((originalButton, index) => {
      const clone = originalButton.cloneNode(true);
      clone.classList.add('social-carousel-item');
      clone.setAttribute('aria-hidden', setIndex > 0 ? 'true' : 'false');
      
      // Maintain original functionality
      if (originalButton.href && originalButton.href !== '#') {
        clone.href = originalButton.href;
      }
      
      // Fix persistent hover state on touch devices: blur immediately on click
      // This prevents hover state from persisting when user returns to page
      clone.addEventListener('click', (e) => {
        // Blur immediately to remove focus/hover state
        if (clone.focus) {
          clone.blur();
        }
        // Force remove any hover classes (if they exist)
        clone.classList.remove('hover', 'hovered');
        // Small delay to ensure blur completes before navigation
        setTimeout(() => {
          if (clone.focus) {
            clone.blur();
          }
        }, 10);
      }, { passive: true });
      
      // Also blur on touchstart to prevent hover activation
      clone.addEventListener('touchstart', () => {
        if (clone.focus) {
          clone.blur();
        }
      }, { passive: true });
      
      set.appendChild(clone);
    });

    return set;
  }

  /**
   * Calculate dimensions immediately (synchronous) for performance
   * This ensures WhatsApp appears immediately without delay
   */
  calculateDimensionsImmediately() {
    if (!this.carouselTrack || !this.buttons.length) return;

    const firstSet = this.carouselTrack.querySelector('.social-carousel-set');
    if (!firstSet) {
      // Fallback: use requestAnimationFrame if immediate calculation fails
      requestAnimationFrame(() => this.updateTrackDimensions());
      return;
    }

    // Force layout calculation by reading offsetWidth
    // This triggers browser reflow synchronously
    const setWidth = firstSet.offsetWidth;
    
    // Get gap between sets from computed style
    const trackStyle = window.getComputedStyle(this.carouselTrack);
    const gapBetweenSets = parseFloat(trackStyle.gap) || 0;
    
    // Validate set width
    if (setWidth === 0 || !isFinite(setWidth)) {
      // Retry with RAF if dimensions aren't ready
      requestAnimationFrame(() => this.updateTrackDimensions());
      return;
    }
    
    // Calculate total width: 3 sets + 2 gaps between them
    const setWithGap = setWidth + gapBetweenSets;
    const totalWidth = (setWidth * 3) + (gapBetweenSets * 2);
    
    // Store set width with gap for seamless loop calculations
    this.setWidthWithGap = setWithGap;
    this.setWidth = setWidth;
    this.gapBetweenSets = gapBetweenSets;
    
    // Calculate individual button width (including gap) for manual navigation
    // This allows scrolling one button at a time
    if (this.buttons.length > 0) {
      const firstButton = firstSet.querySelector('.social-button');
      if (firstButton) {
        const buttonWidth = firstButton.offsetWidth;
        const buttonGap = parseFloat(getComputedStyle(firstSet).gap) || 0;
        this.buttonWidth = buttonWidth + buttonGap;
      }
    }

    // Batch DOM writes - set width and position together
    this.carouselTrack.style.width = `${totalWidth}px`;
    
    // Set initial position to show second set (which starts with WhatsApp)
    // This ensures WhatsApp appears immediately
    this.currentPosition = -(setWidth + gapBetweenSets);
    this.updateTrackPosition();
    
    // Start animation immediately - dimensions are ready
    if (!this.isPaused && this.isCarouselMode && !this.isManualScrolling) {
      this.startAnimation();
    }
  }

  /**
   * Update carousel track dimensions (async fallback)
   */
  updateTrackDimensions() {
    if (!this.carouselTrack || !this.buttons.length) return;

    const firstSet = this.carouselTrack.querySelector('.social-carousel-set');
    if (!firstSet) return;

    // Single RAF call - no nesting for better performance
    requestAnimationFrame(() => {
      const setWidth = firstSet.offsetWidth;
      const trackStyle = window.getComputedStyle(this.carouselTrack);
      const gapBetweenSets = parseFloat(trackStyle.gap) || 0;
      
      if (setWidth === 0 || !isFinite(setWidth)) {
        console.warn('Invalid carousel set width, retrying...');
        setTimeout(() => this.updateTrackDimensions(), 50); // Reduced delay
        return;
      }
      
      const setWithGap = setWidth + gapBetweenSets;
      const totalWidth = (setWidth * 3) + (gapBetweenSets * 2);
      
      this.setWidthWithGap = setWithGap;
      this.setWidth = setWidth;
      this.gapBetweenSets = gapBetweenSets;

      this.carouselTrack.style.width = `${totalWidth}px`;
      this.currentPosition = -(setWidth + gapBetweenSets);
      this.updateTrackPosition();
      
      if (!this.isPaused && this.isCarouselMode) {
        this.startAnimation();
      }
    });
  }

  /**
   * Start infinite animation
   */
  startAnimation() {
    if (!this.isCarouselMode || !this.carouselTrack || this.isPaused) return;

    const animate = () => {
      // Validate state before continuing
      if (!this.isCarouselMode || !this.carouselTrack || this.isPaused) {
        this.animationFrame = null;
        return;
      }

      // Use cached dimensions if available, otherwise measure
      if (this.setWidthWithGap === 0 || this.setWidth === 0) {
        const firstSet = this.carouselTrack.querySelector('.social-carousel-set');
        if (!firstSet) {
          this.animationFrame = null;
          return;
        }

        const setWidth = firstSet.offsetWidth;
        const trackStyle = window.getComputedStyle(this.carouselTrack);
        const gapBetweenSets = parseFloat(trackStyle.gap) || 0;
        
        // Validate set width
        if (setWidth === 0 || !isFinite(setWidth)) {
          this.animationFrame = null;
          return;
        }
        
        this.setWidth = setWidth;
        this.gapBetweenSets = gapBetweenSets;
        this.setWidthWithGap = setWidth + gapBetweenSets;
      }

      // Skip auto-scroll if manual navigation is active
      if (this.isManualScrolling) {
        this.animationFrame = null;
        return;
      }

      const speed = this.animationSpeed / 60; // Convert to pixels per frame (assuming 60fps)

      this.currentPosition -= speed;

      // Use seamless reset logic for infinite loop without visual jumps
      // When we've scrolled exactly one set width, reset to maintain seamless appearance
      // Check if we've moved past the boundary (accounting for negative position)
      const absPosition = Math.abs(this.currentPosition);
      if (absPosition >= this.setWidthWithGap) {
        // Reset by adding the set width, maintaining continuous position
        // This creates seamless loop without visual jump
        // Since position is negative, adding setWidthWithGap brings it back up
        this.currentPosition = this.currentPosition + this.setWidthWithGap;
        
        // Ensure we don't go positive (should always be negative or zero)
        // This prevents any visual glitch
        if (this.currentPosition > 0) {
          this.currentPosition = -(this.setWidth + this.gapBetweenSets);
        }
      }

      this.updateTrackPosition();
      this.animationFrame = requestAnimationFrame(animate);
    };

    // Cancel any existing animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Update track position
   */
  updateTrackPosition() {
    if (!this.carouselTrack) return;
    this.carouselTrack.style.transform = `translateX(${this.currentPosition}px)`;
  }

  /**
   * Show navigation buttons when carousel is active
   */
  showNavigationButtons() {
    if (this.navPrevButton) {
      this.navPrevButton.style.display = 'flex';
    }
    if (this.navNextButton) {
      this.navNextButton.style.display = 'flex';
    }
  }

  /**
   * Hide navigation buttons when carousel is inactive
   */
  hideNavigationButtons() {
    if (this.navPrevButton) {
      this.navPrevButton.style.display = 'none';
    }
    if (this.navNextButton) {
      this.navNextButton.style.display = 'none';
    }
  }

  /**
   * Navigate to previous button (scroll right)
   */
  navigatePrev() {
    if (!this.isCarouselMode || !this.carouselTrack || this.buttonWidth === 0) return;

    // Remove focus to prevent persistent green state
    if (this.navPrevButton) {
      this.navPrevButton.blur();
    }

    // Start resume timeout immediately (not waiting for animation)
    // This ensures auto-scroll resumes after 1 second regardless of hover state
    this.pauseManualNavigation();
    this.resumeAfterManualNavigation();

    // Calculate target position (scroll right = less negative)
    const targetPosition = this.currentPosition + this.buttonWidth;

    // Smooth scroll to target position
    this.smoothScrollTo(targetPosition);
  }

  /**
   * Navigate to next button (scroll left)
   */
  navigateNext() {
    if (!this.isCarouselMode || !this.carouselTrack || this.buttonWidth === 0) return;

    // Remove focus to prevent persistent green state
    if (this.navNextButton) {
      this.navNextButton.blur();
    }

    // Start resume timeout immediately (not waiting for animation)
    // This ensures auto-scroll resumes after 1 second regardless of hover state
    this.pauseManualNavigation();
    this.resumeAfterManualNavigation();

    // Calculate target position (scroll left = more negative)
    const targetPosition = this.currentPosition - this.buttonWidth;

    // Smooth scroll to target position
    this.smoothScrollTo(targetPosition);
  }

  /**
   * Smooth scroll to target position
   * @param {number} targetPosition - Target position to scroll to
   */
  smoothScrollTo(targetPosition) {
    if (!this.carouselTrack) return;

    this.isManualScrolling = true;
    const startPosition = this.currentPosition;
    const distance = targetPosition - startPosition;
    const duration = 300; // milliseconds
    const startTime = performance.now();

    const animateScroll = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      this.currentPosition = startPosition + (distance * easeOut);
      
      // Handle seamless loop during manual scroll
      if (this.setWidthWithGap > 0) {
        const absPosition = Math.abs(this.currentPosition);
        if (absPosition >= this.setWidthWithGap) {
          this.currentPosition = this.currentPosition + this.setWidthWithGap;
        }
        if (this.currentPosition > 0) {
          this.currentPosition = -(this.setWidth + this.gapBetweenSets);
        }
      }
      
      this.updateTrackPosition();

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
      // Note: Resume timeout is started immediately in navigatePrev/Next
      // Not waiting for animation completion ensures auto-scroll resumes
      // even if user hovers over container
    };

    requestAnimationFrame(animateScroll);
  }

  /**
   * Pause auto-scroll for manual navigation
   */
  pauseManualNavigation() {
    this.isManualScrolling = true;
    this.pause();
    
    // Clear any existing timeout
    if (this.manualScrollTimeout) {
      clearTimeout(this.manualScrollTimeout);
    }
  }

  /**
   * Resume auto-scroll after manual navigation
   */
  resumeAfterManualNavigation() {
    // Clear any existing timeout to prevent multiple timeouts
    if (this.manualScrollTimeout) {
      clearTimeout(this.manualScrollTimeout);
    }

    // Resume after 1 second delay as requested
    // Gives user time to continue manual navigation if needed
    // Note: This will resume even if user is hovering (isPaused will be overridden)
    this.manualScrollTimeout = setTimeout(() => {
      this.isManualScrolling = false;
      // Force resume regardless of hover state (user initiated manual navigation)
      if (this.isCarouselMode) {
        this.isPaused = false; // Override hover pause
        this.resume();
      }
    }, 1000); // Resume after 1 second
  }

  /**
   * Pause animation
   */
  pause() {
    this.isPaused = true;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Resume animation
   */
  resume() {
    if (!this.isCarouselMode || !this.carouselTrack) return;
    
    // Respect reduced motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.isPaused = false;
    this.startAnimation();
  }

  /**
   * Destroy carousel and restore original layout
   */
  destroyCarousel() {
    if (!this.isCarouselMode || this.isDestroying) return;

    this.isDestroying = true;
    this.pause();
    this.isCarouselMode = false;
    this.container.classList.remove('social-carousel-active');
    
    // Hide navigation buttons
    this.hideNavigationButtons();
    
    if (this.carouselTrack) {
      this.carouselTrack.remove();
      this.carouselTrack = null;
    }

    // Restore original wrapper content
    if (this.originalContent && this.wrapper) {
      this.wrapper.innerHTML = '';
      Array.from(this.originalContent.children).forEach(child => {
        this.wrapper.appendChild(child.cloneNode(true));
      });
      
      // Update buttons reference after restoration
      this.buttons = Array.from(this.wrapper.querySelectorAll('.social-button'))
        .filter(button => !button.classList.contains('social-button--khamsat'));
      
      // Re-setup blur handlers for restored buttons
      this.setupButtonBlurHandlers();
    }
    
    // Reset destroying flag after a brief delay to allow DOM to stabilize
    requestAnimationFrame(() => {
      this.isDestroying = false;
    });
  }

  /**
   * Cleanup all event listeners and resources
   */
  destroy() {
    this.isDestroying = true;
    this.pause();
    
    // Remove event listeners
    if (this.handleResize) {
      window.removeEventListener('resize', this.handleResize);
    }
    
    if (this.handleMouseEnter && this.container) {
      this.container.removeEventListener('mouseenter', this.handleMouseEnter);
    }
    
    if (this.handleMouseLeave && this.container) {
      this.container.removeEventListener('mouseleave', this.handleMouseLeave);
    }
    
    // Cleanup navigation button handlers
    if (this.navPrevButton && this.handleNavPrev) {
      this.navPrevButton.removeEventListener('click', this.handleNavPrev);
    }
    if (this.navNextButton && this.handleNavNext) {
      this.navNextButton.removeEventListener('click', this.handleNavNext);
    }
    
    // Cleanup visibility and focus handlers
    if (this.handleVisibilityChange) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.handlePageFocus) {
      window.removeEventListener('focus', this.handlePageFocus);
    }
    
    // Clear manual scroll timeout
    if (this.manualScrollTimeout) {
      clearTimeout(this.manualScrollTimeout);
    }
    
    // Cleanup reduced motion listener
    if (this.reducedMotionMediaQuery && this.handleReducedMotionChange) {
      if (this.reducedMotionMediaQuery.removeEventListener) {
        this.reducedMotionMediaQuery.removeEventListener('change', this.handleReducedMotionChange);
      } else if (this.reducedMotionMediaQuery.removeListener) {
        this.reducedMotionMediaQuery.removeListener(this.handleReducedMotionChange);
      }
    }
    
    // Destroy carousel if active
    if (this.isCarouselMode) {
      this.destroyCarousel();
    }
    
    // Clear all references
    this.container = null;
    this.wrapper = null;
    this.buttons = [];
    this.carouselTrack = null;
    this.originalContent = null;
    this.khamsatButton = null;
  }
}

// Initialize carousel when DOM is ready
let socialCarousel;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    socialCarousel = new SocialCarousel();
  });
} else {
  socialCarousel = new SocialCarousel();
}