# Screenshot Cleaner for Zillow

A Chrome extension that **automatically removes the photo counter ("15 of 26") and other carousel overlays** from Zillow listing pages, so every screenshot you take of a property's photos comes out clean — no more manual erasing for each of the 10–29 photos per house.

## What it does

- Strips the **"15 of 26" counter** the instant each photo appears in the carousel.
- Optionally also strips **tour badges** (virtual tour / 3D tour), **photo captions**, and the **logo watermark**.
- Runs continuously while you browse photos — a `MutationObserver` re-scrubs every time Zillow re-renders the carousel.
- A popup lets you toggle it on/off, choose which overlays to remove, and force a "clean now" pass.

## Install (load unpacked)

1. Download and unzip the extension folder, or use the provided `zillow-screenshot-cleaner.zip`.
2. Open Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped `zillow-screenshot-cleaner` folder (the one containing `manifest.json`).
5. The camera-with-red-slash icon appears in your toolbar. Pin it if you like.

> Works in Chrome, Edge, Brave, and any Chromium browser. Manifest V3.

## Use it

1. Open a Zillow listing (e.g. `https://www.zillow.com/homedetails/...`).
2. Click into the photo carousel and browse with the arrow keys or next/prev buttons.
3. Take your screenshots (Print Screen, Snipping Tool, macOS Cmd+Shift+4, etc.) — the counter is already gone.
4. (Optional) Click the extension icon to:
   - Toggle auto-clean on/off.
   - Pick which overlays to strip.
   - Hit **Clean this page now** for a one-off scrub (the popup tells you how many elements it removed).

## How it works

The counter is an element with `data-testid="desktop-carousel-photo-counter"` (a `Tag.Root` containing a `Tag.Label` span showing "15 of 26"). The content script:

1. Removes any element matching the counter selectors (and a few related overlay selectors).
2. Also scans `Tag.Label` spans for the `X of Y` / `X / Y` text pattern, so it still works if Zillow renames the testid.
3. Re-runs on every DOM change (throttled to one pass per animation frame) so each new photo is cleaned as it appears.

Settings are stored in `chrome.storage.local` and applied live — changing a toggle in the popup updates the active tab instantly.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest (MV3), matches `zillow.com`. |
| `content.js` | Content script that strips overlays + `MutationObserver`. |
| `popup.html` / `popup.css` / `popup.js` | Toolbar popup UI and settings persistence. |
| `icons/icon{16,48,128}.png` | Toolbar and store icons. |

## Notes & limits

- Targets `zillow.com` only (the markup you pasted is Zillow's `c11n` design system). To use it on another real-estate site, add that site's URL to both `host_permissions` and `content_scripts.matches` in `manifest.json`, and adjust selectors in `content.js` if the overlay markup differs.
- Removing overlays only changes what's on screen; it does **not** bypass any paywall, blur, or access control.
- If a listing's photos load inside an `<iframe>`, set `"all_frames": true` in `manifest.json`'s `content_scripts` entry.
