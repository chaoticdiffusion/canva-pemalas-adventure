(() => {
  const PANEL_ID = "codex-canva-download-panel";
  const CLICKABLE_SELECTOR = [
    "button",
    "[role='button']",
    "[role='menuitem']",
    "[role='option']",
    "a",
    "input",
    "select"
  ].join(",");

  let isRunning = false;
  let logNode;
  let resizeListenerAttached = false;

  const dictionary = {
    share: ["Share", "Bagikan"],
    publishOptions: ["All Publish Options", "Semua opsi publikasi"],
    shareDesign: ["Share design", "Bagikan desain"],
    download: ["Download", "Unduh", "Unduh sekarang"],
    downloadSettings: ["File type", "Select pages", "Preferences"],
    fileType: ["File type", "Jenis file", "Tipe file", "Format file"],
    png: ["PNG"],
    pdfStandard: ["PDF Standard", "PDF standar", "PDF"],
    pdfPrint: ["PDF Print", "PDF Cetak"],
    mp4Video: ["MP4 Video", "MP4"],
    done: ["Done", "Selesai"],
    continue: ["Continue", "Lanjutkan"]
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function log(message) {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    if (logNode) {
      logNode.textContent = `${line}\n${logNode.textContent}`.trim();
    }
    chrome.runtime?.sendMessage?.({ type: "CANVA_MULTI_LOG", line }).catch?.(() => {});
    console.info("[Canva Multi Download]", message);
  }

  function visibleClickableSummary(limit = 80) {
    return clickableElements().slice(0, limit).map((element, index) => ({
      index,
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role") || "",
      aria: element.getAttribute("aria-label") || "",
      title: element.getAttribute("title") || "",
      text: textOf(element).slice(0, 160)
    })).filter((item) => item.text || item.aria || item.title);
  }

  function debugSnapshot() {
    const overlays = activeOverlays().map((overlay, index) => ({
      index,
      role: overlay.getAttribute("role") || "",
      aria: overlay.getAttribute("aria-label") || "",
      text: normalize(overlay.innerText || overlay.textContent).slice(0, 1200),
      buttons: [...overlay.querySelectorAll(CLICKABLE_SELECTOR)]
        .filter(isVisible)
        .slice(0, 40)
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role") || "",
          aria: element.getAttribute("aria-label") || "",
          title: element.getAttribute("title") || "",
          text: textOf(element).slice(0, 160)
        }))
    }));

    return {
      url: location.href,
      title: document.title,
      time: new Date().toISOString(),
      running: isRunning,
      panelLog: logNode?.textContent || "",
      overlays,
      clickables: visibleClickableSummary()
    };
  }

  async function copyDebugSnapshot() {
    const text = JSON.stringify(debugSnapshot(), null, 2);
    await navigator.clipboard.writeText(text);
    log("Debug info disalin ke clipboard.");
  }

  function removeLegacyPagePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
    releasePanelLayout();
    logNode = null;
  }

  function isVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      style.opacity !== "0"
    );
  }

  function isInsideExtensionPanel(element) {
    return Boolean(element?.closest?.(`#${PANEL_ID}`));
  }

  function normalize(text) {
    return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function textOf(element) {
    return normalize([
      element.innerText,
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid")
    ].filter(Boolean).join(" "));
  }

  function clickableElements() {
    return [...document.querySelectorAll(CLICKABLE_SELECTOR)]
      .filter((element) => isVisible(element) && !isInsideExtensionPanel(element));
  }

  function activeOverlays() {
    return [
      ...document.querySelectorAll("[role='dialog'], [role='menu'], [aria-modal='true']")
    ].filter((element) => isVisible(element) && !isInsideExtensionPanel(element));
  }

  function findClickableIn(root, labels, exact = false) {
    const wanted = labels.map(normalize);
    const candidates = [...root.querySelectorAll(CLICKABLE_SELECTOR)]
      .filter((element) => isVisible(element) && !isInsideExtensionPanel(element));

    return candidates.find((element) => {
      const haystack = textOf(element);
      return wanted.some((label) => exact ? haystack === label : haystack.includes(label));
    });
  }

  function findClickableInActiveOverlay(labels, exact = false) {
    for (const overlay of activeOverlays()) {
      const match = findClickableIn(overlay, labels, exact);
      if (match) return match;
    }

    return null;
  }

  function findClickableByText(labels, exact = false) {
    const wanted = labels.map(normalize);
    const candidates = clickableElements();

    return candidates.find((element) => {
      const haystack = textOf(element);
      return wanted.some((label) => exact ? haystack === label : haystack.includes(label));
    });
  }

  function elementArea(element) {
    const rect = element.getBoundingClientRect();
    return rect.width * rect.height;
  }

  function findDownloadSettingsPanel() {
    const fromControls = findDownloadSettingsPanelFromControls();
    if (fromControls) return fromControls;

    const candidates = [
      ...document.querySelectorAll("[role='dialog'], [aria-modal='true'], aside, section, div")
    ].filter((element) => {
      if (!isVisible(element) || isInsideExtensionPanel(element)) return false;
      const text = textOf(element);
      const hasSettingsText = dictionary.downloadSettings.every((label) => text.includes(normalize(label)));
      const hasDownloadHeading = [...element.querySelectorAll("h1,h2,h3,h4,h5,h6")]
        .some((heading) => normalize(heading.innerText || heading.textContent) === "download");
      return hasSettingsText || (hasDownloadHeading && text.includes("file type"));
    });

    return candidates.sort((a, b) => elementArea(a) - elementArea(b))[0] || null;
  }

  function findDownloadSettingsPanelFromControls() {
    const fileType = [...document.querySelectorAll('button[aria-label="File type"], [role="combobox"][aria-label="File type"]')]
      .find((element) => isVisible(element) && !isInsideExtensionPanel(element));

    if (!fileType) return null;

    let node = fileType.parentElement;
    while (node && node !== document.body) {
      const submit = [...node.querySelectorAll('button[type="submit"], button')]
        .find((button) =>
          isVisible(button) &&
          !isInsideExtensionPanel(button) &&
          !isRemoveDownloadControl(button) &&
          isDownloadButtonText(button)
        );

      const back = [...node.querySelectorAll("button")]
        .some((button) => normalize(button.getAttribute("aria-label")) === "back");

      if (submit && back) return node;
      node = node.parentElement;
    }

    return null;
  }

  function findFormatControlInSettingsPanel() {
    const panel = findDownloadSettingsPanel();
    if (!panel) return null;

    const controls = [...panel.querySelectorAll(CLICKABLE_SELECTOR)]
      .filter((element) => isVisible(element) && !isInsideExtensionPanel(element));

    return controls.find((element) => element.getAttribute("aria-label") === "File type") ||
      controls.find((element) => {
        const text = textOf(element);
        return text.includes("png") || text.includes("pdf") || text.includes("file type");
      }) ||
      null;
  }

  function findFinalDownloadButton() {
    const panel = findDownloadSettingsPanel();
    if (!panel) {
      return [...document.querySelectorAll('button[type="submit"], button')]
        .filter((element) => isVisible(element) && !isInsideExtensionPanel(element))
        .filter((element) => !isRemoveDownloadControl(element))
        .find((element) => isDownloadButtonText(element)) || null;
    }

    const root = panel;
    const submit = root.querySelector('button[type="submit"]');
    if (
      submit &&
      isVisible(submit) &&
      !isInsideExtensionPanel(submit) &&
      !isRemoveDownloadControl(submit) &&
      isDownloadButtonText(submit)
    ) {
      return submit;
    }

    const buttons = [...root.querySelectorAll(CLICKABLE_SELECTOR)]
      .filter((element) => isVisible(element) && !isInsideExtensionPanel(element))
      .filter((element) => !isRemoveDownloadControl(element))
      .filter((element) => {
        return isDownloadButtonText(element);
      })
      .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);

    return buttons[0] || null;
  }

  function isRemoveDownloadControl(element) {
    const text = textOf(element);
    const aria = normalize(element?.getAttribute?.("aria-label"));
    return text.includes("remove download") ||
      text.includes("hapus download") ||
      aria.includes("remove download") ||
      aria.includes("hapus download");
  }

  function isDownloadButtonText(element) {
    const text = textOf(element);
    const aria = normalize(element?.getAttribute?.("aria-label"));
    const visibleWords = text.split(" ").filter(Boolean);
    const visibleOnlyDownload = visibleWords.length > 0 &&
      visibleWords.every((word) => word === "download" || word === "unduh");

    return aria === "download" ||
      aria === "unduh" ||
      text === "download" ||
      text === "unduh" ||
      visibleOnlyDownload;
  }

  function findSharePanelDownloadTile() {
    const roots = activeOverlays();
    if (!roots.length) roots.push(document);

    for (const root of roots) {
      const controls = [...root.querySelectorAll(CLICKABLE_SELECTOR)]
        .filter((element) => isVisible(element) && !isInsideExtensionPanel(element))
        .filter((element) => !isRemoveDownloadControl(element));

      const ariaExact = controls.find((element) => {
        const aria = normalize(element.getAttribute("aria-label"));
        return aria === "download" || aria === "unduh";
      });
      if (ariaExact) return ariaExact;

      const textExact = controls.find((element) => {
        const text = textOf(element);
        return text === "download" || text === "unduh";
      });
      if (textExact) return textExact;
    }

    return null;
  }

  function findPublishTrigger() {
    const publishButton =
      findClickableByText(dictionary.publishOptions, true) ||
      findClickableByText(dictionary.publishOptions);

    if (publishButton) return publishButton;

    const controls = clickableElements();
    const shareButtons = controls.filter((element) => {
      const text = textOf(element);
      const aria = normalize(element.getAttribute("aria-label"));
      return text === "share" ||
        text.startsWith("share ") ||
        aria === "share" ||
        text === "bagikan" ||
        text.startsWith("bagikan ") ||
        aria === "bagikan";
    });

    if (!shareButtons.length) return null;

    return shareButtons.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return bRect.right - aRect.right;
    })[0];
  }


  function findFormatOption(format) {
    const labels = format === "PNG"
      ? ["PNG"]
      : format === "PDF Print"
        ? ["PDF Print"]
        : format === "MP4 Video"
          ? ["MP4 Video", "MP4"]
          : ["PDF Standard"];

    const wanted = labels.map(normalize);
    const options = [...document.querySelectorAll('[role="option"], button')]
      .filter((element) => isVisible(element) && !isInsideExtensionPanel(element));

    return options.find((element) => {
      const text = textOf(element);
      return wanted.some((label) => text === label || text.startsWith(`${label} `));
    }) || null;
  }

  function normalizePageRange(value) {
    return String(value || "")
      .replace(/^pages?/i, "")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, "")
      .trim();
  }

  function formatPageRangeForCanva(value) {
    const normalized = normalizePageRange(value);
    return normalized ? `Pages ${normalized}` : "";
  }

  function findSelectPagesInput() {
    const panel = findDownloadSettingsPanel();
    const root = panel || document;
    return [...root.querySelectorAll('input[placeholder="Select pages"], [role="combobox"]')]
      .filter((element) => isVisible(element) && !isInsideExtensionPanel(element))
      .find((element) =>
        element.getAttribute("placeholder") === "Select pages" ||
        normalize(element.getAttribute("aria-label")) === "select pages"
      ) || null;
  }

  async function setSelectPages(pageRange) {
    const formatted = formatPageRangeForCanva(pageRange);
    if (!formatted) return;

    const input = findSelectPagesInput();
    if (!input) {
      log(`Tidak menemukan input Select pages untuk ${formatted}.`);
      return;
    }

    const current = String(input.value || "").replace(/[–—]/g, "-");
    if (current.toLowerCase() === formatted.toLowerCase()) {
      log(`Pages sudah ${formatted}.`);
      return;
    }

    input.scrollIntoView({ block: "center", inline: "center" });
    input.focus();

    const proto = Object.getPrototypeOf(input);
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) {
      setter.call(input, formatted);
    } else {
      input.value = formatted;
    }

    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: formatted }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    input.blur();

    log(`Set halaman: ${formatted}.`);
    await sleep(600);
  }

  function hasVisibleText(labels) {
    const wanted = labels.map(normalize);
    return [...document.querySelectorAll("body *")]
      .filter((element) => isVisible(element) && !isInsideExtensionPanel(element))
      .some((element) => {
        const haystack = textOf(element);
        return wanted.some((label) => haystack.includes(label));
      });
  }

  function findNearbyClickable(labels) {
    const wanted = labels.map(normalize);
    const visible = [...document.querySelectorAll("body *")]
      .filter((element) => isVisible(element) && !isInsideExtensionPanel(element));
    const labelNode = visible.find((element) => {
      const haystack = textOf(element);
      return wanted.some((label) => haystack.includes(label));
    });

    if (!labelNode) return null;

    const region = labelNode.closest("[role='dialog'], [role='menu'], form, section, div") || document.body;
    return region.querySelector(CLICKABLE_SELECTOR);
  }

  async function clickElement(element, description) {
    if (!element) {
      throw new Error(`Tidak menemukan tombol: ${description}`);
    }

    const targetText = textOf(element).slice(0, 140);
    element.scrollIntoView({ block: "center", inline: "center" });
    await sleep(250);
    element.click();
    log(`Klik ${description}: ${targetText || element.tagName.toLowerCase()}.`);
    await sleep(900);
  }

  async function clickByText(labels, description, exact = false) {
    await clickElement(findClickableByText(labels, exact), description);
  }

  async function openDownloadPanel() {
    if (findDownloadSettingsPanel()) {
      log("Panel pengaturan Download sudah terbuka.");
      return;
    }

    const sharePanelIsOpen = hasVisibleText(dictionary.shareDesign);
    const downloadInOpenPanel = sharePanelIsOpen && findSharePanelDownloadTile();

    if (downloadInOpenPanel) {
      await clickElement(downloadInOpenPanel, "Download dari panel Share");
      await sleep(1000);
      return;
    }

    const publishButton = findPublishTrigger();

    await clickElement(publishButton, "ikon pojok kanan atas");
    await sleep(1000);
    await clickElement(
      findSharePanelDownloadTile(),
      "Download dari panel Share"
    );
  }

  async function openFileTypeControl() {
    const settingsFormatControl = findFormatControlInSettingsPanel();
    if (settingsFormatControl) {
      await clickElement(settingsFormatControl, "dropdown File type");
      return;
    }

    const fileTypeControl =
      findClickableInActiveOverlay(dictionary.fileType) ||
      findClickableByText(dictionary.fileType) ||
      findNearbyClickable(dictionary.fileType);

    if (fileTypeControl) {
      await clickElement(fileTypeControl, "pilihan format file");
      return;
    }

    const knownFormat = findClickableInActiveOverlay([
      ...dictionary.png,
      ...dictionary.pdfStandard,
      ...dictionary.pdfPrint,
      ...dictionary.mp4Video
    ]) || findClickableByText([
      ...dictionary.png,
      ...dictionary.pdfStandard,
      ...dictionary.pdfPrint,
      ...dictionary.mp4Video
    ]);
    await clickElement(knownFormat, "dropdown format aktif");
  }

  async function selectFormat(format) {
    const formatLabels = format === "PNG"
      ? dictionary.png
      : format === "PDF Print"
        ? dictionary.pdfPrint
        : format === "MP4 Video"
          ? dictionary.mp4Video
          : dictionary.pdfStandard;

    const panel = findDownloadSettingsPanel();
    if (panel) {
      const currentFormatControl = findFormatControlInSettingsPanel();
      const currentText = textOf(currentFormatControl);
      const desiredIsAlreadySelected = formatLabels.some((label) => currentText.includes(normalize(label)));

      if (desiredIsAlreadySelected) {
        log(`Format ${format} sudah terpilih.`);
        return;
      }
    }

    await openFileTypeControl();
    await sleep(600);
    await clickElement(
      findFormatOption(format) ||
        findClickableInActiveOverlay(formatLabels) ||
        findClickableByText(formatLabels),
      format
    );
  }

  async function confirmDownload() {
    const continueButton =
      findClickableInActiveOverlay(dictionary.continue) ||
      findClickableByText(dictionary.continue);

    if (continueButton) {
      await clickElement(continueButton, "Continue/Lanjutkan");
      await sleep(800);
    }

    const finalDownload =
      findFinalDownloadButton();

    await clickElement(finalDownload, "tombol Download ungu");
    log("Menunggu Canva memproses file...");
    await sleep(2500);
  }

  async function downloadOne(format, delayMs, pageRange) {
    log(`Mulai format ${format}.`);
    await openDownloadPanel();
    await selectFormat(format);
    await setSelectPages(pageRange);
    await confirmDownload();
    log(`${format} dikirim ke proses download Canva.`);
    await sleep(delayMs);
  }

  async function runDownload(settings) {
    if (isRunning) {
      log("Masih ada proses yang berjalan.");
      return { ok: false, error: "Proses download masih berjalan." };
    }

    isRunning = true;
    const formats = settings?.formats?.length ? settings.formats : ["PNG", "PDF Standard"];
    const delayMs = Number(settings?.delayMs || 3500);
    const pageRanges = settings?.pageRanges || {};

    try {
      removeLegacyPagePanel();
      for (const format of formats) {
        await downloadOne(format, delayMs, pageRanges[format] || "");
        log(`Jeda ${Math.round(delayMs / 1000)} detik sebelum format berikutnya.`);
      }
      log("Selesai menjalankan semua format.");
      return { ok: true };
    } catch (error) {
      log(`Gagal: ${error.message}`);
      log(`Debug ringkas: ${JSON.stringify(debugSnapshot()).slice(0, 1400)}`);
      return { ok: false, error: error.message };
    } finally {
      isRunning = false;
    }
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) {
      logNode = panel.querySelector(".codex-panel-log");
      return panel;
    }

    panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <button class="codex-panel-tab" type="button" data-action="show" title="Show Canva Multi Download">Download</button>
      <div class="codex-panel-shell">
        <div class="codex-panel-head">
          <div class="codex-panel-title">Canva Multi Download</div>
          <div class="codex-panel-actions">
            <button class="codex-icon-button" type="button" data-action="hide" title="Hide">_</button>
            <button class="codex-icon-button" type="button" data-action="close" title="Close">x</button>
          </div>
        </div>
        <div class="codex-panel-body">
          <button class="codex-primary-button" type="button" data-action="download">Download PNG + PDF</button>
          <button class="codex-secondary-button" type="button" data-action="download-pdf">Download PDF saja</button>
          <button class="codex-secondary-button" type="button" data-action="debug">Copy Debug</button>
          <div class="codex-panel-log" aria-live="polite">Siap.</div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(panel);
    logNode = panel.querySelector(".codex-panel-log");
    updatePanelLayout(panel);

    if (!resizeListenerAttached) {
      resizeListenerAttached = true;
      window.addEventListener("resize", () => {
        const currentPanel = document.getElementById(PANEL_ID);
        if (currentPanel) updatePanelLayout(currentPanel);
      });
    }

    panel.addEventListener("click", async (event) => {
      const action = event.target?.getAttribute?.("data-action");
      if (!action) return;

      if (action === "close") {
        releasePanelLayout();
        panel.remove();
        return;
      }

      if (action === "hide") {
        panel.dataset.hidden = "true";
        updatePanelLayout(panel);
        return;
      }

      if (action === "show") {
        panel.dataset.hidden = "false";
        updatePanelLayout(panel);
        return;
      }

      if (action === "download") {
        const button = event.target;
        button.disabled = true;
        await runDownload({ formats: ["PNG", "PDF Standard"], delayMs: 3500 });
        button.disabled = false;
      }

      if (action === "download-pdf") {
        const button = event.target;
        button.disabled = true;
        await runDownload({ formats: ["PDF Standard"], delayMs: 3500 });
        button.disabled = false;
      }

      if (action === "debug") {
        await copyDebugSnapshot();
      }
    });

    return panel;
  }

  function updatePanelLayout(panel) {
    const isHidden = panel.dataset.hidden === "true";
    const panelWidth = Math.ceil(panel.getBoundingClientRect().width || 380);
    document.documentElement.style.setProperty("--codex-canva-panel-space", `${panelWidth}px`);
    document.documentElement.classList.toggle("codex-canva-panel-open", !isHidden);
  }

  function releasePanelLayout() {
    document.documentElement.classList.remove("codex-canva-panel-open");
    document.documentElement.style.removeProperty("--codex-canva-panel-space");
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "CANVA_MULTI_DEBUG") {
      sendResponse({ ok: true, debug: debugSnapshot() });
      return false;
    }

    if (message?.type !== "CANVA_MULTI_DOWNLOAD") return false;

    runDownload(message.settings).then(sendResponse);
    return true;
  });

  if (location.hostname === "www.canva.com" || location.hostname === "canva.com") {
    removeLegacyPagePanel();
  }
})();
