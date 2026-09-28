const statusElement = document.getElementById("status");
const reportElement = document.getElementById("report");
const extensionVersionElement = document.getElementById("extensionVersion");
const reportVersionElement = document.getElementById("reportVersion");
const createButtons = [
  document.getElementById("createAluminum"),
  document.getElementById("createPolycarb")
];

function setStatus(message) { statusElement.textContent = message; }
extensionVersionElement.textContent = "Extension v" + chrome.runtime.getManifest().version;
function call(action, extra = {}) {
  return new Promise(resolve => chrome.runtime.sendMessage({ action, ...extra }, data => {
    resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : data);
  }));
}
async function activeCamIds() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const match = (tab?.url || "").match(/\/documents\/([0-9a-f]{24})\/w\/([0-9a-f]{24})\/e\/([0-9a-f]{24})/i);
  if (!match) throw new Error("🟡 Open an Onshape CAM Studio tab first.");
  return { tabId: tab.id, documentId: match[1], workspaceId: match[2], elementId: match[3] };
}
async function showCamSettings() {
  reportElement.textContent = "";
  reportVersionElement.textContent = "CAM report v—";
  setStatus("Reading the active CAM Studio tab...");
  try {
    const data = await call("report", await activeCamIds());
    if (!data || data.error) throw new Error(data?.error || "No response from Apps Script.");
    if (typeof data.reportText !== "string") throw new Error("Apps Script did not return a CAM report. Deploy the latest Code.gs and CamReport.gs.");
    reportVersionElement.textContent = "CAM report v" + data.reportVersion;
    reportElement.textContent = data.reportText;
    setStatus("🟢 CAM report ready.");
  } catch (error) { setStatus(error.message); }
}
async function createCamTemplate(material) {
  const label = material === "aluminum" ? "Aluminum" : "Polycarb";
  createButtons.forEach(button => { button.disabled = true; });
  setStatus("Creating " + label + " CAM Studio...");
  try {
    const ids = await activeCamIds();
    const data = await call("copyTemplate", { ...ids, material });
    if (!data || data.error) throw new Error(data?.error || "No response from Apps Script.");
    if (!data.created) throw new Error("Apps Script did not confirm the template copy.");
    if (typeof data.elementId === "string" && /^[0-9a-f]{24}$/i.test(data.elementId)) {
      const url = "https://cad.onshape.com/documents/" + ids.documentId +
        "/w/" + ids.workspaceId + "/e/" + data.elementId;
      await chrome.tabs.update(ids.tabId, { url });
      setStatus("🟢 " + label + " CAM Studio created and opened.");
    } else {
      setStatus("🟢 " + label + " CAM Studio copied into this document.");
    }
  } catch (error) {
    setStatus(error.message);
  } finally {
    createButtons.forEach(button => { button.disabled = false; });
  }
}
document.getElementById("connect").onclick = async () => {
  setStatus("Starting Onshape authorization...");
  const data = await call("begin");
  if (data?.authorizationUrl) {
    chrome.tabs.create({ url: data.authorizationUrl });
    setStatus("Authorize in the new tab, then return and click Status.");
  } else setStatus(data?.error || "Could not start authorization.");
};
async function updateConnectionStatus(promptRun = false) {
  const data = await call("status");
  if (data?.error) setStatus(data.error);
  else if (data?.connected) {
    setStatus(promptRun ? "🟢 Press Run to read CAM settings." : "Connected to Onshape.");
  } else setStatus("Not connected.");
}
document.getElementById("statusButton").onclick = () => updateConnectionStatus(false);
document.getElementById("reportButton").onclick = showCamSettings;
document.getElementById("createAluminum").onclick = () => createCamTemplate("aluminum");
document.getElementById("createPolycarb").onclick = () => createCamTemplate("polycarbonate");
document.getElementById("disconnect").onclick = async () => {
  const data = await call("disconnect");
  reportElement.textContent = "";
  setStatus(data?.error || "Connection removed. Click Connect to connect again.");
};
updateConnectionStatus(true);
