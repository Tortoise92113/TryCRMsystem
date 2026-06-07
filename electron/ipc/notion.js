const { ipcMain } = require('electron')
const { getDb } = require('../db/database')

function registerNotionHandlers() {
  ipcMain.handle('notion:syncClients', async () => {
    const db = getDb()
    const settings = Object.fromEntries(
      db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])
    )
    const { notion_token, notion_db_id } = settings
    if (!notion_token || !notion_db_id) throw new Error('Notion credentials not configured')

    const { Client } = require('@notionhq/client')
    const notion = new Client({ auth: notion_token })

    const clients = db.prepare('SELECT * FROM clients').all()
    const results = []

    for (const client of clients) {
      try {
        const props = {
          Name: { title: [{ text: { content: client.name } }] },
          Company: { rich_text: [{ text: { content: client.company || '' } }] },
          Email: { email: client.email || null },
          Phone: { phone_number: client.phone || null },
          Notes: { rich_text: [{ text: { content: client.notes || '' } }] },
        }

        if (client.notion_id) {
          await notion.pages.update({ page_id: client.notion_id, properties: props })
          results.push({ id: client.id, action: 'updated' })
        } else {
          const page = await notion.pages.create({
            parent: { database_id: notion_db_id },
            properties: props,
          })
          db.prepare('UPDATE clients SET notion_id=? WHERE id=?').run(page.id, client.id)
          results.push({ id: client.id, action: 'created', notion_id: page.id })
        }
      } catch (err) {
        results.push({ id: client.id, action: 'error', message: err.message })
      }
    }

    return results
  })
}

module.exports = { registerNotionHandlers }
