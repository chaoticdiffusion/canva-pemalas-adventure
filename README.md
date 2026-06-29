# Canva Pemalas Adventure

Chrome/Edge extension for downloading Canva designs in multiple formats in sequence: PNG, PDF Standard, PDF Print, and MP4 Video.

This extension **does not bypass Canva** and does not fetch files directly from Canva servers. It automates clicks on the Canva UI that is already open in your browser, so you still need to be logged in and have download access to the design.

## Installation

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Klik **Load unpacked**.
4. Select the extracted extension folder.

## Usage

1. Open a design in the Canva editor.
2. Wait until the design finishes loading.
3. Click the **Canva Pemalas Adventure** extension icon to open the Chrome side panel.
4. Select the formats you want.
5. Optionally set a page range for each format, such as `1-4`, `2`, or `1,3`.
6. Click **Download Terpilih**.

Settings can be stored in Chrome storage with **Save config**, or moved between computers with **Export Config** and **Load Config**.

## Notes

- If Canva changes its button labels or layout, the automation selectors may need updates.
- For large files or many pages, increase the delay between formats to 5-8 seconds.
- Your browser may still show download prompts depending on your download settings.
