# FRC4419 CAM Studioinator (extension v0.3.24)

The Chrome side panel works with the team's Google Apps Script backend to create a controlled Aluminum or Polycarbonate CAM Studio in the active Onshape document and read its settings report.

The side panel displays the installed extension package version and the Apps Script CAM report version separately.

## Use

1. Open an Onshape document workspace.
2. Open the extension side panel.
3. Connect your Onshape account if needed. The extension requests read access for reports and write access to copy a CAM template into the document.
4. Choose **Create Aluminum CAM** or **Create Polycarb CAM** to copy the team's template. If Onshape returns the copied element ID, the new CAM Studio opens in a tab.
5. Use **Run** to read the active CAM Studio report. The report shows units in Inch (MM) and Inch/min (MM/min).

## Load unpacked

Keep all files in this directory together. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this folder.

This package uses the existing Apps Script web app URL configured in `background.js`. The manifest grants access to the Onshape domain and Apps Script endpoints only. Do not add Onshape client credentials, tokens, or private document content to extension files.

The Chrome Web Store package and this development source may be on different versions until the updated extension is submitted.


After copying a template, the extension opens the new CAM Studio in the current Onshape browser tab. It reuses that tab to avoid opening another concurrent Onshape session for every copy.
