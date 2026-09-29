const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appScriptDir = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(appScriptDir, "Code.gs"), "utf8");
const report = fs.readFileSync(path.join(appScriptDir, "CamReport.gs"), "utf8");
const callbackIcon = fs.readFileSync(path.join(appScriptDir, "CallbackIcon.gs"), "utf8");

function makeContext(fetchAll) {
  const context = {
    UrlFetchApp: { fetchAll },
    HtmlService: {
      createHtmlOutput: html => ({ html, setTitle(title) { this.title = title; return this; } })
    }
  };
  vm.createContext(context);
  vm.runInContext(code + "\n" + report + "\n" + callbackIcon, context);
  return context;
}

function apiResponse(value) {
  return {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify(value)
  };
}

function makeCam() {
  const documentId = "d".repeat(24);
  const workspaceId = "c".repeat(24);
  const elementId = "e".repeat(24);
  const selections = [
    { componentId: "node-a", componentRef: "a".repeat(24), associativityIdBodyId: "part-a" },
    { componentId: "node-b", componentRef: "b".repeat(24), associativityIdBodyId: "part-b" }
  ];
  const tree = {
    components: [
      { _nodeId: "node-a", referenceId: selections[0].componentRef, name: "CAM Body A" },
      { _nodeId: "node-b", referenceId: selections[1].componentRef, name: "CAM Body B" }
    ],
    jobs: [{
      name: "Job",
      selectionParameters: { bodies: { associativeSelections: selections } },
      operations: [],
      stock: { directionType: "World" }
    }]
  };
  return { ids: { documentId, workspaceId, elementId }, tree, selections };
}

test("body-name resolution batches references and part lists", () => {
  const { ids, tree, selections } = makeCam();
  const fetchBatches = [];
  const context = makeContext(requests => {
    fetchBatches.push(requests);
    return requests.map(request => {
      if (request.url.includes("/references/")) {
        const isA = request.url.endsWith("a".repeat(24));
        return apiResponse({
          targetDocumentId: ids.documentId,
          targetElementId: isA ? "1".repeat(24) : "2".repeat(24),
          targetVersionId: isA ? "rev-a" : "rev-b",
          partIdentity: isA ? "part-a" : "part-b"
        });
      }
      return apiResponse([
        { partIdentity: "part-a", name: "Drive Side Plate" },
        { partIdentity: "part-b", name: "Support Bracket" }
      ]);
    });
  });

  const result = context.currentJobBodyNames_({ tree }, ids, "token", tree);
  assert.deepEqual(fetchBatches.map(batch => batch.length), [2, 2]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.namesByJob)), [["Drive Side Plate", "Support Bracket"]]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.resolvedByJob)), [[true, true]]);
  assert.equal(selections.length, 2);
});

test("failed lookups preserve component names and mark them in the report", () => {
  const { ids, tree } = makeCam();
  const context = makeContext(() => { throw new Error("Onshape lookup failed"); });
  const result = context.currentJobBodyNames_({ tree }, ids, "token", tree);
  const text = context.renderCamReport({ tree }, result.namesByJob, tree, result.resolvedByJob);

  assert.deepEqual(JSON.parse(JSON.stringify(result.namesByJob)), [["CAM Body A", "CAM Body B"]]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.resolvedByJob)), [[false, false]]);
  assert.match(text, /Bodies: CAM Body A \(CAM fallback\), CAM Body B \(CAM fallback\)/);
});

test("resolved current body names appear without fallback labels", () => {
  const { ids, tree } = makeCam();
  const context = makeContext(requests => requests.map(request => {
    if (request.url.includes("/references/")) {
      const isA = request.url.endsWith("a".repeat(24));
      return apiResponse({
        targetDocumentId: ids.documentId,
        targetElementId: isA ? "1".repeat(24) : "2".repeat(24),
        partIdentity: isA ? "part-a" : "part-b"
      });
    }
    const isA = request.url.endsWith("1".repeat(24));
    return apiResponse([{ partIdentity: isA ? "part-a" : "part-b", name: isA ? "Panel" : "Block" }]);
  }));
  const result = context.currentJobBodyNames_({ tree }, ids, "token", tree);
  const text = context.renderCamReport({ tree }, result.namesByJob, tree, result.resolvedByJob);

  assert.match(text, /Bodies: Panel, Block/);
  assert.doesNotMatch(text, /CAM fallback/);
});

test("legacy read action is rejected without making an Onshape request", () => {
  let onshapeRequests = 0;
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => null })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "SHA_256" },
      computeDigest: () => [0]
    },
    UrlFetchApp: {
      fetch: () => { onshapeRequests += 1; throw new Error("Unexpected Onshape request"); }
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: text => ({ text, setMimeType() { return this; } })
    }
  };
  vm.createContext(context);
  vm.runInContext(code + "\n" + report + "\n" + callbackIcon, context);

  const result = context.doPost({
    postData: { contents: JSON.stringify({ action: "read", connectionKey: "a".repeat(64) }) }
  });

  assert.deepEqual(JSON.parse(result.text), { error: "Unknown action." });
  assert.equal(onshapeRequests, 0);
});

test("extension background no longer forwards the removed check action", () => {
  const background = fs.readFileSync(path.join(appScriptDir, "extension-integrated", "background.js"), "utf8");
  assert.match(background, /"copyTemplate"/);
  assert.doesNotMatch(background, /"check"/);
});

