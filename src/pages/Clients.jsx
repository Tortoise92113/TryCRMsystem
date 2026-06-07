import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Mail, Phone, Building2, Users } from 'lucide-react'
import { useI18n } from '../context/I18nContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@/components/ui/dialog'

const EMPTY_FORM = { name: '', company: '', email: '', phone: '', notes: '' }

function Field({ label, error, children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function Clients() {
  const { t } = useI18n()
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [projectCounts, setProjectCounts] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (q = '') => {
    const [data, counts] = await Promise.all([
      window.api.clients.list(q),
      window.api.clients.projectCounts(),
    ])
    setClients(data)
    setProjectCounts(counts)
  }, [])

  useEffect(() => { load() }, [])
  useEffect(() => {
    const timer = setTimeout(() => load(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setErrors({}); setModalOpen(true) }
  function openEdit(c) {
    setForm({ name: c.name, company: c.company || '', email: c.email || '', phone: c.phone || '', notes: c.notes || '' })
    setEditId(c.id); setErrors({}); setModalOpen(true)
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = t('clients.name') + ' 必填'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.email = '請輸入有效的電子信箱'
    if (form.phone.trim() && !/^\d{7,10}$/.test(form.phone.trim()))
      errs.phone = '請輸入正確的電話號碼（最多10碼數字）'
    return errs
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      if (editId) await window.api.clients.update({ id: editId, ...form })
      else await window.api.clients.create(form)
      await load(search)
      setModalOpen(false)
    } finally { setLoading(false) }
  }

  async function handleDelete(id) {
    setDeleting(true)
    try {
      await window.api.clients.delete(id)
      await load(search)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  function setField(key, value) { setForm(f => ({ ...f, [key]: value })) }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[30px] font-bold text-foreground">{t('clients.title')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{clients.length} 位客戶</p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-3.5 w-3.5" /> {t('clients.add')}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <Input
          placeholder={t('clients.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Client grid */}
      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('clients.noClients')}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" /> {t('clients.add')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {clients.map(client => (
            <Card key={client.id} className="group hover:border-border/80 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
                    {client.company && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3 shrink-0" /> {client.company}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 ml-2 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {projectCounts[client.id] || 0} {t('clients.projects')}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground mb-3">
                  {client.email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3 w-3 shrink-0" /> {client.email}
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 shrink-0" /> {client.phone}
                    </div>
                  )}
                  {client.notes && (
                    <p className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-2">{client.notes}</p>
                  )}
                </div>

                <div className="flex gap-1.5 pt-3 border-t border-border/60">
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => openEdit(client)}>
                    <Pencil className="h-3 w-3" /> {t('common.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(client)}>
                    <Trash2 className="h-3 w-3" /> {t('common.delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? t('clients.edit') : t('clients.add')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Field label={t('clients.name')} error={errors.name}>
              <Input
                placeholder="王小明"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
              />
            </Field>
            <Field label={t('clients.company')}>
              <Input placeholder="公司名稱" value={form.company} onChange={e => setField('company', e.target.value)} />
            </Field>
            <Field label={t('clients.email')} error={errors.email}>
              <Input
                type="email"
                placeholder="example@email.com"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
                className={errors.email ? 'border-destructive' : ''}
              />
            </Field>
            <Field label={t('clients.phone')} error={errors.phone}>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0912345678"
                value={form.phone}
                onChange={e => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                className={errors.phone ? 'border-destructive' : ''}
              />
            </Field>
            <Field label={t('clients.notes')}>
              <Textarea placeholder="備註..." value={form.notes} onChange={e => setField('notes', e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleSave} disabled={loading}>
              {loading ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clients.delete')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">{t('clients.confirmDelete')}</p>
            {deleteTarget && <p className="mt-2 text-sm font-semibold">{deleteTarget.name}</p>}
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
