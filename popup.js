const startButton = document.querySelector("#start");
const statusText = document.querySelector("#status");
const delaySelect = document.querySelector("#delayMs");
const formatInputs = [...document.querySelectorAll('input[type="checkbox"]')];

async function loadSettings() {
  const result = await chrome.storage.sync.get("canvaMultiDownloadSettings");
  const settings = result.canvaMultiDownloadSettings;
  if (!settings) return;

  for (const input of formatInputs) {
    input.checked = settings.formats?.includes(input.value) ?? input.checked;
  }

  if (settings.delayMs) {
    delaySelect.value = String(settings.delayMs);
  }
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({ canvaMultiDownloadSettings: settings });
}

function selectedFormats() {
  return formatInputs.filter((input) => input.checked).map((input) => input.value);
}

startButton.addEventListener("click", async () => {
  const formats = selectedFormats();
  const delayMs = Number(delaySelect.value);

  if (!formats.length) {
    statusText.textContent = "Pilih minimal satu format.";
    return;
  }

  startButton.disabled = true;
  statusText.textContent = "Menjalankan di tab Canva...";

  const settings = { formats, delayMs, keepPanelOpen: true };
  await saveSettings(settings);

  chrome.runtime.sendMessage(
    { type: "CANVA_MULTI_DOWNLOAD", settings },
    (response) => {
      startButton.disabled = false;

      if (chrome.runtime.lastError) {
        statusText.textContent = chrome.runtime.lastError.message;
        return;
      }

      statusText.textContent = response?.ok
        ? "Urutan download dimulai."
        : response?.error || "Gagal menjalankan download.";
    }
  );
});

loadSettings();
