/**
 * 提醒功能 IPC 處理器
 * 所有對外 API 請求（LINE 驗證、LINE 推播）均在此 main process 端執行，
 * 不允許從 renderer process 直接呼叫外部 API。
 */
const { ipcMain, shell } = require('electron')
const https = require('https')
const { getDb } = require('../db/database')
const {
  checkAndSendReminders,
  sendSystemNotification,
  sendLineMessage,
  getSettings,
  getTodaySentCount,
  getOverdueCount,
} = require('../services/reminderService')

function registerReminderHandlers() {

  /** 手動觸發提醒檢查（供設定頁「立即檢查」按鈕或托盤右鍵使用） */
  ipcMain.handle('reminders:check', async () => {
    await checkAndSendReminders()
    return { success: true }
  })

  /** 取得近期發送紀錄，預設最近 20 筆 */
  ipcMain.handle('reminders:getLogs', (_e, limit = 20) => {
    return getDb().prepare(`
      SELECT rl.*,
             p.title AS project_title,
             c.name  AS client_name
      FROM reminder_logs rl
      LEFT JOIN projects p ON p.id = rl.project_id
      LEFT JOIN clients  c ON c.id = p.client_id
      ORDER BY rl.sent_at DESC
      LIMIT ?
    `).all(limit)
  })

  /**
   * 測試發送：依目前 DB 設定同時觸發系統通知與 LINE 推播
   * 使用者應先儲存設定再點擊測試按鈕
   */
  ipcMain.handle('reminders:test', async () => {
    const settings = getSettings()
    const results  = {}
    const tasks    = []

    // 系統通知測試
    if (settings.enable_system_notification !== '0') {
      tasks.push(
        Promise.resolve(sendSystemNotification(
          null,
          '✅ 測試通知',
          'Freelance CRM 提醒系統連線正常',
        )).then(r => { results.system = r })
      )
    }

    // LINE 推播測試
    if (settings.enable_line_notification === '1') {
      tasks.push(
        sendLineMessage('✅ 測試訊息\nFreelance CRM 提醒系統連線正常', settings)
          .then(r => { results.line = r })
      )
    }

    // 並行執行，失敗不影響另一管道
    await Promise.allSettled(tasks)
    return results
  })

  /**
   * 驗證 LINE Channel Access Token 是否有效
   * 呼叫 /v2/bot/info 確認 Token 及 Bot 狀態
   */
  ipcMain.handle('reminders:verifyLineToken', (_e, token) => {
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.line.me',
        path:     '/v2/bot/info',
        method:   'GET',
        headers:  { Authorization: `Bearer ${token}` },
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const info = JSON.parse(data)
              resolve({ success: true, botName: info.displayName || 'Bot' })
            } catch {
              resolve({ success: true, botName: 'Bot' })
            }
          } else {
            resolve({ success: false, error: `HTTP ${res.statusCode}：Token 無效或已過期` })
          }
        })
      })

      req.on('error', e => resolve({ success: false, error: e.message }))
      req.end()
    })
  })

  /** 在預設瀏覽器開啟 LINE Developers Console */
  ipcMain.handle('reminders:openLineDev', () => {
    shell.openExternal('https://developers.line.biz/')
  })

  /** 取得今日提醒摘要（供托盤選單顯示） */
  ipcMain.handle('reminders:todaySummary', () => ({
    sentCount:    getTodaySentCount(),
    overdueCount: getOverdueCount(),
  }))
}

module.exports = { registerReminderHandlers }
