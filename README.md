# Universal Prompt Library 🚀

A powerful, local-first browser extension to manage, organize, and inject prompts into any AI chatbot (ChatGPT, Claude, Gemini, DeepSeek, and more).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.1.0-green.svg)
![Firefox](https://img.shields.io/badge/firefox-supported-orange.svg)

## 🌟 Features

* **⚡️ High Performance:** Optimized injection engine capable of handling long texts instantly without freezing the browser.
* **🧠 Smart Variables:** Advanced variable system with **History** (remembers your last 5 inputs), **Default Values** support, and a resizable **Textarea** for pasting long articles/context.
* **🔍 Instant Search:** Real-time filtering to find prompts by title or content instantly.
* **📂 Unlimited Folders:** Organize your prompts in a nested folder structure without limits.
* **🖱️ Smart Drag & Drop:** Reorder prompts, move them between folders, and organize your library intuitively.
* **💉 Universal Injection:** Works on **any** website. Automatically detects chat inputs in ChatGPT, Claude, Gemini, Perplexity, and generic text areas.
* **💾 Local & Private:** All data is stored locally in your browser. No external servers, no tracking.
* **📦 Backup System:** Export and Import your library as a JSON file to keep your data safe.

## 🛠️ Installation

Go to the **[Releases Page](https://github.com/carlosguadian/universal-prompt-library/releases)** on the right side of this repository to download the correct version for your browser.

### 🟢 Google Chrome / Edge / Brave / Opera
1.  Download **`universal-prompt-library-chrome-v1.1.0.zip`** from the latest Release.
2.  Unzip the file to a folder.
3.  Open Chrome and go to `chrome://extensions/`.
4.  Toggle **"Developer mode"** on (top right corner).
5.  Click **"Load unpacked"**.
6.  Select the unzipped folder. **Done!**

### 🦊 Mozilla Firefox
1.  Download **`universal-prompt-library-firefox-v1.1.0.zip`** from the latest Release.
2.  Unzip the file to a folder.
3.  Open Firefox and type `about:debugging` in the address bar.
4.  Click **"This Firefox"** on the left menu.
5.  Click **"Load Temporary Add-on"**.
6.  Select the `manifest.json` file inside the unzipped folder. **Done!**

## 📖 How to Use

### 1. Opening the Library
Click the extension icon in your toolbar (the magic box). This will open the Side Panel.

### 2. Organizing & Searching
* **Search:** Type in the top search bar to filter your library instantly.
* **Create:** Use the buttons at the top to create a **New Folder** 📂 or a **New Prompt** 📝.
* **Drag & Drop:** Drag items to reorder them.
    * *Top of item:* Insert before.
    * *Bottom of item:* Insert after.
    * *Center (Folders only):* Move inside.

### 3. Using Smart Variables
Create dynamic templates using double curly braces `{{...}}`. You can now define **default values** using the pipe `|` symbol.

**Example Prompt:**
> "Act as a {{Role|Marketing Expert}} and write a blog post about {{Topic}}."

**When you inject this prompt:**
1.  A modal will appear asking for inputs.
2.  **History Chips:** You will see chips with previously used values. Click one to autofill.
3.  **Default Values:** The "Role" field will already be filled with "Marketing Expert".
4.  **Long Text:** The input box is now a large text area, perfect for pasting full articles or long context.
5.  **Shortcuts:** Press `Ctrl + Enter` (or `Cmd + Enter`) to confirm and inject immediately.

## 🤝 Contributing & Support

If you find this tool useful, consider subscribing to my AI newsletter:

👉 **[Subscribe to CluPad](https://carlosguadian.substack.com/subscribe)**

Contributions are welcome!
1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes.
4.  Push to the branch.
5.  Open a Pull Request.

## 🛡️ Privacy & Security

* **Offline First:** This extension does not send any data to external servers. Your prompts live in your browser's local storage.
* **Permissions:** The extension requires permissions to access web pages solely to inject text into the chat input fields.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Created with ❤️ by Carlos Guadián.*