const { ipcMain } = require('electron')
const { getDb } = require('../db/database')

// 向上追溯版本鏈至根節點，回傳根節點 ID
function findRootId(db, quoteId) {
  let cur = db.prepare('SELECT id, parent_quote_id FROM quotes WHERE id = ?').get(quoteId)
  while (cur && cur.parent_quote_id) {
    cur = db.prepare('SELECT id, parent_quote_id FROM quotes WHERE id = ?').get(cur.parent_quote_id)
  }
  return cur ? cur.id : quoteId
}

// BFS 取得版本鏈所有節點（由舊至新排序）
function getAllVersions(db, quoteId) {
  const rootId = findRootId(db, quoteId)
  const all = []
  const queue = [rootId]
  const visited = new Set()
  while (queue.length) {
    const id = queue.shift()
    if (visited.has(id)) continue
    visited.add(id)
    const q = db.prepare(`
      SELECT q.id, q.version, q.status, q.title, q.total, q.parent_quote_id, q.issue_date,
             c.name as client_name
      FROM quotes q
      LEFT JOIN clients c ON c.id = q.client_id
      WHERE q.id = ?
    `).get(id)
    if (q) {
      all.push(q)
      const children = db.prepare('SELECT id FROM quotes WHERE parent_quote_id = ?').all(id)
      for (const c of children) queue.push(c.id)
    }
  }
  return all.sort((a, b) => a.version - b.version)
}

function registerQuoteHandlers() {
  ipcMain.handle('quotes:list', () => {
    return getDb().prepare(`
      SELECT q.*, c.name as client_name FROM quotes q
      LEFT JOIN clients c ON c.id = q.client_id
      ORDER BY q.created_at DESC
    `).all()
  })

  ipcMain.handle('quotes:get', (_e, id) => {
    const db = getDb()
    const quote = db.prepare(`
      SELECT q.*, c.name as client_name FROM quotes q
      LEFT JOIN clients c ON c.id = q.client_id WHERE q.id = ?
    `).get(id)
    if (!quote) return null
    quote.items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY id').all(id)
    return quote
  })

  ipcMain.handle('quotes:create', (_e, { items, ...data }) => {
    const db = getDb()
    const total = (items || []).reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const result = db.prepare(`
      INSERT INTO quotes (client_id, title, issue_date, valid_days, notes, total, version, status)
      VALUES (@client_id, @title, @issue_date, @valid_days, @notes, @total, 1, 'draft')
    `).run({ ...data, total })

    const qid = result.lastInsertRowid
    const insertItem = db.prepare(`
      INSERT INTO quote_items (quote_id, description, quantity, unit_price) VALUES (?, ?, ?, ?)
    `)
    db.transaction((rows) => {
      for (const row of rows) insertItem.run(qid, row.description, row.quantity, row.unit_price)
    })(items || [])

    // 建立初始狀態記錄
    db.prepare(`
      INSERT INTO status_logs (quote_id, from_status, to_status, note) VALUES (?, NULL, 'draft', '建立報價單')
    `).run(qid)

    return db.prepare('SELECT * FROM quotes WHERE id = ?').get(qid)
  })

  ipcMain.handle('quotes:update', (_e, { id, items, ...data }) => {
    const db = getDb()
    // 僅草稿狀態可編輯
    const existing = db.prepare('SELECT status FROM quotes WHERE id = ?').get(id)
    if (existing && existing.status !== 'draft') throw new Error('只有草稿狀態的報價單可以編輯')

    const total = (items || []).reduce((s, i) => s + i.quantity * i.unit_price, 0)
    db.prepare(`
      UPDATE quotes
      SET client_id=@client_id, title=@title, issue_date=@issue_date,
          valid_days=@valid_days, notes=@notes, total=@total, updated_at=datetime('now')
      WHERE id=@id
    `).run({ ...data, total, id })

    db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(id)
    const insertItem = db.prepare(`
      INSERT INTO quote_items (quote_id, description, quantity, unit_price) VALUES (?, ?, ?, ?)
    `)
    db.transaction((rows) => {
      for (const row of rows) insertItem.run(id, row.description, row.quantity, row.unit_price)
    })(items || [])

    return db.prepare('SELECT * FROM quotes WHERE id = ?').get(id)
  })

  ipcMain.handle('quotes:delete', (_e, id) => {
    getDb().prepare('DELETE FROM quotes WHERE id = ?').run(id)
    return { success: true }
  })

  // 取得報價單的完整狀態歷程
  ipcMain.handle('quotes:statusLogs', (_e, id) => {
    return getDb().prepare(`
      SELECT * FROM status_logs WHERE quote_id = ? ORDER BY changed_at ASC
    `).all(id)
  })

  // 變更狀態並寫入歷程紀錄
  ipcMain.handle('quotes:updateStatus', (_e, { id, toStatus, note }) => {
    const db = getDb()
    const quote = db.prepare('SELECT status FROM quotes WHERE id = ?').get(id)
    if (!quote) throw new Error('找不到報價單')

    db.prepare(`UPDATE quotes SET status=@status, updated_at=datetime('now') WHERE id=@id`)
      .run({ status: toStatus, id })
    db.prepare(`
      INSERT INTO status_logs (quote_id, from_status, to_status, note) VALUES (?, ?, ?, ?)
    `).run(id, quote.status, toStatus, note || null)

    return db.prepare('SELECT * FROM quotes WHERE id = ?').get(id)
  })

  // 取得同版本鏈所有版本（由舊至新）
  ipcMain.handle('quotes:versions', (_e, id) => {
    return getAllVersions(getDb(), id)
  })

  // 另存新版：複製當前報價單為草稿，版本號 +1
  ipcMain.handle('quotes:saveAsNewVersion', (_e, id) => {
    const db = getDb()
    const allVer = getAllVersions(db, id)
    const maxVersion = Math.max(...allVer.map(v => v.version))

    const src = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id)
    if (!src) throw new Error('找不到報價單')
    const srcItems = db.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY id').all(id)

    const result = db.prepare(`
      INSERT INTO quotes (client_id, title, issue_date, valid_days, notes, total, version, parent_quote_id, status)
      VALUES (@client_id, @title, @issue_date, @valid_days, @notes, @total, @version, @parent_quote_id, 'draft')
    `).run({
      client_id:       src.client_id,
      title:           src.title,
      issue_date:      new Date().toISOString().slice(0, 10),
      valid_days:      src.valid_days,
      notes:           src.notes,
      total:           src.total,
      version:         maxVersion + 1,
      parent_quote_id: id,
    })

    const newId = result.lastInsertRowid
    const insertItem = db.prepare(`
      INSERT INTO quote_items (quote_id, description, quantity, unit_price) VALUES (?, ?, ?, ?)
    `)
    for (const item of srcItems) {
      insertItem.run(newId, item.description, item.quantity, item.unit_price)
    }

    db.prepare(`
      INSERT INTO status_logs (quote_id, from_status, to_status, note) VALUES (?, NULL, 'draft', ?)
    `).run(newId, `從 v${src.version} 另存新版`)

    return db.prepare('SELECT * FROM quotes WHERE id = ?').get(newId)
  })
}

module.exports = { registerQuoteHandlers }
