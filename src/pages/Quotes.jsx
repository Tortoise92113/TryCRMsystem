import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Download, X, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../context/I18nContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const EMPTY_QUOTE = { client_id: '', title: '', issue_date: new Date().toISOString().slice(0, 10), valid_days: 30, notes: '' }
const EMPTY_ITEM  = { description: '', quantity: 1, unit_price: 0 }
const NO_CLIENT   = '__none__'

// 狀態徽章設定
const STATUS_CFG = {
  draft:    { label: '草稿',   cls: 'bg-zinc-700/80 text-zinc-200' },
  sent:     { label: '已寄出', cls: 'bg-indigo-600/70 text-indigo-100' },
  accepted: { label: '已接受', cls: 'bg-emerald-600/70 text-emerald-100' },
  rejected: { label: '已拒絕', cls: 'bg-red-600/70 text-red-100' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.draft
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function Quotes() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [quotes, setQuotes] = useState([])
  const [clients, setClients] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_QUOTE)
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const [qs, cls] = await Promise.all([window.api.quotes.list(), window.api.clients.list()])
    setQuotes(qs); setClients(cls)
  }, [])

  useEffect(() => { load() }, [])

  const lineTotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0)
  const clientSelectVal = form.client_id ? String(form.client_id) : NO_CLIENT

  function openAdd() {
    setForm({ ...EMPTY_QUOTE, issue_date: new Date().toISOString().slice(0, 10) })
    setItems([{ ...EMPTY_ITEM }]); setErrors({}); setModalOpen(true)
  }

  async function handleSave() {
    const errs = {}
    if (!form.title.trim()) errs.title = t('quotes.quoteTitle') + ' 必填'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const payload = { ...form, valid_days: parseInt(form.valid_days) || 30, client_id: form.client_id || null, items }
      const created = await window.api.quotes.create(payload)
      setModalOpen(false)
      // 建立後直接進入詳情頁
      navigate(`/quotes/${created.id}`)
    } finally { setLoading(false) }
  }

  async function handleDelete(id) {
    await window.api.quotes.delete(id); setDeleteTarget(null); load()
  }

  function updateItem(i, key, val) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  }

  async function exportPdf(q) {
    const full = await window.api.quotes.get(q.id)
    const doc = new jsPDF()
    doc.setFontSize(18); doc.text(full.title, 14, 20)
    doc.setFontSize(10); doc.setTextColor(100)
    doc.text(`客戶: ${full.client_name || '—'}`, 14, 32)
    doc.text(`日期: ${full.issue_date}  有效: ${full.valid_days} 天`, 14, 38)
    autoTable(doc, {
      startY: 48,
      styles: { fontSize: 9 },
      head: [[t('quotes.itemDesc'), t('quotes.qty'), t('quotes.unitPrice'), t('quotes.subtotal')]],
      body: full.items.map(i => [i.description, i.quantity, `NT$ ${i.unit_price.toLocaleString()}`, `NT$ ${i.subtotal.toLocaleString()}`]),
      foot: [['', '', '合計', `NT$ ${full.total.toLocaleString()}`]],
    })
    if (full.notes) doc.text(`備註: ${full.notes}`, 14, doc.lastAutoTable.finalY + 10)
    doc.save(`${full.title}_v${full.version || 1}.pdf`)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[30px] font-bold text-foreground">{t('quotes.title')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{quotes.length} 張報價單</p>
        </div>
        <Button onClick={openAdd} size="sm"><Plus className="h-3.5 w-3.5" /> {t('quotes.add')}</Button>
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-sm text-muted-foreground">{t('quotes.noQuotes')}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('quotes.quoteTitle')}</TableHead>
                <TableHead className="w-20">版本</TableHead>
                <TableHead className="w-24">狀態</TableHead>
                <TableHead>{t('quotes.client')}</TableHead>
                <TableHead>{t('quotes.issueDate')}</TableHead>
                <TableHead>{t('quotes.total')}</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map(q => (
                <TableRow
                  key={q.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/quotes/${q.id}`)}
                >
                  <TableCell className="font-medium">{q.title}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground font-mono">v{q.version || 1}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={q.status || 'draft'} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{q.client_name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{q.issue_date}</TableCell>
                  <TableCell className="tabular-nums font-medium">NT$ {(q.total || 0).toLocaleString()}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="查看詳情" onClick={() => navigate(`/quotes/${q.id}`)}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t('quotes.exportPdf')} onClick={() => exportPdf(q)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(q)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 新增報價單對話框 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t('quotes.add')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Field label={t('quotes.quoteTitle')}>
              <Input placeholder="報價單名稱" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={errors.title ? 'border-destructive' : ''} />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </Field>
            <Field label={t('quotes.client')}>
              <Select value={clientSelectVal} onValueChange={v => setForm(f => ({ ...f, client_id: v === NO_CLIENT ? '' : parseInt(v) }))}>
                <SelectTrigger><SelectValue placeholder="— 選擇客戶 —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>— 無 —</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('quotes.issueDate')}>
                <Input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
              </Field>
              <Field label={t('quotes.validDays')}>
                <Input type="number" min="1" value={form.valid_days} onChange={e => setForm(f => ({ ...f, valid_days: e.target.value }))} />
              </Field>
            </div>

            {/* 品項 */}
            <div>
              <Label className="block mb-2">{t('quotes.items')}</Label>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('quotes.itemDesc')}</th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground w-14">{t('quotes.qty')}</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground w-24">{t('quotes.unitPrice')}</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground w-20">{t('quotes.subtotal')}</th>
                      <th className="w-7" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {items.map((item, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5">
                          <input className="w-full bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground" placeholder="項目說明" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-full bg-transparent text-xs text-center focus:outline-none tabular-nums" type="number" min="0" step="0.1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-full bg-transparent text-xs text-right focus:outline-none tabular-nums" type="number" min="0" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toLocaleString()}
                        </td>
                        <td className="pr-1.5">
                          {items.length > 1 && (
                            <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 text-muted-foreground hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border bg-muted/30">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">合計</td>
                      <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums">NT$ {lineTotal.toLocaleString()}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => setItems(prev => [...prev, { ...EMPTY_ITEM }])}>
                <Plus className="h-3 w-3" /> {t('quotes.addItem')}
              </Button>
            </div>

            <Field label={t('quotes.notes')}>
              <Textarea placeholder="備註..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleSave} disabled={loading}>{loading ? t('common.loading') : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('quotes.delete')}</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">{t('quotes.confirmDelete')}</p>
            {deleteTarget && <p className="mt-2 text-sm font-semibold">{deleteTarget.title}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(deleteTarget?.id)}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
