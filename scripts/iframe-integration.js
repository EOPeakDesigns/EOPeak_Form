/**
 * Iframe Integration Module
 * - Posts dynamic height to parent using ResizeObserver
 * - Notifies parent on form lifecycle events (ready, submit start/end, success/error)
 * - Handles simple parent requests (REQUEST_HEIGHT, FOCUS_FIELD, SCROLL_TO_TOP)
 */
(function () {
  'use strict';

  const config = (typeof AppConfig !== 'undefined' && AppConfig.iframe) ? AppConfig.iframe : { enabled: true, allowedParentOrigins: [], heightPostThrottleMs: 120 };

  function isEmbedded() {
    try {
      return window.parent && window.parent !== window.self;
    } catch (_) {
      return false;
    }
  }

  function getTargetOrigins() {
    return Array.isArray(config.allowedParentOrigins) && config.allowedParentOrigins.length > 0
      ? config.allowedParentOrigins
      : ['*'];
  }

  function safePostMessage(message) {
    if (!isEmbedded()) return;
    const origins = getTargetOrigins();
    origins.forEach(origin => {
      try { window.parent.postMessage(message, origin); } catch (_) { /* noop */ }
    });
  }

  // Height posting with throttle
  let lastPostTs = 0;
  function postHeight(force) {
    if (!isEmbedded()) return;
    const now = Date.now();
    if (!force && now - lastPostTs < (config.heightPostThrottleMs || 120)) return;
    lastPostTs = now;

    // Use documentElement scrollHeight for full page height
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    );

    safePostMessage({ type: 'IFRAME_HEIGHT', height });
  }

  // Observe relevant elements for size changes
  let resizeObserver;
  function startObservingHeight() {
    if (!('ResizeObserver' in window)) {
      // Fallback: periodic posting
      setInterval(() => postHeight(false), 500);
      return;
    }

    const target = document.querySelector('.form-container') || document.documentElement;
    resizeObserver = new ResizeObserver(() => postHeight(false));
    resizeObserver.observe(target);
  }

  // Handle parent requests
  function onParentMessage(event) {
    // If strict origins configured, enforce them
    if (Array.isArray(config.allowedParentOrigins) && config.allowedParentOrigins.length > 0) {
      if (!config.allowedParentOrigins.includes(event.origin)) return;
    }

    const data = event && event.data;
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'REQUEST_HEIGHT':
        postHeight(true);
        break;
      case 'FOCUS_FIELD': {
        const id = String(data.id || '').trim();
        if (id) {
          const el = document.getElementById(id);
          if (el && typeof el.focus === 'function') {
            el.focus();
            safePostMessage({ type: 'FOCUS_APPLIED', id });
          }
        }
        break;
      }
      case 'SCROLL_TO_TOP':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      default:
        break;
    }
  }

  // Public API
  const IframeIntegration = {
    notifyReady() {
      if (!isEmbedded()) return;
      safePostMessage({ type: 'FORM_READY', title: document.title || '', ua: navigator.userAgent, vw: window.innerWidth, vh: window.innerHeight });
      postHeight(true);
    },
    notifySubmitStart() {
      if (!isEmbedded()) return;
      safePostMessage({ type: 'FORM_SUBMIT_START' });
    },
    notifySubmitEnd() {
      if (!isEmbedded()) return;
      safePostMessage({ type: 'FORM_SUBMIT_END' });
      postHeight(true);
    },
    notifySubmission(status, payload) {
      if (!isEmbedded()) return;
      safePostMessage({ type: 'FORM_SUBMITTED', success: status === 'success', payload: payload || {} });
      postHeight(true);
    }
  };

  // Expose globally for FormHandler
  window.IframeIntegration = IframeIntegration;

  // Boot if enabled and embedded
  if (config.enabled && isEmbedded()) {
    window.addEventListener('message', onParentMessage, false);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        startObservingHeight();
        IframeIntegration.notifyReady();
      });
    } else {
      startObservingHeight();
      IframeIntegration.notifyReady();
    }
    // Also post on resize
    window.addEventListener('resize', () => postHeight(false));
  }
})();


