const { ipcMain } = require('electron')
const { getDb } = require('../db/database')
const { seedDemo } = require('../db/seeder')

function registerSeedHandlers() {
  ipcMain.handle('db:reseed', () => {
    const db = getDb()
    return seedDemo(db)
  })
}

module.exports = { registerSeedHandlers }
