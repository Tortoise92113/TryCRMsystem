const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')

let db

function getDb() {
  if (db) return db

  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'crm.db')
  const schemaPath = path.join(__dirname, 'schema.sql')

  db = new Database(dbPath)
  db.exec(fs.readFileSync(schemaPath, 'utf8'))

  // ── Migration: completed_at 欄位 ──────────────────────────────────────────
  try {
    db.exec('ALTER TABLE projects ADD COLUMN completed_at TEXT')
  } catch (_) { /* 欄位已存在，忽略 */ }

  // ── Migration: reminder_logs 資料表 ───────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS reminder_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      reminder_type TEXT NOT NULL,
      channel       TEXT NOT NULL CHECK(channel IN ('system','line')),
      sent_at       TEXT DEFAULT (datetime('now')),
      success       INTEGER NOT NULL DEFAULT 1,
      error_message TEXT
    )
  `)
  db.exec('CREATE INDEX IF NOT EXISTS idx_reminder_logs_project ON reminder_logs(project_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_reminder_logs_sent    ON reminder_logs(sent_at)')

  // ── Migration: 提醒相關 settings 預設值 ──────────────────────────────────
  const _insertSetting = db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES(?, ?)')
  for (const [k, v] of [
    ['line_channel_token',         ''],
    ['line_user_id',               ''],
    ['enable_system_notification', '1'],
    ['enable_line_notification',   '0'],
    ['remind_days_before',         '3'],
    ['remind_days_before_final',   '1'],
  ]) _insertSetting.run(k, v)

  // ── Migration: projects 款項進度、匯款日期、完成日期欄位 ─────────────────
  try { db.exec("ALTER TABLE projects ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending_estimate'") } catch (_) {}
  try { db.exec('ALTER TABLE projects ADD COLUMN remittance_date TEXT') } catch (_) {}
  try { db.exec('ALTER TABLE projects ADD COLUMN completion_date TEXT') } catch (_) {}

  // ── Migration: quotes 狀態與版本欄位 ─────────────────────────────────────
  try { db.exec('ALTER TABLE quotes ADD COLUMN version INTEGER NOT NULL DEFAULT 1') } catch (_) {}
  try { db.exec('ALTER TABLE quotes ADD COLUMN parent_quote_id INTEGER REFERENCES quotes(id)') } catch (_) {}
  try { db.exec("ALTER TABLE quotes ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'") } catch (_) {}

  // ── Migration: status_logs 狀態歷程資料表 ────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS status_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status   TEXT NOT NULL,
      note        TEXT,
      changed_at  TEXT DEFAULT (datetime('now'))
    )
  `)
  db.exec('CREATE INDEX IF NOT EXISTS idx_status_logs_quote ON status_logs(quote_id)')

  const clientCount = db.prepare('SELECT COUNT(*) as n FROM clients').get().n
  console.log(`[CRM] Database ready at: ${dbPath}`)
  console.log(`[CRM] Clients in DB: ${clientCount}`)

  if (clientCount === 0) {
    console.log('[CRM] First launch detected — seeding demo data...')
    const { seedDemo } = require('./seeder')
    seedDemo(db)
  }

  return db
}

module.exports = { getDb }
