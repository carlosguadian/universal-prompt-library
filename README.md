# Universal Prompt Library 🚀

A powerful, local-first browser extension to manage, organize, and inject prompts into any AI chatbot (ChatGPT, Claude, Gemini, DeepSeek, Perplexity, and more).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.2.0-green.svg)
![Chrome](https://img.shields.io/badge/chrome-supported-blue.svg)
![Firefox](https://img.shields.io/badge/firefox-supported-orange.svg)

## 🌟 Features

### Core
* **💉 Universal Injection:** Works on **any** website. Automatically detects chat inputs in ChatGPT, Claude, Gemini, Perplexity, HuggingChat, and any generic text area or contenteditable field.
* **⚡️ High Performance:** Optimized injection engine with native setter hack for textareas and smart `innerText` fallback for large texts (2000+ chars), ensuring instant injection without freezing.
* **📂 Unlimited Folders:** Organize your prompts in a nested folder structure without depth limits. Collapsible folders with visual open/closed icons.
* **🔍 Instant Search:** Real-time filtering by title **and** content to find any prompt instantly.
* **🖱️ Smart Drag & Drop:** Reorder prompts and folders freely with precise drop zones — insert before, after, or inside a folder — with visual guides.
* **💾 Local & Private:** All data is stored locally in your browser via `chrome.storage.local`. No external servers, no tracking, no accounts.

### Smart Variables
* **🧠 Dynamic Variables:** Use `{{VariableName}}` syntax to create reusable templates with dynamic inputs.
* **📋 Default Values:** Define defaults with the pipe syntax: `{{Role|Marketing Expert}}`. The field comes pre-filled with the default.
* **🕐 Variable History:** Remembers your last 5 inputs per variable as clickable chips for quick reuse.
* **🔙 Back Navigation:** Navigate forward and backward between variables when filling multi-variable prompts.
* **⌨️ Keyboard Shortcuts:** Press `Ctrl + Enter` (or `Cmd + Enter`) to confirm, `Escape` to cancel.
* **📝 Large Text Area:** Resizable textarea input, perfect for pasting long articles or full context.

### Organization & Productivity
* **⭐ Favorites:** Mark any prompt or folder as a favorite. Favorites are visually highlighted with a star and automatically sorted to the top.
* **📋 Prompt Preview:** Click on any prompt to expand/collapse a content preview (first 200 characters) without opening the editor.
* **📑 Duplicate:** Clone any prompt or folder (including children) with a single click. The copy is placed right next to the original.
* **📊 Usage Tracking:** Each prompt tracks how many times it has been used (injected or copied) and when it was last used. A subtle badge and tooltip display the stats.
* **📝 Edit & Delete:** Inline editing for titles and content. Confirmation dialog before deleting.
* **📋 Copy to Clipboard:** One-click copy of any prompt content, with toast confirmation feedback.

### Backup & Sync
* **📦 Export:** Download your entire library as a JSON file, including prompts, folder structure, variable history, favorites, and usage stats.
* **📥 Import:** Restore from a backup file with full validation. Supports both the new format (`{prompts, variableHistory}`) and legacy format (plain array) for backward compatibility.
* **🕐 Last Modified Indicator:** Displays the timestamp of the last library change, useful for keeping track of sync status across browsers.

### Appearance
* **🌙 Dark Mode:** Full dark theme with a single toggle button. Covers all UI elements — tree, modals, chips, footer, drag & drop guides, and previews. Your preference persists across sessions.
* **✨ Visual Feedback:** Toast notifications for copy, duplicate, and favorite actions. Yellow flash animation on the target chat input when injecting a prompt.

## 🛠️ Installation

Go to the **[Releases Page](https://github.com/carlosguadian/universal-prompt-library/releases)** on the right side of this repository to download the correct version for your browser.

### 🟢 Google Chrome / Edge / Brave / Opera
1. Download **`universal-prompt-library-chrome-v1.1.0.zip`** from the latest Release.
2. Unzip the file to a folder.
3. Open Chrome and go to `chrome://extensions/`.
4. Toggle **"Developer mode"** on (top right corner).
5. Click **"Load unpacked"**.
6. Select the unzipped folder. **Done!**

### 🦊 Mozilla Firefox
1. Download **`universal-prompt-library-firefox-v1.1.0.zip`** from the latest Release.
2. Unzip the file to a folder.
3. Open Firefox and type `about:debugging` in the address bar.
4. Click **"This Firefox"** on the left menu.
5. Click **"Load Temporary Add-on"**.
6. Select the `manifest.json` file inside the unzipped folder. **Done!**

## 📖 How to Use

### 1. Opening the Library
Click the extension icon in your toolbar. This will open the **Side Panel** where your entire prompt library lives.

### 2. Managing Prompts & Folders
* **Create:** Use the toolbar buttons to create a **New Folder** 📂 or a **New Prompt** 📝.
* **Edit:** Hover over any item and click the ✏️ edit button to modify title or content.
* **Delete:** Click the 🗑️ delete button (with confirmation).
* **Duplicate:** Click the 📑 copy button to clone any item instantly.
* **Favorite:** Click the ⭐ star button to pin items to the top of your library.
* **Search:** Type in the top search bar to filter your library by title or content.

### 3. Organizing with Drag & Drop
Drag items to reorder them:
* *Top of item:* Insert **before**.
* *Bottom of item:* Insert **after**.
* *Center of folder:* Move **inside** the folder.

### 4. Using Smart Variables
Create dynamic templates using double curly braces `{{...}}`. You can define **default values** using the pipe `|` symbol.

**Example Prompt:**
> "Act as a {{Role|Marketing Expert}} and write a blog post about {{Topic}}."

**When you inject this prompt:**
1. A modal will appear for each unique variable.
2. **History Chips:** Previously used values appear as clickable chips.
3. **Default Values:** Fields come pre-filled with their defaults (e.g., "Marketing Expert").
4. **Back Button:** Navigate back to previous variables if you need to change something.
5. **Large Input:** The input is a resizable text area, ideal for pasting long context.
6. **Keyboard:** `Ctrl + Enter` / `Cmd + Enter` to confirm · `Escape` to cancel.

### 5. Injection
Click the ➤ **send** button or use copy to clipboard. The extension automatically detects the active chat input on the current page and injects the final text with all variables replaced.

### 6. Backup & Restore
* **Export:** Click the 💾 save button to download a `.json` backup of your entire library.
* **Import:** Click the 📥 upload button and select a previously exported file to restore.

### 7. Dark Mode
Click the 🌙 moon icon in the toolbar to toggle dark mode. Your preference is saved automatically.

## 🏗️ Project Structure

```
universal-prompt-library/
├── manifest.json           # Chrome/Edge/Brave manifest (Manifest V3)
├── manifest-firefox.json   # Firefox manifest (Manifest V3 + sidebar_action)
├── background.js           # Service worker (opens side panel on click)
├── content.js              # Content script (injection engine)
├── sidepanel.html          # Side panel UI structure
├── sidepanel.js            # Main application logic
├── styles.css              # All styles including dark mode
└── images/                 # Extension icons (16, 32, 48, 128px)
```

## 🔧 Supported Chat Platforms

The injection engine detects inputs in this priority order:

1. `#prompt-textarea` — **ChatGPT**
2. `div[contenteditable="true"]` — **Claude**, **Gemini**
3. `textarea` — **Perplexity**, **HuggingChat**, and others
4. `input[type="text"]` — Generic fallback

If no chat input is found, the extension displays an error message asking the user to reload the page.

## 🤝 Contributing & Support

If you find this tool useful, consider subscribing to my AI newsletter:

👉 **[Subscribe to CluPad](https://carlosguadian.substack.com/subscribe)**

Contributions are welcome!
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes.
4. Push to the branch.
5. Open a Pull Request.

## 🛡️ Privacy & Security

* **Offline First:** This extension does not send any data to external servers. Your prompts live in your browser's local storage.
* **No Tracking:** No analytics, no telemetry, no third-party scripts.
* **Permissions:** The extension requires `host_permissions` solely to inject text into chat input fields on the active page. `storage` permission is used for local data persistence.
* **Import Validation:** Imported files are validated against a strict schema before being accepted, preventing malformed data from corrupting your library.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Created with ❤️ by Carlos Guadián Orta.*
