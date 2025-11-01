/**
 * Google Apps Script - Contact Form Handler
 * Handles form submissions and saves to Google Sheets
 * Author: Eng. Eslam Osama Saad (EOPeak)
 * 
 * Spreadsheet Structure:
 * Column A: Name
 * Column B: Phone Number
 * Column C: Email
 * Column D: Message
 */

/**
 * Handle POST requests from the contact form
 * Supports both JSON and form-urlencoded data formats
 * @param {Object} e - Event object containing request data
 * @returns {ContentService.TextOutput} - JSON response with CORS headers
 */
function doPost(e) {
  try {
    // Open the spreadsheet by ID
    var spreadsheetId = "1mON1Zpqs1kjBcU309_QUHaloI2o99Gfe4eSLeryXw5Y";
    var sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();
    
    // Parse request data - handle both JSON and form-urlencoded formats
    var formData = parseRequestData(e);
    
    // Extract and sanitize form fields
    var name = sanitizeInput(formData.name || "");
    var phone = sanitizeInput(formData.phone || "");
    var email = sanitizeInput(formData.email || "");
    var message = sanitizeInput(formData.message || "");
    var honeypot = String(formData.honeypot || "");
    var elapsedMs = Number(formData.elapsedMs || 0);
    
    // Basic anti-bot: honeypot must be empty
    if (honeypot && honeypot.trim() !== "") {
      throw new Error("Suspicious submission detected.");
    }

    // Validate required fields
    if (!name || !phone || !email || !message) {
      throw new Error("All fields (Name, Phone, Email, Message) are required.");
    }
    
    // Validate email format
    if (!isValidEmail(email)) {
      throw new Error("Invalid email address format.");
    }
    
    // Server-side rate limiting (per email) via CacheService (60s window)
    enforceRateLimit_(email);

    // Append data to sheet - Columns A (Name), B (Phone), C (Email), D (Message)
    sheet.appendRow([name, phone, email, message]);

    // Send notification email
    sendNotificationEmail({ name: name, phone: phone, email: email, message: message });
    
    // Return success response with CORS headers
    return createResponse({
      status: "success",
      message: "Thank you! Your message has been received successfully."
    }, 200);
    
  } catch (error) {
    // Log error for debugging
    Logger.log("Error in doPost: " + error.toString());
    
    // Return error response with CORS headers
    return createResponse({
      status: "error",
      message: error.toString() || "An error occurred while processing your request."
    }, 500);
  }
}

/**
 * Handle OPTIONS requests (CORS preflight)
 * Note: Google Apps Script Web Apps may not call this automatically,
 * but it's included for completeness and future compatibility
 * @param {Object} e - Event object
 * @returns {ContentService.TextOutput} - Empty response with CORS headers
 */
function doOptions(e) {
  return createResponse("", 200);
}

/**
 * Alternative handler that returns HTML with embedded JSON
 * This method works around CORS limitations by returning HTML
 * The frontend can parse the embedded JSON from the HTML response
 * @param {Object} e - Event object containing request data
 * @returns {HtmlService.HtmlOutput} - HTML page with embedded JSON data
 */
