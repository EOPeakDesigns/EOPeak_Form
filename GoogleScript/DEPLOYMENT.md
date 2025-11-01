# Google Apps Script Deployment Instructions

## Deployment Steps

1. **Open the Google Apps Script Editor**
   - Go to [script.google.com](https://script.google.com)
   - Open your project with the `Code.gs` file

2. **Configure the Script**
   - Ensure the spreadsheet ID in `Code.gs` matches your Google Sheet
   - Verify the sheet has columns: A (Name), B (Email), C (Message)

3. **Deploy as Web App**
   - Click "Deploy" → "New deployment"
   - Click the gear icon ⚙️ next to "Select type"
   - Choose "Web app"
   
4. **Deployment Settings**
   - **Description**: "Contact Form Handler"
   - **Execute as**: "Me" (your account)
   - **Who has access**: "Anyone" (required for public forms)
   - Click "Deploy"

5. **Get the Web App URL**
   - Copy the Web App URL provided
   - It should look like: `https://script.google.com/macros/s/.../exec`
   - Update this URL in `scripts/config.js` as `apiEndpoint`

6. **Important Notes**
   - The Web App must be deployed as "Anyone" can access for CORS to work
   - If you make changes to the script, you need to create a new version and redeploy
   - The URL changes only if you delete and recreate the deployment

## Testing

After deployment, test the form submission to ensure:
- Data is saved to the correct columns (A=Name, B=Email, C=Message)
- Success/error messages are displayed correctly
- No CORS errors in the browser console

## Troubleshooting CORS Issues

**Important Note:** Google Apps Script Web Apps have known CORS limitations. The form has been designed with a fallback mechanism that handles this automatically:

1. **First Attempt**: Tries to read the response with CORS mode
2. **Fallback**: If CORS fails, uses no-cors mode (request still succeeds, but response can't be read)

**The form will work even if you see CORS errors in the console** - this is expected behavior. The request succeeds (200 OK), but the browser blocks reading the response.

### If you still see CORS errors:

1. **This is Normal**: CORS errors from Google Apps Script Web Apps are common and expected
2. **The Form Still Works**: Data is being saved to your spreadsheet even with CORS errors
3. **Verify Deployment**
   - Ensure "Who has access" is set to "Anyone"
   - Check that you're using the `/exec` endpoint (not `/dev`)

4. **Verify Data is Saved**
   - Check your Google Sheet - data should appear in Columns A (Name), B (Email), C (Message)
   - If data appears, the form is working correctly despite CORS errors

5. **Clear Browser Cache**
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

6. **Check Script Permissions**
   - Ensure the script has permission to access the spreadsheet
   - Review execution logs in Google Apps Script editor (View → Execution transcript)

7. **Verify Spreadsheet Access**
   - The spreadsheet must be accessible
   - Check that the spreadsheet ID in `Code.gs` matches your sheet

