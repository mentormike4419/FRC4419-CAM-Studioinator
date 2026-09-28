# FRC4419 CAM Studioinator

Production source for the FRC 4419 Onshape CAM Studio extension and its Google Apps Script backend.

The side panel can:

- Read the active CAM Studio and display a settings report.
- Copy the team's controlled Aluminum or Polycarbonate CAM Studio template into the active Onshape document.

The Apps Script backend is at version 1.62. The unpacked Chrome extension package is version 0.3.24. The extension side panel displays its package version separately from the Apps Script CAM report version. The Chrome Web Store listing may remain on an earlier release until the extension package is submitted separately.

## Source layout

- `.github/workflows/sync-apps-script.yml` syncs Apps Script code into the existing web app deployment.
- `apps-script/Code.gs`, `CamReport.gs`, and `CallbackIcon.gs` are the Apps Script source.
- `apps-script/extension-integrated/` is the unpacked Chrome extension. Keep `manifest.json` at this directory root when loading it in Chrome.
- `apps-script/tests/` contains report and template-copy tests.

## Apps Script deployment

The Apps Script project and web app URL remain the existing production ones. GitHub Actions requires the repository secrets `APPS_SCRIPT_ID` and `CLASPRC_JSON`; those secret values are intentionally not in this repository. The workflow is gated by the repository variable `APPS_SCRIPT_DEPLOY_ENABLED=true`, so the migration commit does not publish code by itself.

After adding the two secrets, set the variable when ready to make this repo the active deployment source. The workflow checks that the Apps Script report version matches the next deployment version before updating the existing web app deployment. See [the sync guide](apps-script/SYNCING.md).

Do not add OAuth credentials, tokens, `.clasprc.json`, or private Onshape data to the repository. The Onshape client ID and secret stay in Apps Script Script Properties.

## Extension setup

For local testing, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `apps-script/extension-integrated/`. The extension reuses the existing Apps Script backend and per-browser Onshape connection.

The extension requests access only to Onshape tabs and the Apps Script backend. It needs Onshape read and write access because the copy buttons create a CAM Studio in the active document. The user chooses which controlled template to copy.

## Local workstation tools and install log

This log covers the Windows workstation tools used for this project. Versions were not recorded in the setup screenshot.

| Date | Tool | Install record |
| --- | --- | --- |
| 2026-09-27 | Node.js and npm | Already present at `C:\Program Files\nodejs` when this setup was performed. |
| 2026-09-27 | Google Apps Script CLI (`@google/clasp`) | `npm.cmd install -g @google/clasp` completed; npm reported 295 packages changed. |

PowerShell blocked `npm.ps1` because script execution is disabled. The `.cmd` launcher worked, so use `npm.cmd` and `clasp.cmd` from PowerShell. There is no need to change the PowerShell execution policy or rerun the global clasp install when it is already installed.

Use `clasp.cmd login` only when a fresh or renewed clasp credential is needed. Store the resulting `.clasprc.json` contents as the GitHub Actions secret `CLASPRC_JSON`; never commit the credential file or paste its contents into chat.