function doPostHtml(e) {
  try {
    // Process the request the same way as doPost
    var spreadsheetId = "1mON1Zpqs1kjBcU309_QUHaloI2o99Gfe4eSLeryXw5Y";
    var sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();
    
    var formData = parseRequestData(e);
    var name = sanitizeInput(formData.name || "");
    var phone = sanitizeInput(formData.phone || "");
    var email = sanitizeInput(formData.email || "");
    var message = sanitizeInput(formData.message || "");
    var honeypot = String(formData.honeypot || "");
    
    if (honeypot && honeypot.trim() !== "") {
      throw new Error("Suspicious submission detected.");
    }

    if (!name || !phone || !email || !message) {
      throw new Error("All fields (Name, Phone, Email, Message) are required.");
    }
    
    if (!isValidEmail(email)) {
      throw new Error("Invalid email address format.");
    }
    
    enforceRateLimit_(email);
    sheet.appendRow([name, phone, email, message]);

    // Send notification email
    sendNotificationEmail({ name: name, phone: phone, email: email, message: message });
    
    // Return HTML with embedded JSON that the frontend can parse
    var responseData = {
      status: "success",
      message: "Thank you! Your message has been received successfully."
    };
    
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><title>Form Submitted</title></head><body>' +
      '<script>window.parent.postMessage(' + JSON.stringify(responseData) + ', "*");</script>' +
      '<div style="display:none;" id="response-data">' + JSON.stringify(responseData) + '</div>' +
      '</body></html>'
    ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
  } catch (error) {
    Logger.log("Error in doPostHtml: " + error.toString());
    
    var errorData = {
      status: "error",
      message: error.toString() || "An error occurred while processing your request."
    };
    
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><title>Error</title></head><body>' +
      '<script>window.parent.postMessage(' + JSON.stringify(errorData) + ', "*");</script>' +
      '<div style="display:none;" id="response-data">' + JSON.stringify(errorData) + '</div>' +
      '</body></html>'
    ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

/**
 * Parse request data from different formats
 * Supports both JSON and form-urlencoded (URLSearchParams) formats
 * @param {Object} e - Event object containing request data
 * @returns {Object} - Parsed form data object
 */
function parseRequestData(e) {
  var data = {};
  
  try {
    // Check if request has postData (for Web Apps)
    if (e.postData && e.postData.contents) {
      var contentType = e.postData.type || "";
      var contents = e.postData.contents;
      
      // Handle JSON format
      if (contentType.indexOf("application/json") !== -1) {
        data = JSON.parse(contents);
      }
      // Handle form-urlencoded format
      else if (contentType.indexOf("application/x-www-form-urlencoded") !== -1 || 
               contentType.indexOf("application/x-www-form-urlencoded") === -1 && contents.indexOf("=") !== -1) {
        // Parse URL-encoded string
        var params = contents.split("&");
        for (var i = 0; i < params.length; i++) {
          var pair = params[i].split("=");
          if (pair.length === 2) {
            var key = decodeURIComponent(pair[0].replace(/\+/g, " "));
            var value = decodeURIComponent(pair[1].replace(/\+/g, " "));
            data[key] = value;
          }
        }
      }
    }
    // Handle direct parameter access (alternative method)
    else if (e.parameter) {
      data = e.parameter;
    }
  } catch (parseError) {
    Logger.log("Error parsing request data: " + parseError.toString());
    throw new Error("Invalid request data format.");
  }
  
  return data;
}

/**
 * Sanitize input to prevent XSS and injection attacks
 * @param {string} input - Raw input string
 * @returns {string} - Sanitized string
 */
function sanitizeInput(input) {
  if (!input || typeof input !== "string") {
    return "";
  }
  
  // Remove potentially dangerous characters and trim whitespace
  var sanitized = input.trim();
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, "");
  
  // Limit length to prevent DoS
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 2000);
  }
  
  return sanitized;
}

/**
 * Validate email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") {
    return false;
  }
  
  // Basic email validation regex
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email.trim());
}

/**
 * Create standardized response with CORS headers
 * @param {Object|string} data - Response data (object will be JSON stringified)
 * @param {number} statusCode - HTTP status code (for reference, not directly used)
 * @returns {ContentService.TextOutput} - Formatted response with CORS headers
 */
function createResponse(data, statusCode) {
  var responseText;
  
  // Convert object to JSON string if needed
  if (typeof data === "object") {
    responseText = JSON.stringify(data);
  } else {
    responseText = data || "";
  }
  
  // Create response with proper MIME type
  var mimeType = typeof data === "object" ? 
    ContentService.MimeType.JSON : 
    ContentService.MimeType.TEXT;
  
  // Build response with CORS headers
  // Note: Google Apps Script Web Apps have limitations with CORS headers.
  // We use multiple response methods for maximum compatibility:
  // 1. Standard JSON/TEXT with explicit CORS headers (for modern browsers)
  // 2. HTML wrapper method (fallback for CORS-restricted environments)
  var output = ContentService
    .createTextOutput(responseText)
    .setMimeType(mimeType);
  
  // Set CORS headers - these may not always work due to Google Apps Script limitations
  try {
    output.setHeader("Access-Control-Allow-Origin", "*");
    output.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    output.setHeader("Access-Control-Allow-Headers", "Content-Type");
    output.setHeader("Access-Control-Max-Age", "3600");
  } catch (e) {
    // If header setting fails, continue without headers
    Logger.log("Could not set CORS headers: " + e.toString());
  }
  
  return output;
}

