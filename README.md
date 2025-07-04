# Cellebrite Screen Capture Tool

**Cellebrite Screen Capture Tool** is a cross‑browser extension (Chrome / Edge / Firefox) that lets investigators grab instant screenshots or screen recordings and store them securely in an Amazon S3 bucket, ready to be attached to case files.

<p align="center">
  <img src="assets/screenshot-capture-ui.png" alt="Capture UI" width="640">
</p>

## ✨ Features

|                             | Capability                                              |
| --------------------------- | ------------------------------------------------------- |
| 📸 **Capture modes**        | Full screen, current tab, or user‑defined region        |
| 🎥 **Screen recording**     | Record tab or entire desktop as WebM / MP4 (with audio) |
| 🗄 **Cloud storage**        | Direct, presigned uploads to your own S3 bucket         |
| 📋 **Clipboard & Download** | Copy image to clipboard or save to local disk           |
| 🛠 **Mock mode**            | Switch to a fully local mock backend for UI work        |
| ⚡ **Hotkeys**               | Customisable shortcuts for quick capture                |
| 🌓 **Modern UI**            | React 19, Tailwind CSS & MUI, dark‑mode aware           |
| 🌐 **Manifest V3**          | Built with WXT so it works in Chrome, Edge and Firefox  |

## 🏗 Tech Stack

* **React 19** & **TypeScript**
* **WXT** – Web eXtension Toolkit (Manifest V3 builder)
* **Tailwind CSS** + **MUI** for styling
* **AWS SDK v3** (S3 presigned uploads) – configurable via `.env`
* ESLint, Prettier, Husky, Vitest (planned) for code quality

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone https://github.com/lvntruong/chrome-extension-video-capture.git
cd chrome-chrome-extension-video-capture
npm install

# 2. Start extension with real backend
npm run dev:real        # or npm run dev:mock for offline mode

# 3. Load the unpacked build
# ‑ open chrome://extensions → "Load unpacked" → .wxt/dev
```

> **Node >= 22.12.0** is required

## 🔧 Environment Variables

Create `.env.development` (for local) or `.env.production` (for build):

```bash
# Backend REST API
VITE_API_BASE_URL=http://localhost:3001/api

# Toggle mock mode (true ⇢ no backend/S3 calls)
VITE_ENABLE_MOCK_MODE=false

# AWS
VITE_AWS_REGION=ap-southeast-1
VITE_AWS_S3_BUCKET_NAME=my-case-captures
```

See `DEVELOPMENT_WORKFLOW.md` for the full list.

## 📜 NPM Scripts

| Script                               | Description                                       |
| ------------------------------------ | ------------------------------------------------- |
| `npm run dev`                        | Hot‑reload build for Chrome                       |
| `npm run dev:firefox`                | Hot‑reload build for Firefox                      |
| `npm run build`                      | Production build (reads `.env.production`)        |
| `npm run zip`                        | Create a versioned ZIP ready for Chrome Web Store |
| `npm run lint`, `npm run type-check` | Quality gates                                     |
| `npm run setup:aws`                  | Helper to bootstrap your S3 bucket                |
| `npm run test:integration`           | End‑to‑end connectivity test                      |

See `package.json` for the complete list.

## 🗄 Folder Structure (high‑level)

```
.
├── entrypoints/      # background, content‑script & options pages
├── components/       # shared React UI pieces
├── services/         # capture, upload, notification helpers
├── config/           # environment‑specific config & AWS helpers
├── scripts/          # CLI utilities (setup S3, checks, tests)
└── types/, utils/    # shared types & helpers
```

## 🛡 Permissions

The manifest requests the following permissions: `activeTab`, `tabs`, `storage`, `scripting`, `tabCapture`, `desktopCapture`.
These are the minimum required to:

* read the active tab to grab a screenshot
* capture entire desktop or individual windows
* save user preferences locally
* inject scripts for region selection overlays

## 🏗 Development Workflow

A typical two‑terminal setup:

| Terminal # | Command                                       | Purpose                        |
| ---------- | --------------------------------------------- | ------------------------------ |
| 1          | `npm run dev:real`                            | Starts hot‑reload extension    |
| 2          | `cd chrome-screen-capture-api && npm run dev` | Runs REST + S3 presign backend |

Refer to the dedicated workflow guide for troubleshooting & CI/CD steps.

## 🛣 Roadmap

* [ ] Annotation layer (arrows, text, blur)
* [ ] OAuth2 login to retrieve user token
* [ ] Chunked multipart upload for >100 MB recordings
* [ ] In‑browser trim & export (ffmpeg‑wasm)

## 🤝 Contributing

PRs & issues are welcome!
Run `npm run lint && npm run type-check` before submitting.

## 📄 License

[MIT](./LICENSE)

---

