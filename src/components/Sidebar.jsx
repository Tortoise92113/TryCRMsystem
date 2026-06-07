import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, FolderKanban, FileText, Settings, Power } from 'lucide-react'
import { useI18n } from '../context/I18nContext'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'

const NAV = [
  { to: '/',         icon: LayoutDashboard, key: 'dashboard' },
  { to: '/clients',  icon: Users,           key: 'clients'   },
  { to: '/projects', icon: FolderKanban,    key: 'projects'  },
  { to: '/quotes',   icon: FileText,        key: 'quotes'    },
  { to: '/settings', icon: Settings,        key: 'settings'  },
]

export function Sidebar() {
  const { t } = useI18n()
  const [exitModal, setExitModal] = useState(false)

  function handleExit() {
    window.api.app.quit()
  }

  return (
    <aside className="w-56 min-h-screen flex flex-col shrink-0" style={{ background: '#141415', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Logo */}
      <div className="px-5 h-14 flex items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center">
            <span className="text-[11px] font-bold text-white">C</span>
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">Freelance CRM</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-4 space-y-1.5">
        {NAV.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={key}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 px-3 py-3 rounded-md text-[16px] font-medium transition-colors',
                isActive
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              )
            }
            style={({ isActive }) => isActive ? { background: 'rgba(99,102,241,0.18)' } : undefined}
            onMouseEnter={e => { if (!e.currentTarget.dataset.active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { if (!e.currentTarget.dataset.active) e.currentTarget.style.background = '' }}
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300')} strokeWidth={1.75} />
                {t(`nav.${key}`)}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2.5 py-3 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => setExitModal(true)}
          className="group w-full flex items-center gap-3 px-3 py-3 rounded-md text-[16px] font-medium transition-colors text-zinc-400 hover:text-white"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '' }}
        >
          <Power className="h-5 w-5 shrink-0 text-zinc-500 group-hover:text-red-400 transition-colors" strokeWidth={1.75} />
          EXIT
        </button>
        <div className="px-3 pb-0.5">
          <span className="text-xs text-zinc-600">v1.0.0</span>
        </div>
      </div>

      {/* 離開確認對話框 */}
      <Dialog open={exitModal} onOpenChange={setExitModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確定要離開？</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              確定要關閉 Freelance CRM 嗎？<br />
              <span className="text-xs text-muted-foreground/60 mt-1 block">應用程式將完全結束，不會繼續於托盤背景執行。</span>
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setExitModal(false)}>取消</Button>
            <Button variant="destructive" size="sm" onClick={handleExit}>確定離開</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
