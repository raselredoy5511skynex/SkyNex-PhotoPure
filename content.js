/*
 * Screenshot Cleaner for Zillow — content script
 *
 * Removes the photo carousel counter ("15 of 26") and other overlay UI
 * the moment each photo appears, so screenshots come out clean with no
 * manual erasing.
 *
 * Strategy:
 *   1. On load, scrub the page once.
 *   2. A MutationObserver (throttled to one pass per animation frame) re-scrubs
 *      whenever Zillow re-renders the carousel — e.g. when you click "next photo".
 *   3. Settings (which overlays to strip, on/off) are read from chrome.storage
 *      and updated live when you change them in the popup.
 */
(() => {
  "use strict";

  const STORAGE_KEY = "zsc_settings";

  // Default settings — first run strips the counter and tour badges.
  const DEFAULTS = {
    enabled: true,
    removeCounter: true,
    removeBadges: true,
    removeCaption: false,
    removeLogo: false,
  };

  let settings = { ...DEFAULTS };

  // CSS selectors for the overlays we strip, grouped by category.
  // The counter selector comes straight from the markup the user pasted
  // (data-testid="desktop-carousel-photo-counter").
  const SELECTORS = {
    counter: [
      '[data-testid="desktop-carousel-photo-counter"]',
      '[data-testid*="photo-counter"]',
      '[data-testid*="carousel-counter"]',
      '[data-testid*="photo-count"]',
    ],
    badges: [
      '[data-testid*="virtual-tour"]',
      '[data-testid*="3d-tour"]',
      '[data-testid*="media-badge"]',
      '[data-testid*="photo-badge"]',
    ],
    caption: [
      '[data-testid*="photo-caption"]',
      '[data-testid*="photo-description"]',
      '[data-testid*="caption-text"]',
    ],
    logo: [
      '[data-testid*="hero-photo-logo"]',
      '[data-testid*="photo-logo"]',
    ],
  };

  // Returns the list of selectors that are currently enabled.
  function activeSelectors() {
    const out = [];
    if (settings.removeCounter) out.push(...SELECTORS.counter);
    if (settings.removeBadges) out.push(...SELECTORS.badges);
    if (settings.removeCaption) out.push(...SELECTORS.caption);
    if (settings.removeLogo) out.push(...SELECTORS.logo);
    return out;
  }

  // Also strip any "X of Y" / "X / Y" tag label even if its testid changes,
  // by matching the text pattern the user reported ("15 of 26").
  function stripCounterByText() {
    if (!settings.removeCounter) return 0;
    let n = 0;
    const nodes = document.querySelectorAll(
      '[data-c11n-component="Tag.Label"], .c11n_tag__label'
    );
    nodes.forEach((el) => {
      const text = (el.textContent || "").trim();
      if (/^\d+\s*(of|\/)\s*\d+$/i.test(text)) {
        const root =
          el.closest('[data-c11n-component="Tag.Root"]') ||
          el.closest(".c11n_tag__root") ||
          el;
        if (root && root.parentNode) {
          root.remove();
          n += 1;
        }
      }
    });
    return n;
  }

  // One scrub pass. Returns how many elements it removed (for the "clean now"
  // status message).
  function cleanPage() {
    if (!settings.enabled) return 0;
    let removed = 0;
    for (const sel of activeSelectors()) {
      document.querySelectorAll(sel).forEach((el) => {
        el.remove();
        removed += 1;
      });
    }
    removed += stripCounterByText();
    return removed;
  }

  // Throttle: coalesce many mutation bursts into one scrub per frame so we
  // never get a runaway loop (removing nodes fires more mutations).
  let scheduled = false;
  function scheduleClean() {
    if (scheduled) return;
    scheduled = true;
    // requestAnimationFrame may be unavailable in odd contexts; fall back to setTimeout.
    const run = () => {
      scheduled = false;
      cleanPage();
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(run);
    } else {
      setTimeout(run, 16);
    }
  }

  let observer = null;
  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(scheduleClean);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // Apply a new settings object: scrub once, then keep / start / stop the observer.
  function applySettings(next) {
    settings = { ...settings, ...next };
    if (settings.enabled) {
      cleanPage();
      startObserver();
    } else {
      stopObserver();
    }
  }

  // Boot: load saved settings (or defaults), then scrub + observe.
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const stored = result && result[STORAGE_KEY];
    applySettings(stored ? { ...DEFAULTS, ...stored } : DEFAULTS);
  });

  // Live-update when settings change in the popup (or another tab).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      applySettings({ ...DEFAULTS, ...changes[STORAGE_KEY].newValue });
    }
  });

  // Respond to the popup's "clean this page now" button.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "zsc-clean-now") {
      const removed = cleanPage();
      sendResponse({ ok: true, removed });
      return true;
    }
    if (msg && msg.type === "zsc-get-status") {
      sendResponse({ ok: true, settings });
      return true;
    }
    return false;
  });
})();
