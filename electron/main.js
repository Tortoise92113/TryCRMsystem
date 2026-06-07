const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron')
const path = require('path')

const { registerClientHandlers }   = require('./ipc/clients')
const { registerProjectHandlers }  = require('./ipc/projects')
const { registerQuoteHandlers }    = require('./ipc/quotes')
const { registerSettingsHandlers } = require('./ipc/settings')
const { registerNotionHandlers }   = require('./ipc/notion')
const { registerSheetsHandlers }   = require('./ipc/sheets')
const { registerSeedHandlers }     = require('./ipc/seed')
const { registerGuideHandlers }    = require('./ipc/guide')
const { registerReminderHandlers } = require('./ipc/reminders')
const reminderService              = require('./services/reminderService')

const isDev     = process.env.NODE_ENV !== 'production'
const VITE_PORT = process.env.VITE_PORT || 5173

let mainWindow       = null
let tray             = null
let reminderInterval = null

// ─── 動態建立托盤圖示（純 Buffer，不需外部 icon 檔案）────────────────────────
/**
 * 在記憶體中產生 16×16 圓形圖示
 * @param {boolean} hasOverdue true = 紅色（有逾期），false = 靛藍色（正常）
 * @returns {Electron.NativeImage}
 */
function createTrayImage(hasOverdue) {
  const size = 16
  const buf  = Buffer.alloc(size * size * 4)  // RGBA

  for (let i = 0; i < size * size; i++) {
    const x    = i % size
    const y    = Math.floor(i / size)
    // 以像素中心點計算與圓心的距離
    const dist = Math.sqrt((x - 7.5) ** 2 + (y - 7.5) ** 2)
    const off  = i * 4

    if (dist <= 6.5) {
      if (hasOverdue) {
        // 紅色 #ef4444
        buf[off] = 239; buf[off + 1] = 68;  buf[off + 2] = 68;  buf[off + 3] = 255
      } else {
        // 靛藍色 #6366f1
        buf[off] = 99;  buf[off + 1] = 102; buf[off + 2] = 241; buf[off + 3] = 255
      }
    } else {
      buf[off] = 0; buf[off + 1] = 0; buf[off + 2] = 0; buf[off + 3] = 0  // 透明
    }
  }

  return nativeImage.createFromBuffer(buf, { width: size, height: size })
}

// ─── 托盤圖示更新（逾期時顯示紅點）──────────────────────────────────────────
function updateTrayIcon() {
  if (!tray) return
  const count = reminderService.getOverdueCount()
  tray.setImage(createTrayImage(count > 0))
  tray.setToolTip(
    count > 0
      ? `Freelance CRM — ${count} 個逾期專案`
      : 'Freelance CRM'
  )
}

// ─── 建立系統托盤 ────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(createTrayImage(false))
  tray.setToolTip('Freelance CRM')

  /** 每次點開右鍵選單都重建，確保計數是最新的 */
  function buildMenu() {
    const sent    = reminderService.getTodaySentCount()
    const overdue = reminderService.getOverdueCount()

    return Menu.buildFromTemplate([
      {
        label: '開啟應用程式',
        click: () => showMainWindow(),
      },
      {
        label: '立即檢查提醒',
        click: async () => {
          await reminderService.checkAndSendReminders()
          updateTrayIcon()
          tray.setContextMenu(buildMenu())
        },
      },
      {
        // 顯示摘要，不可點擊
        label: `今日提醒摘要 — 已發送 ${sent} 則${overdue > 0 ? `，${overdue} 個逾期` : ''}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '結束程式',
        click: () => {
          app.isQuiting = true
          app.quit()
        },
      },
    ])
  }

  tray.setContextMenu(buildMenu())

  // 每次右鍵點擊時重建選單（更新計數）
  tray.on('right-click', () => tray.setContextMenu(buildMenu()))

  // 雙擊托盤圖示顯示主視窗
  tray.on('double-click', showMainWindow)
}

// ─── 顯示主視窗 ──────────────────────────────────────────────────────────────
function showMainWindow() {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// ─── 建立主視窗 ──────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1280,
    height: 800,
    minWidth:  900,
    minHeight: 600,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    titleBarStyle: 'default',
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${VITE_PORT}`)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // F5 在視窗內重新整理（不觸發全域快捷鍵）
  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.key === 'F5' && input.type === 'keyDown') {
      mainWindow.webContents.reload()
    }
  })

  // 關閉視窗時改為縮小到托盤，保持背景執行
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── 啟動提醒排程 ────────────────────────────────────────────────────────────
function startReminderScheduler() {
  // 注入主視窗取得器，讓通知點擊後可以開啟視窗
  reminderService.init(() => mainWindow)

  // App 啟動時立即執行一次
  reminderService.checkAndSendReminders()
    .then(() => updateTrayIcon())
    .catch(e => console.error('[Reminder] 啟動檢查失敗:', e))

  // 之後每小時執行一次（3600000 ms）
  reminderInterval = setInterval(async () => {
    try {
      await reminderService.checkAndSendReminders()
      updateTrayIcon()
    } catch (e) {
      console.error('[Reminder] 定期檢查失敗:', e)
    }
  }, 60 * 60 * 1000)
}

// ─── App 生命週期 ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // 移除預設選單列（File / Edit / View / Window / Help）
  Menu.setApplicationMenu(null)

  // 退出應用程式（由 renderer 的關閉按鈕觸發，帶二次確認）
  ipcMain.handle('app:quit', () => {
    app.isQuiting = true
    app.quit()
  })

  // 註冊所有 IPC handlers
  registerClientHandlers()
  registerProjectHandlers()
  registerQuoteHandlers()
  registerSettingsHandlers()
  registerNotionHandlers()
  registerSheetsHandlers()
  registerSeedHandlers()
  registerGuideHandlers()
  registerReminderHandlers()

  createTray()
  createWindow()
  startReminderScheduler()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Windows / Linux：關閉所有視窗時不退出，保持托盤常駐
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') app.quit()
})

app.on('before-quit', () => {
  app.isQuiting = true
  if (reminderInterval) {
    clearInterval(reminderInterval)
    reminderInterval = null
  }
})
