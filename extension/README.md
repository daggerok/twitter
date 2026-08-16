# daggerok X Timeline Collector — Chrome Extension

## Install

1. Download and unzip `twitter-collector-extension.zip` from the dashboard/repository.
2. Open `chrome://extensions` (or your Chromium browser's extension-management page).
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the unzipped `twitter-collector-extension` folder containing `manifest.json`.
6. Pin **daggerok X Timeline Collector** to the toolbar.

## Use

1. Open <https://x.com/I_Am_The_ICT/with_replies> and log in normally.
2. Click the extension toolbar icon.
3. Click **Show panel**, **Start Manual**, or **Start Auto**.
4. Keep the X tab visible while collecting.
5. Use **Copy New JSON** in either the extension popup or floating panel.
6. Open <https://daggerok.github.io/twitter/> and press the purple clipboard button.

The popup automatically injects `content.js` if X's single-page navigation or browser startup prevented the manifest content script from loading.

No password, session cookie, authorization token, or private X storage is exported.
