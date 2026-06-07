const { ipcMain } = require('electron')
const { getDb } = require('../db/database')

function registerProjectHandlers() {
  ipcMain.handle('projects:list', (_e, clientId) => {
    return getDb().prepare(`
      SELECT p.*, c.name as client_name FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE (@clientId IS NULL OR p.client_id = @clientId)
      ORDER BY p.created_at DESC
    `).all({ clientId: clientId || null })
  })

  ipcMain.handle('projects:get', (_e, id) => {
    return getDb().prepare(`
      SELECT p.*, c.name as client_name FROM projects p
      JOIN clients c ON c.id = p.client_id WHERE p.id = ?
    `).get(id)
  })

  ipcMain.handle('projects:create', (_e, data) => {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO projects (client_id, title, status, amount, deadline, description,
                            payment_status, remittance_date, completion_date)
      VALUES (@client_id, @title, @status, @amount, @deadline, @description,
              @payment_status, @remittance_date, @completion_date)
    `).run(data)
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('projects:update', (_e, { id, ...data }) => {
    const db = getDb()
    const prev = db.prepare('SELECT status, completed_at FROM projects WHERE id = ?').get(id)
    if (!prev) return null

    let completedAt = prev.completed_at ?? null
    if (data.status === 'completed' && !completedAt) {
      const t = new Date()
      completedAt = data.completion_date ||
        `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`
    } else if (data.status !== 'completed') {
      completedAt = null
    }

    db.prepare(`
      UPDATE projects
      SET client_id=@client_id, title=@title, status=@status, amount=@amount,
          deadline=@deadline, description=@description,
          payment_status=@payment_status, remittance_date=@remittance_date,
          completion_date=@completion_date,
          completed_at=@completed_at, updated_at=datetime('now', 'localtime')
      WHERE id=@id
    `).run({ ...data, id, completed_at: completedAt })
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  })

  ipcMain.handle('projects:delete', (_e, id) => {
    getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('projects:dashboard', () => {
    const db = getDb()
    const now = new Date()
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // 本月收入：已完成 + 已收款 + 匯款日期在本月
    const monthlyIncome = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM projects
      WHERE status = 'completed'
        AND payment_status = 'paid'
        AND remittance_date IS NOT NULL
        AND remittance_date != ''
        AND strftime('%Y-%m', remittance_date) = ?
    `).get(currentYM)

    const inProgress = db.prepare(`
      SELECT COUNT(*) as count FROM projects WHERE status = 'in_progress'
    `).get()

    const completionStats = db.prepare(`
      SELECT status, COUNT(*) as count FROM projects GROUP BY status
    `).all()

    // 收入趨勢：同樣以匯款日期為準
    const monthlyTrend = db.prepare(`
      SELECT strftime('%Y-%m', remittance_date) as month,
             SUM(amount) as total
      FROM projects
      WHERE status = 'completed'
        AND payment_status = 'paid'
        AND remittance_date IS NOT NULL
        AND remittance_date != ''
      GROUP BY month ORDER BY month DESC LIMIT 6
    `).all()

    return { monthlyIncome, inProgress, completionStats, monthlyTrend }
  })
}

module.exports = { registerProjectHandlers }
