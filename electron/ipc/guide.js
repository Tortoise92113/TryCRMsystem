const { ipcMain, BrowserWindow, shell, app } = require('electron')
const path = require('path')
const fs = require('fs')

const PDF_CACHE = path.join(app.getPath('userData'), 'NOTION_SETUP.pdf')

function getMdPath() {
  const isDev = process.env.NODE_ENV !== 'production'
  if (isDev) return path.join(__dirname, '../../NOTION_SETUP.md')
  return path.join(process.resourcesPath, 'NOTION_SETUP.md')
}

async function buildHtml(mdContent) {
  const { marked } = await import('marked')
  const body = marked(mdContent)
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    padding: 48px 56px;
    max-width: 860px;
    margin: 0 auto;
    line-height: 1.75;
    color: #1a1a1a;
    font-size: 14px;
  }
  h1 {
    font-size: 24px;
    color: #111;
    border-bottom: 2px solid #6366f1;
    padding-bottom: 10px;
    margin-bottom: 24px;
  }
  h2 {
    font-size: 18px;
    color: #1e1e2e;
    margin-top: 36px;
    margin-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 6px;
  }
  h3 { font-size: 15px; color: #374151; margin-top: 20px; margin-bottom: 8px; }
  p { margin-bottom: 12px; }
  ul, ol { padding-left: 22px; margin-bottom: 12px; }
  li { margin-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 13px; }
  th { background: #f3f4f6; font-weight: 600; text-align: left; }
  td, th { border: 1px solid #d1d5db; padding: 8px 12px; }
  tr:nth-child(even) { background: #fafafa; }
  code {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: 'SF Mono', Consolas, 'Courier New', monospace;
  }
  pre {
    background: #f3f4f6;
    padding: 14px 16px;
    border-radius: 6px;
    overflow-x: auto;
    margin-bottom: 14px;
  }
  pre code { background: none; padding: 0; font-size: 12px; }
  blockquote {
    border-left: 3px solid #6366f1;
    padding: 8px 14px;
    background: #f5f5ff;
    color: #555;
    border-radius: 0 4px 4px 0;
    margin-bottom: 14px;
  }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  a { color: #6366f1; }
</style>
</head>
<body>${body}</body>
</html>`
}

async function generatePdf() {
  const mdPath = getMdPath()
  if (!fs.existsSync(mdPath)) throw new Error(`找不到說明文件：${mdPath}`)

  const mdContent = fs.readFileSync(mdPath, 'utf8')
  const html = await buildHtml(mdContent)

  const tmpHtml = path.join(app.getPath('temp'), 'crm_notion_guide.html')
  fs.writeFileSync(tmpHtml, html, 'utf8')

  const win = new BrowserWindow({
    show: false,
    width: 1000,
    height: 1400,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  await win.loadFile(tmpHtml)
  await new Promise(r => setTimeout(r, 600))

  const pdfBuffer = await win.webContents.printToPDF({
    marginsType: 0,
    printBackground: true,
    pageSize: 'A4',
    landscape: false,
  })

  win.destroy()
  try { fs.unlinkSync(tmpHtml) } catch {}

  fs.writeFileSync(PDF_CACHE, pdfBuffer)
  console.log(`[CRM] PDF generated: ${PDF_CACHE}`)
  return PDF_CACHE
}

function registerGuideHandlers() {
  ipcMain.handle('app:openNotionGuide', async () => {
    try {
      if (fs.existsSync(PDF_CACHE)) {
        await shell.openPath(PDF_CACHE)
        return { success: true, cached: true }
      }
      const pdfPath = await generatePdf()
      await shell.openPath(pdfPath)
      return { success: true, cached: false }
    } catch (err) {
      console.error('[CRM] Guide error:', err.message)
      throw err
    }
  })

  ipcMain.handle('app:regenerateGuide', async () => {
    try {
      if (fs.existsSync(PDF_CACHE)) fs.unlinkSync(PDF_CACHE)
      const pdfPath = await generatePdf()
      await shell.openPath(pdfPath)
      return { success: true }
    } catch (err) {
      console.error('[CRM] Guide regenerate error:', err.message)
      throw err
    }
  })
}

module.exports = { registerGuideHandlers }
