# CogniLearn - A neuro-aware screenshot tutor
Cognilearn is an AI tutor that uses BCI technology to automatically detect when you are confused. Once confusion is detected, CogniLearn screenshots the problem you are on, understands it, and then offers gentle guidance on our UI.

![UI](https://github.com/manik-sethi/cognihacks/blob/main/cognilearn1.png)

![UI](https://github.com/manik-sethi/cognihacks/blob/main/cognilearn2.png)

## 🧰 How we built it:
Here's how we built the project

### Website
We used lovable to generate a website, and then adjusted the code so it would work with our backend. Our backend is in python, and our frontend involves javascript .

### BCI tracking
In an ideal scenario, we'd use the Emotiv headset to track our confusion metrics and then directly stream it to our python backend. From there, we'd do any type of processing required and then pass it to our frontend.

### Chrome Extension
In order to screenshot, we built a chrome extension to take care of that. If our confusion value passed the threshold, then the extension would activate and take a screenshot of the current tab.

## 🚀 Getting Started
### Prereqs
* Use node
* OpenAI API key
### Install and Run (Frontend)
```
npm run dev
```

### Python Backend
```
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r ..requirements.txt
python -m uvicorn main:app --reload
```
Keep in mind that you need to restart the backend if you want the confusion value to reset from 0, otherwise it oscilliates around 80, which is higher than our threshold of 65.

### Chrome Extension
If you wish to use the Chrome extension, copy the following file contents into the same folder. Next, go to chrome://extensions -> Developer mode -> Load unpacked -> Select the folder with these there files

#### background.js
```
// background.js
console.log("[background] Service worker started");

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "CAPTURE_VISIBLE_TAB") return false;

  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }

    const tab = tabs[0];
    if (!tab || tab.windowId == null) {
      sendResponse({ ok: false, error: "No active tab/window" });
      return;
    }

    // Ensure window is focused (some OSes block captures on unfocused windows)
    chrome.windows.update(tab.windowId, { focused: true }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      // Delay a bit after focus so the frame is fully painted
      setTimeout(() => {
        chrome.tabs.captureVisibleTab(
          tab.windowId,
          { format: "png", quality: 100 },
          (dataUrl) => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            if (!dataUrl || !dataUrl.startsWith("data:image/png;base64,")) {
              sendResponse({ ok: false, error: "Invalid or empty screenshot data" });
              return;
            }

            const base64 = dataUrl.split(",")[1]; // strip prefix
            sendResponse({ ok: true, base64 });
          }
        );
      }, 500);
    });
  });

  return true; // keep channel open for async sendResponse
});
```

#### content.js
```
// content.js
console.log("[content] Script loaded. Listening for messages from the page.");

window.addEventListener("message", async (event) => {
  if (!event.data || event.data.__from !== "APP") return;

  const msg = event.data;

  if (msg.type === "REQUEST_CAPTURE") {
    console.log("[content] Message is a valid capture request. Forwarding to background script.");

    chrome.runtime.sendMessage({ type: "CAPTURE_VISIBLE_TAB" }, (resp) => {
      if (chrome.runtime.lastError) {
        console.error("[content] Error from background:", chrome.runtime.lastError.message);
        window.postMessage(
          { __from: "EXT", type: "CAPTURE_RESULT", ok: false, error: chrome.runtime.lastError.message },
          "*"
        );
        return;
      }

      console.log("[content] Got response from background script:", resp);

      window.postMessage(
        {
          __from: "EXT",
          type: "CAPTURE_RESULT",
          ok: resp?.ok || false,
          base64: resp?.base64 || null,
          error: resp?.error || null,
        },
        "*"
      );
    });
  }
});
```

#### manifest.json
```
//manifest.json
{
  "manifest_version": 3,
  "name": "Confusion Screenshot Bridge",
  "version": "1.0.2",
  "permissions": [
    "tabs", 
    "activeTab",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": { 
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_end",
      "all_frames": false
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```
