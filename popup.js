/*
 * Popup logic: load saved settings into the checkboxes, save on every change,
 * and handle the "Clean this page now" button by messaging the active tab.
 */
(() => {
  "use strict";

  const STORAGE_KEY = "zsc_settings";

  const DEFAULTS = {
    enabled: true,
    removeCounter: true,
    removeBadges: true,
    removeCaption: false,
    removeLogo: false,
  };

  const fields = {
    enabled: document.getElementById("enabled"),
    removeCounter: document.getElementById("removeCounter"),
    removeBadges: document.getElementById("removeBadges"),
    removeCaption: document.getElementById("removeCaption"),
    removeLogo: document.getElementById("removeLogo"),
  };

  const statusEl = document.getElementById("status");
  const cleanBtn = document.getElementById("cleanNow");

  function showStatus(msg, warn = false) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("warn", warn);
  }

  function setUI(settings) {
    for (const key of Object.keys(fields)) {
      if (fields[key] && typeof settings[key] === "boolean") {
        fields[key].checked = settings[key];
      }
    }
  }

  // Read every checkbox into a settings object and persist it.
  // chrome.storage.onChanged in content.js picks the change up live.
  function saveFromUI() {
    const next = { ...DEFAULTS };
    for (const key of Object.keys(fields)) {
      if (fields[key]) next[key] = fields[key].checked;
    }
    chrome.storage.local.set({ [STORAGE_KEY]: next }, () => {
      showStatus(next.enabled ? "Settings saved — cleaning on" : "Settings saved — paused");
    });
  }

  // Load settings on open.
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const stored = result && result[STORAGE_KEY];
    setUI({ ...DEFAULTS, ...(stored || {}) });
  });

  // Save on any checkbox change.
  Object.values(fields).forEach((el) => {
    if (el) el.addEventListener("change", saveFromUI);
  });

  // "Clean this page now" — message the active tab's content script.
  cleanBtn.addEventListener("click", () => {
    cleanBtn.disabled = true;
    showStatus("");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      const url = tab && tab.url ? tab.url : "";

      if (!url.startsWith("https://www.zillow.com/") && !url.startsWith("https://zillow.com/")) {
        showStatus("Open a Zillow listing page first.", true);
        cleanBtn.disabled = false;
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: "zsc-clean-now" }, (resp) => {
        cleanBtn.disabled = false;
        if (chrome.runtime.lastError) {
          // Content script isn't there (page reloaded before injection, etc).
          showStatus("Refresh the Zillow page, then try again.", true);
          return;
        }
        if (resp && resp.ok) {
          const n = resp.removed || 0;
          showStatus(
            n > 0 ? `Removed ${n} overlay${n === 1 ? "" : "s"}.` : "Page already clean."
          );
        } else {
          showStatus("Couldn't clean this page.", true);
        }
      });
    });
  });
})();
