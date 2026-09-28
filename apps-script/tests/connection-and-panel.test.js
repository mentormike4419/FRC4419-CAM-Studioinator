const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");

function backend() {
  const props = new Map([["ONSHAPE_CLIENT_ID", "test"], ["ONSHAPE_CLIENT_SECRET", "test"]]);
  const cache = new Map();
  let sequence = 0;
  let locked = false;
  let onFetch = () => {};
  const context = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props.get(key) || null,
      setProperty: (key, value) => props.set(key, value),
      deleteProperty: key => props.delete(key)
    }) },
    CacheService: { getScriptCache: () => ({
      get: key => cache.get(key) || null,
      put: (key, value) => cache.set(key, value),
      remove: key => cache.delete(key)
    }) },
    LockService: { getScriptLock: () => ({
      waitLock() { assert.equal(locked, false); locked = true; },
      releaseLock() { assert.equal(locked, true); locked = false; }
    }) },
    Utilities: { getUuid: () => "state-" + ++sequence, DigestAlgorithm: { SHA_256: "sha" },
      computeDigest: () => [1], base64Encode: () => "test" },
    ScriptApp: { getService: () => ({ getUrl: () => "https://example.test/exec" }) },
    ContentService: { MimeType: { JSON: "json" },
      createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    UrlFetchApp: { fetch: url => {
      assert.equal(locked, false, "network requests must not hold the shared lock");
      onFetch(url);
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(
        url.includes("/oauth/token") ? { access_token: "new-token", refresh_token: "refresh" } : { id: "user" }
      ) };
    } }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "Code.gs"), "utf8"), context);
  context.callbackPage_ = (title, action, detail) => ({ title, detail });
  const post = action => JSON.parse(context.doPost({ postData: {
    contents: JSON.stringify({ action, connectionKey: "a".repeat(64) })
  } }).text);
  const begin = () => new URL(post("begin").authorizationUrl).searchParams.get("state");
  const finish = state => context.doGet({ parameter: { code: "code", state } });
  return { context, props, cache, post, begin, finish, setFetch: fn => { onFetch = fn; } };
}

test("OAuth succeeds once and rejects replay", () => {
  const b = backend(); const state = b.begin();
  assert.equal(b.finish(state).title, "Connection successful");
  assert.equal(b.post("status").connected, true);
  assert.equal(b.finish(state).title, "Connection failed");
});
test("Disconnect invalidates pending authorization; a new Connect still works", () => {
  const b = backend(); const state = b.begin(); b.post("disconnect");
  assert.equal(b.finish(state).title, "Connection failed");
  assert.equal(b.post("status").connected, false);
  assert.equal(b.finish(b.begin()).title, "Connection successful");
});
test("a second Connect supersedes the first authorization", () => {
  const b = backend(); const old = b.begin(); const latest = b.begin();
  assert.equal(b.finish(old).title, "Connection failed");
  assert.equal(b.finish(latest).title, "Connection successful");
});
test("Disconnect during token exchange prevents saving the grant", () => {
  const b = backend(); const state = b.begin();
  b.setFetch(() => b.post("disconnect"));
  assert.equal(b.finish(state).title, "Connection failed");
  assert.equal(b.post("status").connected, false);
});
test("Disconnect during token refresh cannot restore the grant", () => {
  const b = backend();
  const grant = { accessToken: "old", refreshToken: "refresh", expiresAt: 0 };
  b.props.set("grant:01", JSON.stringify(grant));
  b.setFetch(() => b.post("disconnect"));
  assert.throws(() => b.context.refresh_(grant, "grant:01"), /Connection changed/);
  assert.equal(b.post("status").connected, false);
});
test("normal token refresh persists the new token", () => {
  const b = backend();
  const grant = { accessToken: "old", refreshToken: "refresh", expiresAt: 0 };
  b.props.set("grant:01", JSON.stringify(grant));
  b.context.refresh_(grant, "grant:01");
  assert.equal(JSON.parse(b.props.get("grant:01")).accessToken, "new-token");
});

function panel() {
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, { textContent: "", disabled: false });
    return elements.get(id);
  };
  const requests = [];
  const events = {};
  const tab = { id: 1, active: true, url: "https://cad.onshape.com/documents/" + "a".repeat(24) +
    "/w/" + "b".repeat(24) + "/e/" + "c".repeat(24) };
  const context = { document: { getElementById: el }, chrome: {
    runtime: { getManifest: () => ({ version: "test" }), sendMessage: (msg, cb) => {
      if (msg.action === "status") cb({ connected: true });
      else requests.push({ msg, cb });
    } },
    tabs: { query: async () => [{ ...tab }], update: async (id, change) => { tab.url = change.url; },
      onActivated: { addListener: fn => { events.activated = fn; } },
      onUpdated: { addListener: fn => { events.updated = fn; } } }
  } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "extension-integrated/popup.js"), "utf8"), context);
  return { context, el, tab, events, requests };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test("both material copies clear report and version and reuse the current tab", async () => {
  for (const material of ["aluminum", "polycarbonate"]) {
    const p = panel(); await tick();
    p.el("report").textContent = "OLD"; p.el("reportVersion").textContent = "OLD";
    const done = p.context.createCamTemplate(material); await tick();
    assert.equal(p.el("report").textContent, "");
    assert.equal(p.el("reportVersion").textContent, "CAM report v—");
    assert.equal(p.el("reportButton").disabled, true);
    p.requests[0].cb({ created: true, elementId: "d".repeat(24) }); await done;
    assert.ok(p.tab.url.endsWith("d".repeat(24)));
    assert.equal(p.el("reportButton").disabled, false);
  }
});
test("late report cannot repopulate the panel after Disconnect", async () => {
  const p = panel(); const done = p.context.showCamSettings(); await tick();
  const disconnected = p.el("disconnect").onclick();
  p.requests.find(r => r.msg.action === "disconnect").cb({ connected: false }); await disconnected;
  p.requests.find(r => r.msg.action === "report").cb({ reportText: "OLD", reportVersion: "1" }); await done;
  assert.equal(p.el("report").textContent, "");
  assert.match(p.el("status").textContent, /Connection removed/);
});
test("tab navigation clears rendered reports and invalidates pending reports", async () => {
  const p = panel(); const done = p.context.showCamSettings(); await tick();
  p.el("report").textContent = "OLD";
  p.events.updated(1, { url: "new" }, p.tab);
  p.requests[0].cb({ reportText: "LATE", reportVersion: "1" }); await done;
  assert.equal(p.el("report").textContent, "");
  p.el("report").textContent = "OLD"; p.events.activated({ tabId: 2 });
  assert.equal(p.el("report").textContent, "");
});
test("unchanged active CAM receives a report", async () => {
  const p = panel(); const done = p.context.showCamSettings(); await tick();
  p.requests[0].cb({ reportText: "CURRENT", reportVersion: "1" }); await done;
  assert.equal(p.el("report").textContent, "CURRENT");
});
