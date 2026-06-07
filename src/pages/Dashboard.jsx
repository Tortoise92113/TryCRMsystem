import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Briefcase, CheckCircle2 } from 'lucide-react'
import { useI18n } from '../context/I18nContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/Badge'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const STATUS_COLORS = {
  negotiating: '#f59e0b',
  in_progress:  '#6366f1',
  completed:    '#10b981',
  cancelled:    '#a1a1aa',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-md text-xs">
      <p className="font-medium mb-1">{label}</p>
      <p className="text-muted-foreground">NT$ {payload[0]?.value?.toLocaleString()}</p>
    </div>
  )
}

export function Dashboard() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => { window.api.projects.dashboard().then(setData) }, [])

  if (!data) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  const { monthlyIncome, inProgress, completionStats, monthlyTrend } = data
  const total = completionStats.reduce((s, r) => s + r.count, 0)
  const completed = completionStats.find(r => r.status === 'completed')?.count || 0
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0
  const trendData = [...monthlyTrend].reverse().map(r => ({ month: r.month, total: r.total }))
  const pieData = completionStats.map(r => ({ name: t(`projects.statuses.${r.status}`), value: r.count, status: r.status }))
  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-[30px] font-bold text-foreground">{t('dashboard.title')}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">概覽本月狀況</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Card
          className="cursor-pointer transition-all hover:ring-1 hover:ring-primary/40 hover:shadow-md hover:shadow-primary/10"
          onClick={() => navigate('/projects?status=completed&period=month')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('dashboard.monthlyIncome')}</CardTitle>
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              NT$ {(monthlyIncome.total || 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">本月已收款案件</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all hover:ring-1 hover:ring-primary/40 hover:shadow-md hover:shadow-primary/10"
          onClick={() => navigate('/projects?status=in_progress')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('dashboard.inProgress')}</CardTitle>
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{inProgress.count}</p>
            <p className="text-xs text-muted-foreground mt-1">
              <Badge variant="in_progress" className="text-[11px]">{t('projects.statuses.in_progress')}</Badge>
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all hover:ring-1 hover:ring-primary/40 hover:shadow-md hover:shadow-primary/10"
          onClick={() => navigate('/projects?status=completed')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('dashboard.completionRate')}</CardTitle>
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{rate}%</p>
            <p className="text-xs text-muted-foreground mt-1">{completed} / {total} 案件</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>{t('dashboard.trend')}</CardTitle></CardHeader>
          <CardContent className="pt-1">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendData} barSize={24}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="total"
                    fill="#6366f1"
                    radius={[3, 3, 0, 0]}
                    cursor="pointer"
                    onClick={d => navigate(`/projects?period=${d.month === currentYM ? 'month' : d.month}`)}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">尚無已完成案件</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t('dashboard.projectStatus')}</CardTitle></CardHeader>
          <CardContent className="pt-1">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    cx="50%"
                    cy="45%"
                    outerRadius={65}
                    innerRadius={35}
                    cursor="pointer"
                    onClick={d => navigate(`/projects?status=${d.status}`)}
                  >
                    {pieData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.status] || '#a1a1aa'} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, name) => [v + ' 件', name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
