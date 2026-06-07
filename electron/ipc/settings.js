const { ipcMain } = require('electron')
const { getDb } = require('../db/database')

function registerSettingsHandlers() {
  ipcMain.handle('settings:getAll', () => {
    const rows = getDb().prepare('SELECT key, value FROM settings').all()
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })

  ipcMain.handle('settings:set', (_e, key, value) => {
    getDb().prepare(`
      INSERT INTO settings(key, value, updated_at) VALUES(?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run(key, value)
    return { success: true }
  })

  ipcMain.handle('settings:setMany', (_e, obj) => {
    const db = getDb()
    const upsert = db.prepare(`
      INSERT INTO settings(key, value, updated_at) VALUES(?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `)
    const tx = db.transaction((entries) => {
      for (const [k, v] of entries) upsert.run(k, v)
    })
    tx(Object.entries(obj))
    return { success: true }
  })
}

module.exports = { registerSettingsHandlers }
