# Sync GitHub source into the existing Apps Script project

The production workflow in `FRC4419-CAM-Studioinator` copies `apps-script/Code.gs`, `CamReport.gs`, and `CallbackIcon.gs` into the existing Google Apps Script project. It first pulls that project's current files so other files and `appsscript.json` stay in place. It checks the report version before updating the existing web app deployment, which keeps the current `/exec` URL.

## One-time setup

Use the Google account that owns or can edit the existing Apps Script project.

1. In the Apps Script editor, open **Project Settings**, copy **Script ID** under **IDs**, and save it in the new repo's Actions secret `APPS_SCRIPT_ID`. This is not the web app `/exec` URL.
2. Turn on the **Apps Script API** at <https://script.google.com/home/usersettings>.
3. On your own computer, install Node.js and run `npm install -g @google/clasp`, then `clasp login` with the same Google account. This creates `~/.clasprc.json` (on Windows, your home directory's `.clasprc.json`).
4. Add the complete contents of that file as the new repo's Actions secret `CLASPRC_JSON`. Never put this file or its contents in a commit or chat.
5. In **Settings → Secrets and variables → Actions**, set repository variable `APPS_SCRIPT_DEPLOY_ENABLED` to `true` when this repo should control deployment.

The workflow is gated by that variable. Check the existing deployment's version before merging backend changes; `CAM_REPORT_VERSION` must equal `1.` followed by the next deployment version. Source version numbers alone do not confirm what is deployed.

## Each update

Changes to `apps-script/Code.gs`, `CamReport.gs`, or `CallbackIcon.gs` on production `main` start **Sync Apps Script**. When deployment is enabled, the workflow confirms the report version equals the next Apps Script deployment version before it updates the existing web app. A green run can also mean deployment was gated off; inspect the sync step to confirm whether a version was published to the existing `/exec` URL.

Keep the previous repository's deployment workflow active until the new repo has completed its first successful deployment. Then disable the old repo's push-triggered workflow to prevent two repositories from deploying to the same Apps Script project.

Never put OAuth secrets, tokens, or `.clasprc.json` in source files or documentation. Onshape client ID and secret stay in Apps Script Script Properties.
