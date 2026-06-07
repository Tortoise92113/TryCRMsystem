/**
 * Demo seed script
 * Usage: node scripts/seed.js
 *
 * Inserts demo clients, projects, and quotes into the local SQLite database.
 * Safe to run multiple times — clears existing data first (with --reset flag).
 */

const path = require('path')
const Database = require('better-sqlite3')
const fs = require('fs')
const { clients, projects, quotes } = require('../src/data/seedData')

// Resolve DB path (same location Electron uses in production)
const os = require('os')
const platform = process.platform
let userDataPath

if (platform === 'win32') {
  userDataPath = path.join(process.env.APPDATA || os.homedir(), 'freelance-crm')
} else if (platform === 'darwin') {
  userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'freelance-crm')
} else {
  userDataPath = path.join(os.homedir(), '.config', 'freelance-crm')
}

const dbPath = path.join(userDataPath, 'crm.db')

// Allow override for local dev
const devDbPath = path.join(__dirname, '..', 'dev.db')
const targetDb = fs.existsSync(devDbPath) ? devDbPath : dbPath

if (!fs.existsSync(targetDb)) {
  // Ensure directory and schema exist
  fs.mkdirSync(path.dirname(targetDb), { recursive: true })
}

console.log(`\n🗄  Database: ${targetDb}`)

const db = new Database(targetDb)

// Apply schema
const schemaPath = path.join(__dirname, '../electron/db/schema.sql')
db.exec(fs.readFileSync(schemaPath, 'utf8'))

const reset = process.argv.includes('--reset')

if (reset) {
  console.log('⚠️  --reset flag detected: clearing existing data...')
  db.exec('DELETE FROM quote_items; DELETE FROM quotes; DELETE FROM projects; DELETE FROM clients;')
}

// Check if data already exists
const existingCount = db.prepare('SELECT COUNT(*) as n FROM clients').get().n
if (existingCount > 0 && !reset) {
  console.log(`\n⚠️  Database already has ${existingCount} client(s).`)
  console.log('   Use  node scripts/seed.js --reset  to clear and re-seed.\n')
  process.exit(0)
}

// Insert clients
const insertClient = db.prepare(`
  INSERT INTO clients (name, company, email, phone, notes)
  VALUES (@name, @company, @email, @phone, @notes)
`)

const clientIds = []
const seedClients = db.transaction(() => {
  for (const c of clients) {
    const result = insertClient.run(c)
    clientIds.push(result.lastInsertRowid)
  }
})
seedClients()
console.log(`✅ Clients inserted: ${clientIds.length}`)

// Insert projects
const insertProject = db.prepare(`
  INSERT INTO projects (client_id, title, status, amount, deadline, description)
  VALUES (@client_id, @title, @status, @amount, @deadline, @description)
`)

const seedProjects = db.transaction(() => {
  for (const p of projects) {
    insertProject.run({
      client_id: clientIds[p.clientIndex],
      title: p.title,
      status: p.status,
      amount: p.amount,
      deadline: p.deadline,
      description: p.description,
    })
  }
})
seedProjects()
console.log(`✅ Projects inserted: ${projects.length}`)

// Insert quotes and their items
const insertQuote = db.prepare(`
  INSERT INTO quotes (client_id, title, issue_date, valid_days, notes, total)
  VALUES (@client_id, @title, @issue_date, @valid_days, @notes, @total)
`)
const insertItem = db.prepare(`
  INSERT INTO quote_items (quote_id, description, quantity, unit_price)
  VALUES (@quote_id, @description, @quantity, @unit_price)
`)

const seedQuotes = db.transaction(() => {
  for (const q of quotes) {
    const total = q.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const result = insertQuote.run({
      client_id: clientIds[q.clientIndex],
      title: q.title,
      issue_date: q.issue_date,
      valid_days: q.valid_days,
      notes: q.notes,
      total,
    })
    const qid = result.lastInsertRowid
    for (const item of q.items) {
      insertItem.run({ quote_id: qid, ...item })
    }
  }
})
seedQuotes()
console.log(`✅ Quotes inserted: ${quotes.length}`)

// Summary
const stats = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM clients) as clients,
    (SELECT COUNT(*) FROM projects) as projects,
    (SELECT COUNT(*) FROM quotes) as quotes,
    (SELECT COUNT(*) FROM quote_items) as items
`).get()

console.log('\n📊 Seed summary:')
console.log(`   Clients:     ${stats.clients}`)
console.log(`   Projects:    ${stats.projects}`)
console.log(`   Quotes:      ${stats.quotes}`)
console.log(`   Quote items: ${stats.items}`)
console.log('\n✨ Seed complete! Restart the app to see the data.\n')

db.close()
