const { ipcMain } = require('electron')
const { getDb } = require('../db/database')

function registerSheetsHandlers() {
  ipcMain.handle('sheets:exportIncome', async () => {
    const db = getDb()
    const settings = Object.fromEntries(
      db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])
    )
    const { sheets_id, sheets_credentials } = settings
    if (!sheets_id || !sheets_credentials) throw new Error('Google Sheets credentials not configured')

    const { google } = require('googleapis')
    const creds = JSON.parse(sheets_credentials)
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    const sheets = google.sheets({ version: 'v4', auth })

    const projects = db.prepare(`
      SELECT p.title, p.amount, p.status, p.deadline, c.name as client_name
      FROM projects p JOIN clients c ON c.id = p.client_id
      ORDER BY p.updated_at DESC
    `).all()

    const header = [['Client', 'Project', 'Amount', 'Status', 'Deadline']]
    const rows = projects.map(p => [p.client_name, p.title, p.amount, p.status, p.deadline || ''])

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheets_id,
      range: 'Income!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [...header, ...rows] },
    })

    return { exported: rows.length }
  })

  ipcMain.handle('sheets:exportQuotes', async () => {
    const db = getDb()
    const settings = Object.fromEntries(
      db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])
    )
    const { sheets_id, sheets_credentials } = settings
    if (!sheets_id || !sheets_credentials) throw new Error('Google Sheets credentials not configured')

    const { google } = require('googleapis')
    const creds = JSON.parse(sheets_credentials)
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    const sheets = google.sheets({ version: 'v4', auth })

    const quotes = db.prepare(`
      SELECT q.title, q.total, q.issue_date, c.name as client_name
      FROM quotes q LEFT JOIN clients c ON c.id = q.client_id
      ORDER BY q.issue_date DESC
    `).all()

    const header = [['Client', 'Quote Title', 'Total', 'Issue Date']]
    const rows = quotes.map(q => [q.client_name || '', q.title, q.total, q.issue_date])

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheets_id,
      range: 'Quotes!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [...header, ...rows] },
    })

    return { exported: rows.length }
  })
}

module.exports = { registerSheetsHandlers }
