/**
 * 提醒服務模組
 * 負責掃描專案、判斷提醒條件，並透過「系統通知」與「LINE Messaging API」雙管道並行發送。
 * 任一管道失敗不影響另一管道正常運作。
 */
const { Notification } = require('electron')
const { getDb } = require('../db/database')
const https = require('https')

/** 主視窗取得器，由 main.js 在 init() 時注入 */
let _getMainWindow = null

/**
 * 初始化服務，注入主視窗取得器
 * @param {() => BrowserWindow | null} getMainWindow
 */
function init(getMainWindow) {
  _getMainWindow = getMainWindow
}

// ─── 工具函式 ────────────────────────────────────────────────────────────────

/** 從 settings 資料表讀取所有設定值，回傳 key-value 物件 */
function getSettings() {
  const rows = getDb().prepare('SELECT key, value FROM settings').all()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

/**
 * 判斷今天是否已對該 project/type/channel 組合成功發送過提醒
 * 用來防止同一天重複發送
 */
function hasBeenSentToday(projectId, reminderType, channel) {
  const today = new Date().toISOString().slice(0, 10)
  const row = getDb().prepare(`
    SELECT id FROM reminder_logs
    WHERE project_id = ? AND reminder_type = ? AND channel = ?
      AND DATE(sent_at) = ? AND success = 1
  `).get(projectId, reminderType, channel, today)
  return !!row
}

/** 寫入發送紀錄至 reminder_logs */
function logReminder(projectId, reminderType, channel, success, errorMessage = null) {
  getDb().prepare(`
    INSERT INTO reminder_logs (project_id, reminder_type, channel, sent_at, success, error_message)
    VALUES (?, ?, ?, datetime('now'), ?, ?)
  `).run(projectId, reminderType, channel, success ? 1 : 0, errorMessage)
}

// ─── 發送函式 ─────────────────────────────────────────────────────────────────

/**
 * 透過 Electron Notification 發送系統通知
 * 點擊通知後會開啟主視窗並跳轉至對應專案頁面
 *
 * @param {number|null} projectId  點擊後跳轉的專案 ID，null = 不跳轉（測試用）
 * @param {string}      title      通知標題
 * @param {string}      body       通知內容
 * @returns {{ success: boolean, error: string|null }}
 */
function sendSystemNotification(projectId, title, body) {
  if (!Notification.isSupported()) {
    return { success: false, error: '此作業系統不支援 Electron 通知' }
  }
  try {
    const notif = new Notification({ title, body, silent: false })
    notif.on('click', () => {
      const win = _getMainWindow?.()
      if (!win) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      // 傳送事件給 renderer，讓 App.jsx 導航到專案頁面
      if (projectId) win.webContents.send('navigate-to-project', projectId)
    })
    notif.show()
    return { success: true, error: null }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

/**
 * 透過 LINE Messaging API 推播訊息
 * 所有對外 HTTP 請求均在 main process 執行（非 renderer process）
 *
 * @param {string} text                                 訊息文字
 * @param {{ line_channel_token: string, line_user_id: string }} settings
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
function sendLineMessage(text, settings) {
  const token  = settings.line_channel_token
  const userId = settings.line_user_id

  if (!token || !userId) {
    return Promise.resolve({ success: false, error: 'LINE Token 或 User ID 未設定' })
  }

  return new Promise((resolve) => {
    const body = JSON.stringify({
      to:       userId,
      messages: [{ type: 'text', text }],
    })

    const options = {
      hostname: 'api.line.me',
      path:     '/v2/bot/message/push',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true, error: null })
        } else {
          resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` })
        }
      })
    })

    req.on('error', e => resolve({ success: false, error: e.message }))
    req.write(body)
    req.end()
  })
}

/**
 * 對單一專案發送雙管道提醒
 * 使用 Promise.allSettled 確保其中一個失敗不影響另一個
 *
 * @param {object} project       專案資料（含 client_name）
 * @param {string} reminderType  提醒類型：deadline_warning / deadline_final / overdue / follow_up
 * @param {string} lineText      LINE 訊息文字（含換行）
 * @param {string} notifTitle    系統通知標題
 * @param {string} notifBody     系統通知內文
 * @param {object} settings      全部設定值
 */
async function sendReminder(project, reminderType, lineText, notifTitle, notifBody, settings) {
  const enableSystem = settings.enable_system_notification !== '0'  // 預設啟用
  const enableLine   = settings.enable_line_notification   === '1'  // 預設停用

  const tasks = []

  // 系統通知管道
  if (enableSystem && !hasBeenSentToday(project.id, reminderType, 'system')) {
    tasks.push(
      Promise.resolve(sendSystemNotification(project.id, notifTitle, notifBody))
        .then(r => ({ channel: 'system', ...r }))
    )
  }

  // LINE 推播管道
  if (enableLine && !hasBeenSentToday(project.id, reminderType, 'line')) {
    tasks.push(
      sendLineMessage(lineText, settings)
        .then(r => ({ channel: 'line', ...r }))
    )
  }

  if (tasks.length === 0) return

  // 並行發送，任一失敗不影響另一
  const results = await Promise.allSettled(tasks)

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { channel, success, error } = result.value
      logReminder(project.id, reminderType, channel, success, error || null)
    } else {
      // 不應走到這裡（sendReminder 內部已 catch），僅防禦性記錄
      console.error('[ReminderService] Unexpected rejection:', result.reason)
    }
  }
}

// ─── 主檢查函式 ────────────────────────────────────────────────────────────────

/**
 * 掃描所有進行中 / 洽談中的專案，依提醒規則發送通知
 * App 啟動時執行一次，之後每小時執行一次
 */
async function checkAndSendReminders() {
  const settings  = getSettings()
  const db        = getDb()
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)

  const remindBefore      = parseInt(settings.remind_days_before)       || 3
  const remindBeforeFinal = parseInt(settings.remind_days_before_final) || 1

  // 取得所有需要追蹤的專案（含客戶名稱）
  const projects = db.prepare(`
    SELECT p.*, c.name AS client_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.status IN ('negotiating', 'in_progress')
  `).all()

  for (const p of projects) {

    // ── 截止日提醒（僅限「進行中」專案）──────────────────────────────────
    if (p.deadline && p.status === 'in_progress') {
      const deadline = new Date(p.deadline)
      deadline.setHours(0, 0, 0, 0)
      const daysLeft = Math.round((deadline - todayDate) / 86400000)

      if (daysLeft === remindBefore) {
        // 截止前 N 天提醒
        await sendReminder(
          p, 'deadline_warning',
          `⚠️ 專案提醒\n專案：${p.title}\n客戶：${p.client_name}\n截止日：${p.deadline}\n剩餘：${daysLeft} 天`,
          '⚠️ 專案截止提醒',
          `${p.title}（${p.client_name}）還有 ${daysLeft} 天到期`,
          settings,
        )
      } else if (daysLeft === remindBeforeFinal) {
        // 截止前最後 N 天提醒
        await sendReminder(
          p, 'deadline_final',
          `⚠️ 專案提醒（最後通知）\n專案：${p.title}\n客戶：${p.client_name}\n截止日：${p.deadline}\n剩餘：${daysLeft} 天`,
          '⚠️ 專案即將到期（最後通知）',
          `${p.title}（${p.client_name}）即將到期，請盡快完成`,
          settings,
        )
      } else if (daysLeft < 0) {
        // ── 逾期提醒 ────────────────────────────────────────────────
        const overdueDays = Math.abs(daysLeft)
        await sendReminder(
          p, 'overdue',
          `🔴 專案逾期\n專案：${p.title}\n客戶：${p.client_name}\n已逾期：${overdueDays} 天，請盡快處理`,
          '🔴 專案逾期',
          `${p.title}（${p.client_name}）已逾期 ${overdueDays} 天`,
          settings,
        )
      }
    }

    // ── 洽談跟催提醒（超過 7 天未更新）──────────────────────────────────
    if (p.status === 'negotiating') {
      const updatedAt = new Date(p.updated_at)
      updatedAt.setHours(0, 0, 0, 0)
      const daysSince = Math.round((todayDate - updatedAt) / 86400000)

      if (daysSince >= 7) {
        await sendReminder(
          p, 'follow_up',
          `📋 跟催提醒\n專案：${p.title}\n客戶：${p.client_name}\n已 ${daysSince} 天未更新，建議主動聯繫客戶`,
          '📋 跟催提醒',
          `${p.title}（${p.client_name}）已 ${daysSince} 天未更新`,
          settings,
        )
      }
    }
  }
}

// ─── 托盤輔助函式 ──────────────────────────────────────────────────────────────

/** 取得目前逾期未完成的專案數量（供托盤徽章使用） */
function getOverdueCount() {
  const today = new Date().toISOString().slice(0, 10)
  const row = getDb().prepare(`
    SELECT COUNT(*) AS count FROM projects
    WHERE status IN ('in_progress', 'negotiating')
      AND deadline IS NOT NULL AND deadline != ''
      AND deadline < ?
  `).get(today)
  return row?.count ?? 0
}

/** 取得今日已成功發送的提醒數量 */
function getTodaySentCount() {
  const today = new Date().toISOString().slice(0, 10)
  const row = getDb().prepare(`
    SELECT COUNT(*) AS count FROM reminder_logs
    WHERE DATE(sent_at) = ? AND success = 1
  `).get(today)
  return row?.count ?? 0
}

module.exports = {
  init,
  checkAndSendReminders,
  sendSystemNotification,
  sendLineMessage,
  getOverdueCount,
  getTodaySentCount,
  getSettings,
}
