const startButton = document.querySelector("#start");
const pdfOnlyButton = document.querySelector("#pdfOnly");
const mp4OnlyButton = document.querySelector("#mp4Only");
const exportConfigButton = document.querySelector("#exportConfig");
const importConfigButton = document.querySelector("#importConfig");
const importFileInput = document.querySelector("#importFile");
const copyDebugButton = document.querySelector("#copyDebug");
const statusText = document.querySelector("#status");
const delaySelect = document.querySelector("#delayMs");
const saveConfigInput = document.querySelector("#saveConfig");
const formatInputs = [...document.querySelectorAll('.formats input[type="checkbox"]')];
const formatPageInputs = [...document.querySelectorAll("[data-format-pages]")];
let logLines = ["Siap."];

function setStatus(message) {
  logLines = [message];
  statusText.textContent = logLines.join("\n");
}

function appendLog(line) {
  logLines = [line, ...logLines.filter((item) => item !== "Siap.")].slice(0, 80);
  statusText.textContent = logLines.join("\n");
}

async function loadSettings() {
  const result = await chrome.storage.sync.get("canvaMultiDownloadSettings");
  const settings = result.canvaMultiDownloadSettings;
  if (!settings?.saveConfig) return;

  applySettingsToUi(settings);
}

function applySettingsToUi(settings) {
  for (const input of formatInputs) {
    input.checked = settings.formats?.includes(input.value) ?? input.checked;
  }

  if (settings.delayMs) delaySelect.value = String(settings.delayMs);
  for (const input of formatPageInputs) {
    input.value = settings.pageRanges?.[input.dataset.formatPages] || "";
  }
  saveConfigInput.checked = true;
}

async function saveSettings(settings) {
  if (settings.saveConfig) {
    await chrome.storage.sync.set({ canvaMultiDownloadSettings: settings });
  } else {
    await chrome.storage.sync.set({ canvaMultiDownloadSettings: { saveConfig: false } });
  }
}

function selectedFormats() {
  return formatInputs.filter((input) => input.checked).map((input) => input.value);
}

function selectedPageRanges() {
  return Object.fromEntries(
    formatPageInputs.map((input) => [input.dataset.formatPages, input.value.trim()])
  );
}

function currentSettings() {
  return {
    formats: selectedFormats(),
    delayMs: Number(delaySelect.value),
    pageRanges: selectedPageRanges(),
    saveConfig: saveConfigInput.checked,
    keepPanelOpen: true
  };
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportConfig() {
  const settings = currentSettings();
  await saveSettings({ ...settings, saveConfig: true });
  downloadTextFile(
    "canva-pemalas-adventure-config.json",
    JSON.stringify({ app: "Canva Pemalas Adventure", version: 1, settings }, null, 2)
  );
  appendLog(`[${new Date().toLocaleTimeString()}] Config diexport.`);
}

async function importConfigFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const settings = parsed.settings || parsed;
  settings.saveConfig = true;

  applySettingsToUi(settings);
  await saveSettings(settings);
  appendLog(`[${new Date().toLocaleTimeString()}] Config diload.`);
}

async function autosaveIfEnabled() {
  if (saveConfigInput.checked) {
    await saveSettings(currentSettings());
    appendLog(`[${new Date().toLocaleTimeString()}] Config disimpan.`);
  }
}

async function run(formats) {
  const settings = { ...currentSettings(), formats };

  if (!formats.length) {
    setStatus("Pilih minimal satu format.");
    return;
  }

  startButton.disabled = true;
  pdfOnlyButton.disabled = true;
  mp4OnlyButton.disabled = true;
  exportConfigButton.disabled = true;
  importConfigButton.disabled = true;
  copyDebugButton.disabled = true;
  setStatus("Menjalankan di tab Canva aktif...");

  await saveSettings(settings);

  chrome.runtime.sendMessage({ type: "CANVA_MULTI_DOWNLOAD", settings }, (response) => {
      startButton.disabled = false;
      pdfOnlyButton.disabled = false;
      mp4OnlyButton.disabled = false;
      exportConfigButton.disabled = false;
      importConfigButton.disabled = false;
      copyDebugButton.disabled = false;

    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message);
      return;
    }

    appendLog(response?.ok
      ? `[${new Date().toLocaleTimeString()}] 😡 done, mampus`
      : `[${new Date().toLocaleTimeString()}] ${response?.error || "Gagal menjalankan download."}`);
  });
}

startButton.addEventListener("click", () => run(selectedFormats()));
pdfOnlyButton.addEventListener("click", () => run(["PDF Standard"]));
mp4OnlyButton.addEventListener("click", () => run(["MP4 Video"]));
saveConfigInput.addEventListener("change", () => saveSettings(currentSettings()));
delaySelect.addEventListener("change", autosaveIfEnabled);
for (const input of [...formatInputs, ...formatPageInputs]) {
  input.addEventListener("change", autosaveIfEnabled);
  input.addEventListener("input", autosaveIfEnabled);
}
exportConfigButton.addEventListener("click", exportConfig);
importConfigButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files?.[0];
  if (!file) return;

  try {
    await importConfigFile(file);
  } catch (error) {
    setStatus(`Gagal load config: ${error.message}`);
  } finally {
    importFileInput.value = "";
  }
});
copyDebugButton.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CANVA_MULTI_DEBUG" }, async (response) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message);
      return;
    }

    const text = JSON.stringify(response?.debug || response, null, 2);
    await navigator.clipboard.writeText(text);
    setStatus(response?.ok
      ? "Debug disalin ke clipboard."
      : response?.error || "Gagal mengambil debug.");
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "CANVA_MULTI_LOG" && message.line) {
    appendLog(message.line);
  }
});

loadSettings();
