# Privacy policy — FRC4419 CAM Studioinator

Effective September 27, 2026

FRC4419 CAM Studioinator is a Chrome extension and Google Apps Script service for creating controlled Onshape CAM Studio templates and displaying CAM settings reports.

## Data used

When you request a report or create a CAM Studio, the extension reads the active Onshape tab URL to obtain its document, workspace, and element identifiers. It sends those identifiers, the selected material when copying a template, and a browser-specific connection key to the project's Google Apps Script web app.

For reports, the web app uses your Onshape authorization to retrieve CAM Studio data and returns a formatted report to the extension. For template creation, the web app asks Onshape to copy the selected controlled Aluminum or Polycarbonate CAM Studio template into the active document. The service returns the new element identifier when Onshape provides it.

When you connect, the web app obtains and stores your Onshape account ID, email address, and OAuth access and refresh tokens in Google Apps Script properties associated with the connection key. The extension stores the connection key in Chrome local storage. The web app uses these values to perform the report or template-copy action you request.

## Use and sharing

This data is used to authorize your connection, retrieve CAM settings, and create a copy of the selected CAM Studio template. It is processed through Google Apps Script and Onshape for those purposes. We do not sell user data, use it for advertising, collect payment or health information, or use it to determine creditworthiness. The extension does not include analytics.

## Control and retention

Click **Disconnect** in the side panel to delete the associated Onshape grant stored by the Apps Script backend. You can reconnect later. The browser's local connection key may remain in Chrome storage; removing the extension deletes its local storage. You can separately revoke the app's Onshape authorization in your Onshape account. We do not intentionally retain CAM Studio report data after returning it to your browser.

## Contact

For questions about this policy, contact mentormike4419@gmail.com.

The use of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including its Limited Use requirements.
