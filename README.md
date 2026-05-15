# TryCRMsystem

A desktop CRM application built for freelancers to manage clients, track projects, and generate quotes — all offline, no subscription required.

> 專為自由接案者設計的桌面 CRM，管理客戶、追蹤專案、產生報價單，離線也能用。

---

## Features 功能

- **Client Management 客戶管理** — Add, edit, search, and organize client contacts
- **Project Tracking 專案追蹤** — Track project status: negotiating / in progress / completed / cancelled
- **Income Dashboard 收入儀表板** — Monthly income stats, project count, and completion rate
- **Quote Generator 報價單** — Fill in quote items and export as PDF
- **Bilingual UI 雙語介面** — Switch between Traditional Chinese and English

---

## Tech Stack 技術棧

| Layer | Technology |
|-------|-----------|
| Frontend | React + Tailwind CSS |
| Desktop | Electron |
| Database | SQLite (better-sqlite3) |
| PDF Export | electron-pdf / puppeteer |
| Packaging | electron-builder |

---

## Getting Started 開始使用

### Prerequisites
- Node.js v18+
- Git

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/TryCRMsystem.git

# Enter the project directory
cd TryCRMsystem

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Build for Windows

```bash
npm run build
```

The `.exe` installer will be generated in the `dist/` folder.

---

## Project Structure 專案結構

```
TryCRMsystem/
├── src/
│   ├── main/          # Electron main process
│   ├── renderer/      # React frontend
│   └── database/      # SQLite schema & queries
├── public/            # Static assets
├── dist/              # Build output (exe)
└── README.md
```

---

## Roadmap 未來規劃

- [ ] Follow-up reminders 跟進提醒
- [ ] Payment records 收款記錄
- [ ] Contract status tracking 合約狀態追蹤
- [ ] Dark mode 深色模式

---

## Author

**Jonathan Tsai with Claude Code **

---

## License

MIT
