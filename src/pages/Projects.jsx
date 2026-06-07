import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, X, Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useI18n } from '../context/I18nContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@/components/ui/dialog'

const STATUSES = ['negotiating', 'in_progress', 'completed', 'cancelled']
const PAYMENT_STATUSES = ['pending_estimate', 'quoted', 'receivable', 'paid']
const PAYMENT_CFG = {
  pending_estimate: { cls: 'bg-zinc-700/60 text-zinc-300' },
  quoted:           { cls: 'bg-indigo-600/60 text-indigo-200' },
  receivable:       { cls: 'bg-amber-600/60 text-amber-200' },
  paid:             { cls: 'bg-emerald-600/60 text-emerald-200' },
}
const EMPTY = { client_id: '', title: '', status: 'negotiating', amount: '', deadline: '', description: '', payment_status: 'pending_estimate', remittance_date: '', completion_date: '' }
const NO_CLIENT = '__none__'

function SortHead({ col, sort, onSort, children, className = '' }) {
  const active = sort.col === col
  const Icon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <Icon className={`h-3 w-3 shrink-0 ${active ? 'text-foreground' : 'opacity-40'}`} />
      </span>
    </th>
  )
}

function Field({ label, error, children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function Projects() {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const filter = searchParams.get('status') || 'all'
  const periodFilter = searchParams.get('period') || ''
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ col: null, dir: 'asc' })
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const [projs, cls] = await Promise.all([window.api.projects.list(), window.api.clients.list()])
    setProjects(projs); setClients(cls)
  }, [])

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let result = filter === 'all' ? projects : projects.filter(p => p.status === filter)

    if (periodFilter) {
      const now = new Date()
      const ym = periodFilter === 'month'
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        : periodFilter
      result = result.filter(p =>
        p.payment_status === 'paid' &&
        p.remittance_date &&
        p.remittance_date.startsWith(ym)
      )
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(p => p.title.toLowerCase().includes(q))
    }

    if (sort.col) {
      result = [...result].sort((a, b) => {
        const av = a[sort.col]
        const bv = b[sort.col]
        const empty = v => v == null || v === ''
        if (empty(av) && empty(bv)) return 0
        if (empty(av)) return 1
        if (empty(bv)) return -1
        const cmp = sort.col === 'amount'
          ? av - bv
          : av < bv ? -1 : av > bv ? 1 : 0
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [projects, filter, periodFilter, search, sort])

  const filterLabel = useMemo(() => {
    if (periodFilter === 'month') return '本月已收款'
    if (periodFilter) return `${periodFilter} 已收款`
    if (filter !== 'all') return t(`projects.statuses.${filter}`)
    return null
  }, [filter, periodFilter, t])

  function handleFilterClick(s) {
    setSearchParams(s !== 'all' ? { status: s } : {}, { replace: true })
  }

  function clearFilter() {
    setSearchParams({}, { replace: true })
  }

  function toggleSort(col) {
    setSort(prev => {
      if (prev.col !== col) return { col, dir: 'asc' }
      if (prev.dir === 'asc')  return { col, dir: 'desc' }
      return { col: null, dir: 'asc' }  // 第三次：清除排序
    })
  }

  function openAdd() { setForm(EMPTY); setEditId(null); setErrors({}); setModalOpen(true) }
  function openEdit(p) {
    setForm(Object.fromEntries(Object.keys(EMPTY).map(k => [k, p[k] ?? EMPTY[k]])))
    setEditId(p.id); setErrors({}); setModalOpen(true)
  }

  function validate() {
    const errs = {}
    if (!form.title.trim()) errs.title = t('projects.projectTitle') + ' 必填'
    if (!form.client_id) errs.client_id = t('projects.client') + ' 必填'
    if (form.status === 'completed' && !form.completion_date) errs.completion_date = '狀態為已完成時，完成日期為必填'
    if (form.payment_status === 'paid' && !form.remittance_date) errs.remittance_date = '款項進度為已收款時，匯款日期為必填'
    return errs
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const payload = { ...form, amount: parseFloat(form.amount) || 0 }
      if (editId) await window.api.projects.update({ id: editId, ...payload })
      else await window.api.projects.create(payload)
      await load()
      setModalOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    setDeleting(true)
    try {
      await window.api.projects.delete(id)
      await load()
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const clientSelectVal = form.client_id ? String(form.client_id) : NO_CLIENT

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 min-w-0">
          <h1 className="text-[30px] font-bold text-foreground">{t('projects.title')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} 個專案</p>
        </div>
        <div className="relative w-56 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
          <Input
            placeholder="搜尋專案名稱..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button onClick={openAdd} size="sm" className="shrink-0">
          <Plus className="h-3.5 w-3.5" /> {t('projects.add')}
        </Button>
      </div>

      {/* Active filter banner */}
      {filterLabel && (
        <div className="flex items-center gap-2 mb-4 -mt-1">
          <span className="text-xs text-muted-foreground">套用篩選：</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium">
            {filterLabel}
            <button onClick={clearFilter} className="hover:opacity-70 transition-opacity leading-none">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {['all', ...STATUSES].map(s => (
          <button
            key={s}
            onClick={() => handleFilterClick(s)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === s && !periodFilter
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
            }`}
          >
            {s === 'all' ? '全部' : t(`projects.statuses.${s}`)}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-sm text-muted-foreground">{t('projects.noProjects')}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('projects.projectTitle')}</TableHead>
                <TableHead>{t('projects.client')}</TableHead>
                <TableHead>{t('projects.status')}</TableHead>
                <SortHead col="amount"          sort={sort} onSort={toggleSort}>{t('projects.amount')}</SortHead>
                <SortHead col="deadline"        sort={sort} onSort={toggleSort}>{t('projects.deadline')}</SortHead>
                <SortHead col="completion_date" sort={sort} onSort={toggleSort}>{t('projects.completionDate')}</SortHead>
                <TableHead>{t('projects.paymentStatus')}</TableHead>
                <SortHead col="remittance_date" sort={sort} onSort={toggleSort}>{t('projects.remittanceDate')}</SortHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-muted-foreground">{p.client_name}</TableCell>
                  <TableCell>
                    <Badge variant={p.status}>{t(`projects.statuses.${p.status}`)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {p.amount != null ? `NT$ ${p.amount.toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.deadline || '—'}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{p.completion_date || '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${PAYMENT_CFG[p.payment_status || 'pending_estimate'].cls}`}>
                      {t(`projects.paymentStatuses.${p.payment_status || 'pending_estimate'}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{p.remittance_date || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(p)}>
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

      {/* Form dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? t('projects.edit') : t('projects.add')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Field label={t('projects.projectTitle')} error={errors.title}>
              <Input
                placeholder="專案名稱"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={errors.title ? 'border-destructive' : ''}
              />
            </Field>
            <Field label={t('projects.client')} error={errors.client_id}>
              <Select
                value={clientSelectVal}
                onValueChange={v => setForm(f => ({ ...f, client_id: v === NO_CLIENT ? '' : parseInt(v, 10) }))}
              >
                <SelectTrigger className={errors.client_id ? 'border-destructive' : ''}>
                  <SelectValue placeholder="— 選擇客戶 —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>— 選擇客戶 —</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('projects.status')}>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`projects.statuses.${s}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`${t('projects.amount')} (NT$)`}>
              <Input
                type="number" min="0" placeholder="0" value={form.amount}
                onChange={e => setForm(f => ({
                  ...f,
                  amount: e.target.value,
                  payment_status: (parseFloat(e.target.value) > 0 && f.payment_status === 'pending_estimate')
                    ? 'quoted'
                    : f.payment_status,
                }))}
              />
            </Field>
            <Field label={t('projects.deadline')}>
              <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </Field>
            <Field label={<>{t('projects.completionDate')}{form.status === 'completed' && <span className="text-destructive ml-0.5">*</span>}</>} error={errors.completion_date}>
              <Input
                type="date"
                value={form.completion_date}
                onChange={e => setForm(f => ({ ...f, completion_date: e.target.value }))}
                className={errors.completion_date ? 'border-destructive' : ''}
              />
            </Field>
            <Field label={t('projects.paymentStatus')}>
              <Select
                value={form.payment_status || 'pending_estimate'}
                onValueChange={v => setForm(f => ({ ...f, payment_status: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{t(`projects.paymentStatuses.${s}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={<>{t('projects.remittanceDate')}{form.payment_status === 'paid' && <span className="text-destructive ml-0.5">*</span>}</>} error={errors.remittance_date}>
              <Input
                type="date"
                value={form.remittance_date}
                onChange={e => setForm(f => ({ ...f, remittance_date: e.target.value }))}
                className={errors.remittance_date ? 'border-destructive' : ''}
              />
            </Field>
            <Field label={t('projects.description')}>
              <Textarea placeholder="專案描述..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleSave} disabled={loading}>{loading ? t('common.loading') : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('projects.delete')}</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">{t('projects.confirmDelete')}</p>
            {deleteTarget && <p className="mt-2 text-sm font-semibold">{deleteTarget.title}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(deleteTarget?.id)} disabled={deleting}>{deleting ? t('common.loading') : t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