test("OAuth connection page uses Studioinator branding and tells the user to click Run Checker", () => {
  const context = makeContext(() => []);
  const page = context.callbackPage_(
    "Connection successful",
    "CLOSE THIS TAB",
    "Return to CAM Studioinator. In the side panel, click Run Checker to read CAM settings.",
    { account: "member@example.com", clientId: "test-client" }
  );

  assert.equal(page.title, "FRC4419 CAM Studioinator");
  assert.match(page.html, /<title>FRC4419 CAM Studioinator — Connection successful<\/title>/);
  assert.match(page.html, /<strong>FRC4419 CAM Studioinator<\/strong>/);
  assert.match(page.html, /click Run Checker to read CAM settings/);
  assert.doesNotMatch(page.html, /CAM Studio Checker|checker side panel|Show CAM settings/);
});


function makeCopyContext(fetch) {
  const context = {
    UrlFetchApp: { fetch, fetchAll: () => [] },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: text => ({ text, setMimeType() { return this; } })
    }
  };
  vm.createContext(context);
  vm.runInContext(code + "\n" + report + "\n" + callbackIcon, context);
  return context;
}

test("Aluminum template copy targets the active document", () => {
  let request;
  const context = makeCopyContext((url, options) => {
    request = { url, options };
    return {
      getResponseCode: () => 201,
      getContentText: () => JSON.stringify({ elementId: "n".repeat(24) })
    };
  });

  const targetDocumentId = "d".repeat(24);
  const targetWorkspaceId = "c".repeat(24);
  const result = context.copyCamTemplate_({
    documentId: targetDocumentId,
    workspaceId: targetWorkspaceId,
    elementId: "e".repeat(24),
    material: "aluminum"
  }, { accessToken: "test-token" });

  assert.equal(request.url, "https://cad.onshape.com/api/elements/copyelement/" +
    targetDocumentId + "/workspace/" + targetWorkspaceId);
  assert.equal(request.options.method, "post");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(request.options.payload), {
    documentIdSource: "26b1c442bed276480352793e",
    workspaceIdSource: "1a221c432d5320b4f0514b98",
    elementIdSource: "29d7fabeae4a87d8166e9217",
    isGroupAnchor: false
  });
  assert.deepEqual(JSON.parse(result.text), {
    created: true,
    material: "aluminum",
    elementId: "n".repeat(24)
  });
});

test("template copy rejects an unknown material before calling Onshape", () => {
  let called = false;
  const context = makeCopyContext(() => { called = true; });

  assert.throws(() => context.copyCamTemplate_({
    documentId: "d".repeat(24),
    workspaceId: "c".repeat(24),
    elementId: "e".repeat(24),
    material: "titanium"
  }, { accessToken: "test-token" }), /Choose Aluminum or Polycarbonate\./);
  assert.equal(called, false);
});

test("popup exposes template actions and sends copyTemplate to the background", () => {
  const background = fs.readFileSync(path.join(appScriptDir, "extension-integrated", "background.js"), "utf8");
  const popup = fs.readFileSync(path.join(appScriptDir, "extension-integrated", "popup.js"), "utf8");
  const html = fs.readFileSync(path.join(appScriptDir, "extension-integrated", "popup.html"), "utf8");

  assert.match(background, /"copyTemplate"/);
  assert.match(html, /id="createAluminum"/);
  assert.match(html, /id="createPolycarb"/);
  assert.ok(html.indexOf('class="create-controls"') < html.indexOf('class="controls"'));
  assert.match(html, /<button id="reportButton">Run Checker<\/button>/);
  assert.ok(popup.includes('call("copyTemplate"'));
  assert.ok(popup.includes('chrome.tabs.update(ids.tabId, { url })'));
  assert.doesNotMatch(popup, /chrome\.tabs\.create\(\{ url \}\)/);
  assert.match(html, /id="extensionVersion"/);
  assert.match(html, /id="reportVersion"/);
  assert.ok(popup.includes('chrome.runtime.getManifest().version'));
});

test("extension keeps tab access limited to Onshape and versions in sync", () => {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(appScriptDir, "extension-integrated", "manifest.json"), "utf8"
  ));
  const rootReadme = fs.readFileSync(path.resolve(appScriptDir, "..", "README.md"), "utf8");
  const extensionReadme = fs.readFileSync(
    path.join(appScriptDir, "extension-integrated", "README.md"), "utf8"
  );

  assert.ok(!manifest.permissions.includes("tabs"));
  assert.ok(manifest.host_permissions.includes("https://cad.onshape.com/*"));
  assert.match(rootReadme, new RegExp("package is version " + manifest.version.replaceAll(".", "\\.") + "\\."));
  assert.match(extensionReadme, new RegExp("extension v" + manifest.version.replaceAll(".", "\\.") + "\\)"));
});

test("Apps Script deployment version is validated before source is pushed", () => {
  const workflow = fs.readFileSync(
    path.resolve(appScriptDir, "..", ".github", "workflows", "sync-apps-script.yml"), "utf8"
  );
  const validation = workflow.indexOf('if [[ "$REPORT_VERSION" != "1.$EXPECTED_VERSION" ]]');
  const push = workflow.indexOf("clasp push --force");

  assert.ok(validation >= 0, "deployment version validation must be present");
  assert.ok(push > validation, "source push must follow deployment version validation");
});

