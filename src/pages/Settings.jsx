import { useState, useEffect, useCallback } from 'react'
import {
  Save, RefreshCw, Upload, CheckCircle2, BookOpen, Database, AlertTriangle,
  Bell, MessageSquare, Send, ExternalLink, XCircle, Clock, RotateCcw,
} from 'lucide-react'
import { useI18n } from '../context/I18nContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ─── 小元件 ──────────────────────────────────────────────────────────────────

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** 開關切換按鈕（Toggle Switch） */
function Toggle({ enabled, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
        'transition-colors focus-visible:outline-none',
        enabled ? 'bg-indigo-500' : 'bg-zinc-200 dark:bg-zinc-700',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-3.5 w-3.5 rounded-full',
          'bg-white shadow-sm transition-transform',
          enabled ? 'translate-x-[18px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

/** 提醒類型文字對照 */
const REMINDER_TYPE_LABELS = {
  deadline_warning: '截止前提醒',
  deadline_final:   '截止前最後提醒',
  overdue:          '逾期提醒',
  follow_up:        '跟催提醒',
}

/** 管道圖示 */
function ChannelBadge({ channel }) {
  return channel === 'line'
    ? <span className="text-[10px] font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded">LINE</span>
    : <span className="text-[10px] font-medium bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">系統</span>
}

// ─── 主元件 ──────────────────────────────────────────────────────────────────

export function Settings() {
  const { t, lang, changeLang } = useI18n()

  // 設定表單狀態（包含新增的提醒相關欄位）
  const [form, setForm] = useState({
    notion_token: '', notion_db_id: '', sheets_id: '', sheets_credentials: '',
    line_channel_token: '', line_user_id: '',
    enable_system_notification: '1',
    enable_line_notification:   '0',
    remind_days_before:         '3',
    remind_days_before_final:   '1',
  })

  // 全域狀態訊息（儲存/同步/匯出 等操作結果）
  const [status, setStatus] = useState({ msg: '', type: 'idle' })

  // Demo 資料重置對話框
  const [reseedConfirmOpen, setReseedConfirmOpen] = useState(false)
  const [reseeding, setReseeding]                 = useState(false)

  // LINE Token 驗證狀態
  const [lineVerify, setLineVerify] = useState({ type: 'idle', msg: '' })
  const [verifying,  setVerifying]  = useState(false)

  // 測試發送狀態
  const [testResult, setTestResult] = useState(null)
  const [testing,    setTesting]    = useState(false)

  // 近期發送紀錄
  const [logs,     setLogs]     = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // ── 初始化 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    window.api.settings.getAll().then(s => setForm(prev => ({ ...prev, ...s })))
  }, [])

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const data = await window.api.reminders.getLogs(20)
      setLogs(data)
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  useEffect(() => { loadLogs() }, [])

  // ── 工具函式 ──────────────────────────────────────────────────────────────

  /** 回傳 Input value/onChange props */
  function f(key) {
    return {
      value:    form[key] || '',
      onChange: e => setForm(prev => ({ ...prev, [key]: e.target.value })),
    }
  }

  function isEnabled(key) { return form[key] !== '0' }
  function setEnabled(key, val) { setForm(prev => ({ ...prev, [key]: val ? '1' : '0' })) }

  function flash(msg, type = 'success') {
    setStatus({ msg, type })
    setTimeout(() => setStatus({ msg: '', type: 'idle' }), 3500)
  }

  const lineEnabled = form.enable_line_notification === '1'

  // ── 操作函式 ──────────────────────────────────────────────────────────────

  async function saveSettings() {
    await window.api.settings.setMany(form)
    flash(t('settings.saved'))
  }

  async function syncNotion() {
    flash(t('settings.syncing'), 'loading')
    try {
      const results = await window.api.notion.syncClients()
      flash(`${t('settings.syncDone')} (${results.length})`)
    } catch (err) { flash(`Error: ${err.message}`, 'error') }
  }

  async function exportSheets(type) {
    flash(t('settings.exporting'), 'loading')
    try {
      const fn  = type === 'income' ? window.api.sheets.exportIncome : window.api.sheets.exportQuotes
      const res = await fn()
      flash(`${t('settings.exportDone')} (${res.exported})`)
    } catch (err) { flash(`Error: ${err.message}`, 'error') }
  }

  async function openGuide() {
    flash('正在開啟教學手冊...', 'loading')
    try {
      await window.api.guide.open()
      flash('已用系統 PDF 閱讀器開啟')
    } catch (err) { flash(`Error: ${err.message}`, 'error') }
  }

  async function handleReseed() {
    setReseeding(true)
    try {
      const stats = await window.api.db.reseed()
      setReseedConfirmOpen(false)
      flash(`Demo 資料已載入 — ${stats.clients} 客戶 / ${stats.projects} 專案 / ${stats.quotes} 報價單`)
    } catch (err) {
      flash(`Error: ${err.message}`, 'error')
    } finally { setReseeding(false) }
  }

  /** 驗證 LINE Token 有效性 */
  async function verifyLineToken() {
    const token = form.line_channel_token?.trim()
    if (!token) { setLineVerify({ type: 'error', msg: '請先輸入 Channel Access Token' }); return }
    setVerifying(true)
    setLineVerify({ type: 'loading', msg: '驗證中...' })
    try {
      const result = await window.api.reminders.verifyLineToken(token)
      if (result.success) {
        setLineVerify({ type: 'success', msg: `驗證成功 — Bot 名稱：${result.botName}` })
      } else {
        setLineVerify({ type: 'error', msg: result.error || '驗證失敗' })
      }
    } catch (e) {
      setLineVerify({ type: 'error', msg: e.message })
    } finally { setVerifying(false) }
  }

  /** 測試發送（系統通知 + LINE，使用 DB 中的設定） */
  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      // 先儲存再測試，確保 DB 為最新值
      await window.api.settings.setMany(form)
      const result = await window.api.reminders.test()
      setTestResult(result)
      loadLogs() // 重新整理紀錄
    } catch (e) {
      flash(`Error: ${e.message}`, 'error')
    } finally { setTesting(false) }
  }

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl">
      {/* 頁首 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[30px] font-bold text-foreground">{t('settings.title')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">API 金鑰、整合設定與提醒通知</p>
        </div>
        {status.msg && (
          <span className={cn(
            'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-all',
            status.type === 'error'   ? 'bg-destructive/10 text-destructive'   :
            status.type === 'loading' ? 'bg-muted text-muted-foreground'       :
                                        'bg-emerald-50 text-emerald-700',
          )}>
            {status.type === 'success' && <CheckCircle2 className="h-3 w-3" />}
            {status.msg}
          </span>
        )}
      </div>

      <div className="space-y-3">

        {/* ── 語言設定 ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>{t('settings.language')}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {['zh-TW', 'en'].map(l => (
                <button
                  key={l}
                  onClick={() => changeLang(l)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    lang === l
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
                  )}
                >
                  {l === 'zh-TW' ? '繁體中文' : 'English'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Demo 資料 ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Demo 資料</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              載入假資料以體驗完整功能（6 位客戶、9 個專案、3 張報價單）。<br />
              <span className="text-destructive/80">⚠ 此操作會清除所有現有資料。</span>
            </p>
            <Button variant="outline" size="sm" onClick={() => setReseedConfirmOpen(true)}>
              <Database className="h-3.5 w-3.5" /> 載入 Demo 資料
            </Button>
          </CardContent>
        </Card>

        {/* ── 提醒通知設定 ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-indigo-500" />
              {t('settings.reminders')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* 系統通知開關 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">{t('settings.enableSystemNotification')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">App 視窗關閉後仍可收到桌面通知</p>
              </div>
              <Toggle
                enabled={isEnabled('enable_system_notification')}
                onChange={val => setEnabled('enable_system_notification', val)}
              />
            </div>

            <div className="h-px bg-border/60" />

            {/* LINE 推播開關 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 text-green-600" />
                  {t('settings.enableLineNotification')}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">設定 Token 後才可啟用</p>
              </div>
              <Toggle
                enabled={lineEnabled}
                onChange={val => setEnabled('enable_line_notification', val)}
              />
            </div>

            {/* LINE 設定區（開關關閉時灰化） */}
            <div className={cn(
              'space-y-3 rounded-lg border border-border/60 p-3 transition-opacity',
              !lineEnabled && 'opacity-40 pointer-events-none',
            )}>
              <Field
                label={t('settings.lineChannelToken')}
                hint="格式：Bearer 後的長字串，從 LINE Developers Console 取得"
              >
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Channel Access Token"
                    className="flex-1"
                    {...f('line_channel_token')}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={verifyLineToken}
                    disabled={verifying}
                    className="shrink-0"
                  >
                    {verifying ? <Clock className="h-3.5 w-3.5 animate-spin" /> : '驗證'}
                  </Button>
                </div>
                {/* Token 驗證結果 */}
                {lineVerify.type !== 'idle' && (
                  <p className={cn(
                    'text-[11px] flex items-center gap-1 mt-1',
                    lineVerify.type === 'success' ? 'text-emerald-600' :
                    lineVerify.type === 'error'   ? 'text-destructive'  :
                                                    'text-muted-foreground',
                  )}>
                    {lineVerify.type === 'success' && <CheckCircle2 className="h-3 w-3" />}
                    {lineVerify.type === 'error'   && <XCircle      className="h-3 w-3" />}
                    {lineVerify.type === 'loading' && <Clock        className="h-3 w-3 animate-spin" />}
                    {lineVerify.msg}
                  </p>
                )}
              </Field>

              <Field
                label={t('settings.lineUserId')}
                hint="請透過 LINE Bot 傳送任意訊息後，從 Webhook 或開發者工具取得您的 User ID（格式：U + 32 碼英數字）"
              >
                <Input placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...f('line_user_id')} />
              </Field>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => window.api.reminders.openLineDev()}
              >
                <ExternalLink className="h-3 w-3" />
                前往 LINE Developers Console
              </Button>
            </div>

            <div className="h-px bg-border/60" />

            {/* 自訂提醒天數 */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('settings.remindDaysBefore')} hint="截止日前幾天發第一次提醒">
                <Input
                  type="number"
                  min="1"
                  max="30"
                  {...f('remind_days_before')}
                />
              </Field>
              <Field label={t('settings.remindDaysBeforeFinal')} hint="截止日前幾天發最後一次提醒">
                <Input
                  type="number"
                  min="1"
                  max="30"
                  {...f('remind_days_before_final')}
                />
              </Field>
            </div>

            <div className="h-px bg-border/60" />

            {/* 立即測試發送 */}
            <div>
              <p className="text-[11px] text-muted-foreground mb-2">
                點擊後會先自動儲存設定，再同時觸發已啟用的通知管道
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing}
                >
                  {testing
                    ? <><Clock className="h-3.5 w-3.5 animate-spin" /> 發送中...</>
                    : <><Send  className="h-3.5 w-3.5" /> {t('settings.testSend')}</>
                  }
                </Button>
                {testResult && (
                  <span className="text-[11px] text-muted-foreground">
                    {[
                      testResult.system && `系統：${testResult.system.success ? '✅' : '❌ ' + testResult.system.error}`,
                      testResult.line   && `LINE：${testResult.line.success   ? '✅' : '❌ ' + testResult.line.error}`,
                    ].filter(Boolean).join('　')}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Notion 整合 ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('settings.notion')}</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={openGuide}>
                <BookOpen className="h-3.5 w-3.5" /> 查看整合教學
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label={t('settings.notionToken')} hint="格式：secret_xxxxxxxx...">
              <Input type="password" placeholder="secret_..." {...f('notion_token')} />
            </Field>
            <Field label={t('settings.notionDbId')} hint="從 Notion 資料庫網址取得 32 碼 ID">
              <Input placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...f('notion_db_id')} />
            </Field>
            <Button variant="outline" size="sm" onClick={syncNotion}>
              <RefreshCw className="h-3.5 w-3.5" /> {t('settings.syncClients')}
            </Button>
          </CardContent>
        </Card>

        {/* ── Google Sheets 整合 ────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>{t('settings.sheets')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label={t('settings.sheetsId')} hint="Google Sheets 網址中的試算表 ID">
              <Input placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" {...f('sheets_id')} />
            </Field>
            <Field label={t('settings.sheetsCredentials')} hint="Service Account 的 JSON 金鑰內容">
              <Textarea
                rows={5}
                className="font-mono text-xs"
                placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
                {...f('sheets_credentials')}
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportSheets('income')}>
                <Upload className="h-3.5 w-3.5" /> {t('settings.exportIncome')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportSheets('quotes')}>
                <Upload className="h-3.5 w-3.5" /> {t('settings.exportQuotes')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 儲存按鈕 */}
        <Button onClick={saveSettings} className="w-full sm:w-auto">
          <Save className="h-3.5 w-3.5" /> {t('settings.save')}
        </Button>

        {/* ── 近期發送紀錄 ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('settings.recentLogs')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={loadLogs}
                disabled={loadingLogs}
              >
                <RotateCcw className={cn('h-3 w-3', loadingLogs && 'animate-spin')} />
                重新整理
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">尚無發送紀錄</p>
            ) : (
              <div className="space-y-1.5">
                {logs.map(log => (
                  <div
                    key={log.id}
                    className="flex items-center gap-2 text-xs py-1.5 border-b border-border/40 last:border-0"
                  >
                    {/* 成功/失敗圖示 */}
                    {log.success
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      : <XCircle      className="h-3.5 w-3.5 text-destructive shrink-0" />
                    }

                    {/* 管道標籤 */}
                    <ChannelBadge channel={log.channel} />

                    {/* 提醒類型 */}
                    <span className="text-muted-foreground shrink-0">
                      {REMINDER_TYPE_LABELS[log.reminder_type] || log.reminder_type}
                    </span>

                    {/* 專案 / 客戶 */}
                    <span className="flex-1 truncate font-medium">
                      {log.project_title || '（已刪除）'}
                      {log.client_name && (
                        <span className="text-muted-foreground font-normal"> · {log.client_name}</span>
                      )}
                    </span>

                    {/* 時間 */}
                    <span className="text-muted-foreground shrink-0">
                      {log.sent_at?.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 失敗紀錄的錯誤訊息展開（顯示第一筆失敗的 error_message） */}
            {logs.some(l => !l.success && l.error_message) && (
              <details className="mt-2">
                <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                  查看失敗原因
                </summary>
                <div className="mt-1 space-y-1">
                  {logs.filter(l => !l.success && l.error_message).map(l => (
                    <p key={l.id} className="text-[11px] text-destructive font-mono bg-destructive/5 px-2 py-1 rounded">
                      [{l.channel}] {l.error_message}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Demo 資料確認對話框 ────────────────────────────────────────── */}
      <Dialog open={reseedConfirmOpen} onOpenChange={v => { if (!v) setReseedConfirmOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> 載入 Demo 資料
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              這會<strong className="text-foreground">清除所有現有資料</strong>，並匯入以下 Demo 資料：
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground ml-4 list-disc">
              <li>6 位客戶（室內設計、數位行銷、出版、建設、醫美）</li>
              <li>9 個專案（洽談中 × 2、進行中 × 2、已完成 × 3、已取消 × 2）</li>
              <li>3 張報價單（含完整報價項目）</li>
            </ul>
            <p className="mt-3 text-xs text-destructive">此操作無法復原。</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReseedConfirmOpen(false)}>取消</Button>
            <Button variant="destructive" size="sm" onClick={handleReseed} disabled={reseeding}>
              <Database className="h-3.5 w-3.5" />
              {reseeding ? '載入中...' : '確認載入'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
