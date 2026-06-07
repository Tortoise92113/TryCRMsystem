import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, GitBranch, Clock, Copy, Pencil, X, Plus, Download } from 'lucide-react'
import { useI18n } from '../context/I18nContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── 狀態設定 ────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  draft:    { label: '草稿',   cls: 'bg-zinc-700/80 text-zinc-200',       dotCls: 'border-zinc-400 bg-zinc-400/20' },
  sent:     { label: '已寄出', cls: 'bg-indigo-600/70 text-indigo-100',   dotCls: 'border-indigo-400 bg-indigo-400/20' },
  accepted: { label: '已接受', cls: 'bg-emerald-600/70 text-emerald-100', dotCls: 'border-emerald-400 bg-emerald-400/20' },
  rejected: { label: '已拒絕', cls: 'bg-red-600/70 text-red-100',         dotCls: 'border-red-400 bg-red-400/20' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.draft
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium', cfg.cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

// 依當前狀態決定可執行的操作
const STATUS_ACTIONS = {
  draft:    [{ toStatus: 'sent',     label: '標記為已寄出', variant: 'default',     confirm: '確定要將此報價單標記為「已寄出」？' }],
  sent:     [
    { toStatus: 'accepted', label: '客戶已接受', variant: 'success',     confirm: '確定要將此報價單標記為「已接受」？' },
    { toStatus: 'rejected', label: '客戶已拒絕', variant: 'destructive', confirm: '確定要將此報價單標記為「已拒絕」？' },
  ],
  accepted: [],
  rejected: [],
}

const EMPTY_ITEM = { description: '', quantity: 1, unit_price: 0 }
const NO_CLIENT  = '__none__'

// ─── 版本 diff 計算 ───────────────────────────────────────────────────────────
function computeDiff(aQuote, bQuote) {
  const aItems = aQuote.items || []
  const bItems = bQuote.items || []

  const removed = aItems.filter(ai => !bItems.some(bi => bi.description === ai.description))
  const added   = bItems.filter(bi => !aItems.some(ai => ai.description === bi.description))
  const changed = bItems
    .filter(bi => {
      const ai = aItems.find(x => x.description === bi.description)
      return ai && (ai.quantity !== bi.quantity || ai.unit_price !== bi.unit_price)
    })
    .map(bi => ({ description: bi.description, before: aItems.find(x => x.description === bi.description), after: bi }))

  return {
    totalDiff: (bQuote.total || 0) - (aQuote.total || 0),
    added,
    removed,
    changed,
  }
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────
export function QuoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const quoteId = parseInt(id)

  const [quote, setQuote]           = useState(null)
  const [versions, setVersions]     = useState([])
  const [statusLogs, setStatusLogs] = useState([])
  const [clients, setClients]       = useState([])

  // 編輯模式（僅草稿可用）
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({})
  const [items, setItems]     = useState([])
  const [saving, setSaving]   = useState(false)

  // 狀態變更 confirm 對話框
  const [statusModal, setStatusModal]   = useState(null)   // { toStatus, label, confirm, variant }
  const [statusNote, setStatusNote]     = useState('')
  const [statusLoading, setStatusLoading] = useState(false)

  // 另存新版 confirm 對話框
  const [newVerModal, setNewVerModal]     = useState(false)
  const [newVerLoading, setNewVerLoading] = useState(false)

  // 版本比較
  const [compareId, setCompareId]       = useState(null)
  const [compareQuote, setCompareQuote] = useState(null)

  // ─── 資料載入 ─────────────────────────────────────────────────────────────
  const loadQuote = useCallback(async (qid) => {
    const [q, vs, logs, cls] = await Promise.all([
      window.api.quotes.get(qid),
      window.api.quotes.versions(qid),
      window.api.quotes.statusLogs(qid),
      window.api.clients.list(),
    ])
    setQuote(q)
    setVersions(vs)
    setStatusLogs(logs)
    setClients(cls)
    setEditing(false)
    setCompareId(null)
    if (q) {
      setForm({ client_id: q.client_id || '', title: q.title, issue_date: q.issue_date, valid_days: q.valid_days, notes: q.notes || '' })
      setItems(q.items?.length ? q.items.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })) : [{ ...EMPTY_ITEM }])
    }
  }, [])

  useEffect(() => { loadQuote(quoteId) }, [quoteId])

  useEffect(() => {
    if (!compareId) { setCompareQuote(null); return }
    window.api.quotes.get(compareId).then(setCompareQuote)
  }, [compareId])

  // ─── 動作處理 ────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      await window.api.quotes.update({
        id: quoteId, ...form,
        valid_days: parseInt(form.valid_days) || 30,
        client_id: form.client_id || null,
        items,
      })
      await loadQuote(quoteId)
    } finally { setSaving(false) }
  }

  function cancelEdit() {
    setEditing(false)
    if (quote) {
      setForm({ client_id: quote.client_id || '', title: quote.title, issue_date: quote.issue_date, valid_days: quote.valid_days, notes: quote.notes || '' })
      setItems(quote.items?.length ? quote.items.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })) : [{ ...EMPTY_ITEM }])
    }
  }

  async function handleStatusChange() {
    if (!statusModal) return
    setStatusLoading(true)
    try {
      await window.api.quotes.updateStatus({ id: quoteId, toStatus: statusModal.toStatus, note: statusNote.trim() || null })
      setStatusModal(null); setStatusNote('')
      await loadQuote(quoteId)
    } finally { setStatusLoading(false) }
  }

  async function handleNewVersion() {
    setNewVerLoading(true)
    try {
      const newQ = await window.api.quotes.saveAsNewVersion(quoteId)
      setNewVerModal(false)
      navigate(`/quotes/${newQ.id}`)
    } finally { setNewVerLoading(false) }
  }

  function updateItem(i, key, val) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  }

  async function exportPdf() {
    if (!quote) return
    const doc = new jsPDF()
    doc.setFontSize(18); doc.text(quote.title, 14, 20)
    doc.setFontSize(10); doc.setTextColor(100)
    doc.text(`客戶: ${quote.client_name || '—'}`, 14, 32)
    doc.text(`日期: ${quote.issue_date}  有效: ${quote.valid_days} 天`, 14, 38)
    autoTable(doc, {
      startY: 48,
      styles: { fontSize: 9 },
      head: [['說明', '數量', '單價', '小計']],
      body: (quote.items || []).map(i => [i.description, i.quantity, `NT$ ${(i.unit_price || 0).toLocaleString()}`, `NT$ ${(i.subtotal || i.quantity * i.unit_price).toLocaleString()}`]),
      foot: [['', '', '合計', `NT$ ${(quote.total || 0).toLocaleString()}`]],
    })
    if (quote.notes) doc.text(`備註: ${quote.notes}`, 14, doc.lastAutoTable.finalY + 10)
    doc.save(`${quote.title}_v${quote.version || 1}.pdf`)
  }

  // ─── 計算值 ──────────────────────────────────────────────────────────────
  const lineTotal  = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0)
  const isReadOnly = quote?.status !== 'draft'
  const maxVersion = versions.length ? Math.max(...versions.map(v => v.version)) : (quote?.version || 1)
  // 從「比較版本」往「當前版本」方向計算差異，這樣 added/removed 語意才正確
  const diff = compareId && compareQuote ? computeDiff(compareQuote, quote) : null

  if (!quote) {
    return <div className="p-8 text-sm text-muted-foreground">載入中...</div>
  }

  return (
    <div className="flex min-h-screen">

      {/* ── 版本側欄 ──────────────────────────────────────────────────────── */}
      <aside
        className="w-52 shrink-0 border-r border-border flex flex-col"
        style={{ background: '#141415' }}
      >
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            版本列表
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {versions.map(v => (
            <button
              key={v.id}
              onClick={() => v.id !== quoteId && navigate(`/quotes/${v.id}`)}
              className={cn(
                'w-full text-left px-4 py-2.5 border-l-2 transition-colors hover:bg-white/5',
                v.id === quoteId
                  ? 'bg-indigo-500/15 border-indigo-500'
                  : 'border-transparent',
                v.id === compareId && v.id !== quoteId
                  ? 'ring-1 ring-inset ring-amber-500/40'
                  : ''
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">v{v.version}</span>
                <StatusBadge status={v.status || 'draft'} />
              </div>
              <div className="text-[11px] tabular-nums text-muted-foreground">
                NT$ {(v.total || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground/50 mt-0.5">{v.issue_date}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── 主要內容 ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="p-6 max-w-3xl">

          {/* 頁頭 */}
          <div className="flex items-start justify-between mb-6 gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <button
                onClick={() => navigate('/quotes')}
                className="p-1.5 mt-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                {editing ? (
                  <Input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="text-base font-semibold h-8 mb-1"
                  />
                ) : (
                  <h1 className="text-lg font-semibold text-foreground truncate">{quote.title}</h1>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    v{quote.version || 1}
                  </span>
                  <StatusBadge status={quote.status || 'draft'} />
                  {isReadOnly && (
                    <span className="text-[11px] text-muted-foreground/60 border border-border/50 rounded px-1.5 py-0.5">
                      唯讀
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportPdf}>
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
              {!isReadOnly && !editing && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" /> 編輯
                </Button>
              )}
              {editing && (
                <>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={cancelEdit}>取消</Button>
                  <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
                    {saving ? '儲存中...' : '儲存'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* ── 基本資訊卡 ─────────────────────────────────────────────────── */}
          <div className="rounded-lg border border-border p-4 mb-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">報價單資訊</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">客戶</div>
                {editing ? (
                  <Select
                    value={form.client_id ? String(form.client_id) : NO_CLIENT}
                    onValueChange={v => setForm(f => ({ ...f, client_id: v === NO_CLIENT ? '' : parseInt(v) }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CLIENT}>— 無 —</SelectItem>
                      {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm">{quote.client_name || '—'}</div>
                )}
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">開立日期</div>
                {editing ? (
                  <Input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} className="h-8 text-xs" />
                ) : (
                  <div className="text-sm">{quote.issue_date}</div>
                )}
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">有效天數</div>
                {editing ? (
                  <Input type="number" min="1" value={form.valid_days} onChange={e => setForm(f => ({ ...f, valid_days: e.target.value }))} className="h-8 text-xs" />
                ) : (
                  <div className="text-sm">{quote.valid_days} 天</div>
                )}
              </div>
            </div>
            {(editing || quote.notes) && (
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">備註</div>
                {editing ? (
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="text-xs min-h-[60px]" placeholder="備註..." />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{quote.notes}</p>
                )}
              </div>
            )}
          </div>

          {/* ── 品項表格 ────────────────────────────────────────────────────── */}
          <div className="rounded-lg border border-border overflow-hidden mb-4">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">說明</th>
                  <th className="px-2 py-2 text-center font-medium text-muted-foreground w-16">數量</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground w-28">單價</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground w-24">小計</th>
                  {editing && <th className="w-8" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(editing ? items : quote.items || []).map((item, i) => (
                  <tr key={i} className={editing ? '' : 'hover:bg-muted/20 transition-colors'}>
                    <td className="px-3 py-2">
                      {editing ? (
                        <input className="w-full bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground" placeholder="項目說明" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                      ) : item.description}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {editing ? (
                        <input className="w-full bg-transparent text-xs text-center focus:outline-none" type="number" min="0" step="0.1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                      ) : item.quantity}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {editing ? (
                        <input className="w-full bg-transparent text-xs text-right focus:outline-none" type="number" min="0" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} />
                      ) : `NT$ ${(item.unit_price || 0).toLocaleString()}`}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                      NT$ {editing
                        ? ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toLocaleString()
                        : (item.subtotal ?? item.quantity * item.unit_price).toLocaleString()}
                    </td>
                    {editing && (
                      <td className="pr-2 text-center">
                        {items.length > 1 && (
                          <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-muted/30">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">合計</td>
                  <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums">
                    NT$ {(editing ? lineTotal : quote.total || 0).toLocaleString()}
                  </td>
                  {editing && <td />}
                </tr>
              </tfoot>
            </table>
            {editing && (
              <div className="px-3 py-2 border-t border-border/50">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setItems(prev => [...prev, { ...EMPTY_ITEM }])}>
                  <Plus className="h-3 w-3 mr-1" /> 新增品項
                </Button>
              </div>
            )}
          </div>

          {/* ── 狀態操作按鈕組 ──────────────────────────────────────────────── */}
          {!editing && (
            <div className="rounded-lg border border-border p-4 mb-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">狀態操作</h2>
              <div className="flex gap-2 flex-wrap">
                {(STATUS_ACTIONS[quote.status] || []).map(action => (
                  <Button
                    key={action.toStatus}
                    size="sm"
                    variant={action.variant === 'success' ? 'default' : action.variant}
                    className={cn(
                      'gap-1.5',
                      action.variant === 'success' && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    )}
                    onClick={() => setStatusModal(action)}
                  >
                    {action.label}
                  </Button>
                ))}
                {/* 另存新版：sent / accepted / rejected 均可 */}
                {quote.status !== 'draft' && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNewVerModal(true)}>
                    <Copy className="h-3.5 w-3.5" /> 另存新版
                  </Button>
                )}
                {/* 草稿也可另存新版（例：準備多個方案） */}
                {quote.status === 'draft' && versions.length > 0 && (
                  <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => setNewVerModal(true)}>
                    <Copy className="h-3.5 w-3.5" /> 另存新版
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── 狀態歷程時間軸 ──────────────────────────────────────────────── */}
          <div className="rounded-lg border border-border p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">狀態歷程</h2>
            </div>
            {statusLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">尚無狀態變更記錄</p>
            ) : (
              <div className="space-y-0">
                {statusLogs.map((log, i) => (
                  <div key={log.id} className="flex gap-3">
                    {/* 時間軸圓點與連接線 */}
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'h-3.5 w-3.5 rounded-full border-2 shrink-0 mt-0.5',
                        STATUS_CFG[log.to_status]?.dotCls || 'border-zinc-400 bg-zinc-400/20'
                      )} />
                      {i < statusLogs.length - 1 && (
                        <div className="w-px flex-1 min-h-[20px] bg-border/50 my-1" />
                      )}
                    </div>
                    {/* 內容 */}
                    <div className={cn('flex-1 min-w-0', i < statusLogs.length - 1 ? 'pb-3' : '')}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {log.from_status && (
                          <>
                            <StatusBadge status={log.from_status} />
                            <span className="text-xs text-muted-foreground">→</span>
                          </>
                        )}
                        <StatusBadge status={log.to_status} />
                        <span className="text-[11px] text-muted-foreground/60 ml-auto whitespace-nowrap">
                          {(log.changed_at || '').replace('T', ' ').slice(0, 16)}
                        </span>
                      </div>
                      {log.note && (
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{log.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 版本 diff 比較面板 ───────────────────────────────────────────── */}
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">版本比較</h2>
              <Select
                value={compareId ? String(compareId) : '__none__'}
                onValueChange={v => setCompareId(v === '__none__' ? null : parseInt(v))}
              >
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder="選擇比較版本" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— 不比較 —</SelectItem>
                  {versions.filter(v => v.id !== quoteId).map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      v{v.version} · {STATUS_CFG[v.status]?.label || '草稿'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!compareId && (
              <p className="text-xs text-muted-foreground">從上方選擇版本進行比較</p>
            )}

            {diff && compareQuote && (
              <div className="space-y-4">
                {/* 金額差異（顯示方向：比較版本 → 當前版本） */}
                <div className="rounded-md bg-muted/30 p-3">
                  <div className="text-[11px] font-medium text-muted-foreground mb-2">金額差異</div>
                  <div className="flex items-center gap-3 text-sm flex-wrap">
                    <span className="tabular-nums">
                      <span className="text-[11px] text-muted-foreground mr-1">v{compareQuote.version}</span>
                      NT$ {(compareQuote.total || 0).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="tabular-nums font-medium">
                      <span className="text-[11px] text-muted-foreground mr-1">v{quote.version}（本版）</span>
                      NT$ {(quote.total || 0).toLocaleString()}
                    </span>
                    <span className={cn(
                      'tabular-nums font-semibold',
                      diff.totalDiff > 0 ? 'text-emerald-400' : diff.totalDiff < 0 ? 'text-red-400' : 'text-muted-foreground'
                    )}>
                      ({diff.totalDiff >= 0 ? '+' : ''}{diff.totalDiff.toLocaleString()})
                    </span>
                  </div>
                </div>

                {/* 品項差異 */}
                {diff.removed.length + diff.added.length + diff.changed.length === 0 ? (
                  <p className="text-xs text-muted-foreground">品項無差異</p>
                ) : (
                  <div className="space-y-3">
                    {diff.removed.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium text-red-400 mb-1.5">移除品項</div>
                        {diff.removed.map((item, i) => (
                          <div key={i} className="text-xs rounded px-2.5 py-2 mb-1 bg-red-500/10 border border-red-500/20">
                            <span className="text-foreground">{item.description}</span>
                            <span className="text-muted-foreground ml-2">
                              × {item.quantity} @ NT$ {(item.unit_price || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {diff.added.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium text-emerald-400 mb-1.5">新增品項</div>
                        {diff.added.map((item, i) => (
                          <div key={i} className="text-xs rounded px-2.5 py-2 mb-1 bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-foreground">{item.description}</span>
                            <span className="text-muted-foreground ml-2">
                              × {item.quantity} @ NT$ {(item.unit_price || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {diff.changed.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium text-amber-400 mb-1.5">異動品項</div>
                        {diff.changed.map((change, i) => (
                          <div key={i} className="text-xs rounded px-2.5 py-2 mb-1 bg-amber-500/10 border border-amber-500/20">
                            <div className="text-foreground mb-1">{change.description}</div>
                            <div className="text-muted-foreground line-through text-[11px]">
                              × {change.before.quantity} @ NT$ {(change.before.unit_price || 0).toLocaleString()}
                            </div>
                            <div className="text-amber-300 text-[11px] mt-0.5">
                              → × {change.after.quantity} @ NT$ {(change.after.unit_price || 0).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 狀態變更 confirm 對話框 ───────────────────────────────────────── */}
      <Dialog open={!!statusModal} onOpenChange={v => { if (!v) { setStatusModal(null); setStatusNote('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>變更狀態確認</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-sm text-muted-foreground">{statusModal?.confirm}</p>
            <div className="flex items-center gap-3 py-1">
              <StatusBadge status={quote.status || 'draft'} />
              <span className="text-muted-foreground text-sm">→</span>
              {statusModal && <StatusBadge status={statusModal.toStatus} />}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">備註（選填）</Label>
              <Textarea
                placeholder="例如：客戶於 LINE 口頭確認"
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                className="text-xs min-h-[64px]"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setStatusModal(null); setStatusNote('') }}>取消</Button>
            <Button size="sm" onClick={handleStatusChange} disabled={statusLoading}>
              {statusLoading ? '處理中...' : '確認變更'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 另存新版 confirm 對話框 ───────────────────────────────────────── */}
      <Dialog open={newVerModal} onOpenChange={v => { if (!v) setNewVerModal(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>另存新版</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              確定要將此報價單另存為新版本？
            </p>
            <div className="mt-3 p-3 rounded-md bg-muted/30 text-xs text-muted-foreground space-y-1">
              <div>目前版本 <strong className="text-foreground">v{quote.version || 1}</strong> 將保留為唯讀</div>
              <div>新建 <strong className="text-foreground">v{maxVersion + 1}</strong> 將從草稿狀態開始，品項與內容將完整複製</div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewVerModal(false)}>取消</Button>
            <Button size="sm" onClick={handleNewVersion} disabled={newVerLoading}>
              {newVerLoading ? '建立中...' : '確認另存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
