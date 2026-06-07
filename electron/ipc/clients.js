const { ipcMain } = require('electron')
const { getDb } = require('../db/database')

function registerClientHandlers() {
  ipcMain.handle('clients:list', (_e, search = '') => {
    const db = getDb()
    if (search.trim()) {
      return db.prepare(`
        SELECT * FROM clients
        WHERE name LIKE ? OR company LIKE ? OR email LIKE ? OR phone LIKE ?
        ORDER BY name
      `).all(...Array(4).fill(`%${search}%`))
    }
    return db.prepare('SELECT * FROM clients ORDER BY name').all()
  })

  ipcMain.handle('clients:get', (_e, id) => {
    return getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id)
  })

  ipcMain.handle('clients:create', (_e, data) => {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO clients (name, company, email, phone, notes)
      VALUES (@name, @company, @email, @phone, @notes)
    `)
    const result = stmt.run(data)
    return getDb().prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('clients:update', (_e, { id, ...data }) => {
    getDb().prepare(`
      UPDATE clients
      SET name=@name, company=@company, email=@email, phone=@phone, notes=@notes,
          updated_at=datetime('now')
      WHERE id=@id
    `).run({ ...data, id })
    return getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id)
  })

  ipcMain.handle('clients:delete', (_e, id) => {
    getDb().prepare('DELETE FROM clients WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('clients:projectCounts', () => {
    const rows = getDb().prepare(
      'SELECT client_id, COUNT(*) as count FROM projects GROUP BY client_id'
    ).all()
    return Object.fromEntries(rows.map(r => [r.client_id, r.count]))
  })
}

module.exports = { registerClientHandlers }
