import { useEffect } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { I18nProvider } from './context/I18nContext'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Clients } from './pages/Clients'
import { Projects } from './pages/Projects'
import { Quotes } from './pages/Quotes'
import { Settings } from './pages/Settings'
import { QuoteDetail } from './pages/QuoteDetail'

/**
 * 監聽 main process 送來的「navigate-to-project」IPC 事件
 * 通知點擊後跳轉至專案頁面，元件需在 Router 內才能使用 useNavigate
 */
function IpcNavigationListener() {
  const navigate = useNavigate()

  useEffect(() => {
    window.api.events?.onNavigateToProject(() => {
      navigate('/projects')
    })
    return () => window.api.events?.offNavigateToProject()
  }, [navigate])

  return null
}

export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <IpcNavigationListener />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="clients"  element={<Clients />} />
            <Route path="projects" element={<Projects />} />
            <Route path="quotes"      element={<Quotes />} />
            <Route path="quotes/:id"  element={<QuoteDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </I18nProvider>
  )
}