/**
 * Enforce simple per-identity rate limit using CacheService
 * Limits one submission per 60 seconds per email hash
 * @param {string} email
 */
function enforceRateLimit_(email) {
  var key = 'rate:' + hashEmail_(email);
  var cache = CacheService.getScriptCache();
  var existing = cache.get(key);
  if (existing) {
    throw new Error('Too many submissions. Please wait a minute and try again.');
  }
  // Set lock for 60 seconds
  cache.put(key, '1', 60);
}

/**
 * Create a short hash of email to use as cache key
 * @param {string} email
 * @returns {string}
 */
function hashEmail_(email) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(email).toLowerCase().trim());
  var hex = bytes.map(function(b){
    var s = (b & 0xFF).toString(16);
    return ('0' + s).slice(-2);
  }).join('');
  // shorten to 16 chars
  return hex.substring(0, 16);
}

/**
 * Send notification email with submission details
 * @param {{name:string, phone:string, email:string, message:string}} payload
 */
function sendNotificationEmail(payload) {
  try {
    var recipients = 'eslamosamawork143@gmail.com, eo54872@gmail.com';
    var subject = 'New Contact Form Submission — ' + (payload.name || 'Unknown Name');

    var timezone = Session.getScriptTimeZone() || 'UTC';
    var submittedAt = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd HH:mm:ss z');

    // Inline styled HTML email (designer-friendly, readable)
    var primary = '#056608';
    var text = '#333333';
    var bg = '#f7fbff';
    var rowBg = '#ffffff';
    var border = '#e2e8f0';

    var html = '' +
      '<!doctype html>' +
      '<html><head><meta charset="UTF-8"></head>' +
      '<body style="margin:0;padding:0;background:' + bg + ';font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:' + text + ';">' +
      '  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:640px;margin:0 auto;padding:24px;">' +
      '    <tr>' +
      '      <td style="padding:0 0 16px 0;">' +
      '        <h2 style="margin:0;font-size:20px;line-height:1.4;color:' + primary + ';">New Contact Form Submission</h2>' +
      '        <p style="margin:6px 0 0 0;font-size:13px;color:#5e6a75;">Submitted at ' + submittedAt + '</p>' +
      '      </td>' +
      '    </tr>' +
      '    <tr>' +
      '      <td style="background:' + rowBg + ';border:1px solid ' + border + ';border-radius:10px;overflow:hidden;">' +
      '        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">' +
      emailRow('Name', safe(payload.name)) +
      emailRow('Phone', safe(payload.phone)) +
      emailRow('Email', safe(payload.email)) +
      emailRow('Message', safe(payload.message), true) +
      '        </table>' +
      '      </td>' +
      '    </tr>' +
      '    <tr><td style="padding-top:14px;font-size:12px;color:#8a95a3;">Reply to this email to contact the sender directly.</td></tr>' +
      '  </table>' +
      '</body></html>';

    // Send
    MailApp.sendEmail({
      to: recipients,
      subject: subject,
      htmlBody: html,
      replyTo: payload.email || ''
    });
  } catch (err) {
    // Avoid breaking main flow if email fails
    Logger.log('sendNotificationEmail error: ' + err);
  }
}

/**
 * Build one row for the email table
 * @param {string} label
 * @param {string} value
 * @param {boolean=} isMultiline
 */
function emailRow(label, value, isMultiline) {
  var border = '#e2e8f0';
  var labelStyle = 'padding:12px 14px;border-bottom:1px solid ' + border + ';font-weight:600;width:160px;vertical-align:top;background:#f9fafb;';
  var valueStyle = 'padding:12px 14px;border-bottom:1px solid ' + border + ';';
  var v = value || '';
  if (isMultiline) {
    v = '<div style="white-space:pre-wrap;line-height:1.6;">' + v + '</div>';
  }
  return '<tr>' +
         '  <td style="' + labelStyle + '">' + escapeHtml(label) + '</td>' +
         '  <td style="' + valueStyle + '">' + v + '</td>' +
         '</tr>';
}

/** Sanitize printable values for HTML body */
function safe(s) {
  if (!s) return '';
  return escapeHtml(String(s));
}

/** Minimal HTML escape */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
