const CLIENTS = [
  { name: '林雅婷',  company: '映見室內設計有限公司',     email: 'yating.lin@mirrorsight.tw',        phone: '0912345678', notes: '偏好極簡北歐風格，預算彈性大，溝通管道以 Line 為主' },
  { name: '陳俊宏',  company: '科技樹數位行銷',            email: 'junhong.chen@techtree.com.tw',     phone: '0922111222', notes: '電商客戶，長期合作，每季固定需要廣告素材與 Landing Page 設計' },
  { name: 'Sarah Wu', company: 'BrightLeaf Organic Co.',   email: 'sarah.wu@brightleaf.com',          phone: '0933456789', notes: '美商台灣分公司，需英文版設計稿，報價以美金換算台幣' },
  { name: '黃志偉',  company: '悅讀文創工作室',            email: 'chihwei.huang@yuedu-studio.com',   phone: '0955678901', notes: '出版社客戶，主要需求為書籍封面與電子書排版，付款週期 30 天' },
  { name: '吳明哲',  company: '鼎立建設股份有限公司',      email: 'mingche.wu@dingli-construction.tw', phone: '0988765432', notes: '建設公司，需要建案 DM、接待中心視覺，案子規模大' },
  { name: '許佳蓉',  company: '芳漾美學診所',              email: 'chia.hsu@fangyang-clinic.com',     phone: '0966234567', notes: '醫美診所，月費社群內容服務，每月 8 則貼文 + 4 則限時' },
]

function seedDemo(db) {
  db.exec('DELETE FROM status_logs; DELETE FROM quote_items; DELETE FROM quotes; DELETE FROM projects; DELETE FROM clients;')

  const now = new Date()

  // 以今天為基準計算相對日期（本地時間，避免 UTC 日期跨日問題）
  function d(offsetDays) {
    const dt = new Date(now)
    dt.setDate(dt.getDate() + offsetDays)
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
  }
  // 月份偏移，可指定日
  function m(offsetMonths, day) {
    const dt = new Date(now.getFullYear(), now.getMonth() + offsetMonths, day || now.getDate())
    return dt.toISOString().slice(0, 10)
  }

  // ─── 客戶 ────────────────────────────────────────────────────────────────
  const insClient = db.prepare(
    'INSERT INTO clients (name,company,email,phone,notes) VALUES (@name,@company,@email,@phone,@notes)'
  )
  const clientIds = []
  db.transaction(() => {
    for (const c of CLIENTS) clientIds.push(insClient.run(c).lastInsertRowid)
  })()

  // ─── 專案 ─────────────────────────────────────────────────────────────────
  // 涵蓋所有 status（4）× payment_status（4）組合，各選項至少一筆
  const PROJECTS = [
    // ── negotiating ──
    {
      ci: 0, title: '信義區豪宅客廳空間視覺規劃',
      status: 'negotiating', payment_status: 'pending_estimate',
      amount: 0, deadline: d(15),
      description: '750 坪豪宅公共空間，包含 3D 模擬圖與材質提案，尚未完成估價',
      completion_date: null, remittance_date: null, completed_at: null,
    },
    {
      ci: 4, title: '青埔新案接待中心視覺系統',
      status: 'negotiating', payment_status: 'quoted',
      amount: 150000, deadline: d(25),
      description: '建案識別系統設計、DM 印刷品、接待中心大圖輸出',
      completion_date: null, remittance_date: null, completed_at: null,
    },
    // ── in_progress ──
    {
      ci: 1, title: '夏季電商促銷廣告素材製作',
      status: 'in_progress', payment_status: 'quoted',
      amount: 45000, deadline: d(10),
      description: 'FB/IG/Google 三平台廣告橫幅，共 24 個尺寸',
      completion_date: null, remittance_date: null, completed_at: null,
    },
    {
      ci: 5, title: '六月份診所社群內容月包',
      status: 'in_progress', payment_status: 'pending_estimate',
      amount: 0, deadline: d(5),
      description: '8 則貼文文案與設計、4 則限時動態、1 則 Reels 腳本，報價確認中',
      completion_date: null, remittance_date: null, completed_at: null,
    },
    // ── completed + receivable（已完成，尚未收款）──
    {
      ci: 2, title: 'BrightLeaf 品牌識別系統重塑',
      status: 'completed', payment_status: 'receivable',
      amount: 120000, deadline: d(-30),
      description: 'Logo、色彩系統、字型規範、品牌手冊 PDF',
      completion_date: d(-25), completed_at: d(-25),
      remittance_date: null,
    },
    // ── completed + paid（本月匯款 → 計入本月收入）──
    {
      ci: 3, title: '《城市光廊》散文集封面設計',
      status: 'completed', payment_status: 'paid',
      amount: 18000, deadline: d(-45),
      description: '書籍正封、封底、書背設計，含 EPUB 封面轉檔',
      completion_date: d(-15), completed_at: d(-15),
      remittance_date: d(-3),   // 本月，確保計入月收入
    },
    // ── completed + paid（上月匯款 → 計入趨勢但非本月）──
    {
      ci: 0, title: '大安區咖啡廳品牌視覺',
      status: 'completed', payment_status: 'paid',
      amount: 55000, deadline: m(-2),
      description: 'Logo、菜單設計、包裝貼紙、名片、店頭招牌規格輸出',
      completion_date: m(-1, 20), completed_at: m(-1, 20),
      remittance_date: m(-1, 25), // 上個月，計入趨勢
    },
    // ── cancelled ──
    {
      ci: 4, title: '淡水輕軌沿線廣告看板設計',
      status: 'cancelled', payment_status: 'pending_estimate',
      amount: 0, deadline: d(-100),
      description: '因建案暫停銷售，估價尚未完成即取消',
      completion_date: null, remittance_date: null, completed_at: null,
    },
    {
      ci: 1, title: '品牌週年慶 Microsite 開發',
      status: 'cancelled', payment_status: 'quoted',
      amount: 75000, deadline: d(-60),
      description: '預算重新分配，需求已轉移至其他廠商',
      completion_date: null, remittance_date: null, completed_at: null,
    },
  ]

  const insProject = db.prepare(`
    INSERT INTO projects
      (client_id, title, status, amount, deadline, description,
       payment_status, remittance_date, completion_date, completed_at)
    VALUES
      (@client_id, @title, @status, @amount, @deadline, @description,
       @payment_status, @remittance_date, @completion_date, @completed_at)
  `)
  db.transaction(() => {
    for (const p of PROJECTS) {
      insProject.run({
        client_id: clientIds[p.ci],
        title: p.title, status: p.status, amount: p.amount,
        deadline: p.deadline, description: p.description,
        payment_status: p.payment_status,
        remittance_date: p.remittance_date ?? null,
        completion_date: p.completion_date ?? null,
        completed_at:    p.completed_at   ?? null,
      })
    }
  })()

  // ─── 報價單 ───────────────────────────────────────────────────────────────
  // 涵蓋所有 status：draft / sent / accepted / rejected
  // 每筆皆附 status_logs，呈現完整時間線
  const QUOTES = [
    {
      ci: 0, title: '信義豪宅空間視覺企劃報價單',
      issue_date: d(-5), valid_days: 30,
      notes: '報價含兩次修改，第三次起加收 10%',
      status: 'draft', version: 1,
      logs: [
        { from: null,    to: 'draft', at: d(-5) },
      ],
      items: [
        { description: '空間概念提案簡報（含 3D 示意圖）', quantity: 1, unit_price: 25000 },
        { description: '材質搭配情境圖（4 種方案）',       quantity: 4, unit_price: 8000  },
        { description: '施工圖說明文件整理',               quantity: 1, unit_price: 12000 },
        { description: '最終定案輸出（大圖 A0 + PDF）',    quantity: 1, unit_price: 5000  },
      ],
    },
    {
      ci: 1, title: '夏季促銷廣告素材報價單',
      issue_date: d(-10), valid_days: 14,
      notes: '急件處理費已含入單價',
      status: 'sent', version: 1,
      logs: [
        { from: null,    to: 'draft', at: d(-10) },
        { from: 'draft', to: 'sent',  at: d(-8)  },
      ],
      items: [
        { description: 'FB/IG 貼文主視覺（1080×1080）',      quantity: 6, unit_price: 2500 },
        { description: 'FB/IG 限時動態（1080×1920）',        quantity: 6, unit_price: 2000 },
        { description: 'Google Display Banner（6 種尺寸）',  quantity: 2, unit_price: 4500 },
        { description: '設計調整（3 輪）',                   quantity: 1, unit_price: 3000 },
      ],
    },
    {
      ci: 3, title: '《城市光廊》書籍設計報價單',
      issue_date: d(-60), valid_days: 21,
      notes: '已結案，此報價單存檔用',
      status: 'accepted', version: 1,
      logs: [
        { from: null,    to: 'draft',    at: d(-60) },
        { from: 'draft', to: 'sent',     at: d(-55) },
        { from: 'sent',  to: 'accepted', at: d(-50), note: '客戶確認接受，已簽約' },
      ],
      items: [
        { description: '書籍正封面設計',    quantity: 1, unit_price: 12000 },
        { description: '封底與書背設計',    quantity: 1, unit_price: 4000  },
        { description: 'EPUB 封面尺寸轉換', quantity: 1, unit_price: 2000  },
      ],
    },
    {
      ci: 4, title: '淡水輕軌看板設計報價單',
      issue_date: d(-120), valid_days: 14,
      notes: '客戶因建案暫停，報價遭拒絕',
      status: 'rejected', version: 1,
      logs: [
        { from: null,    to: 'draft',    at: d(-120) },
        { from: 'draft', to: 'sent',     at: d(-115) },
        { from: 'sent',  to: 'rejected', at: d(-110), note: '建案暫停，預算凍結' },
      ],
      items: [
        { description: '廣告看板主視覺設計（A 版）', quantity: 2, unit_price: 8000 },
        { description: '廣告看板主視覺設計（B 版）', quantity: 2, unit_price: 8000 },
        { description: '輸出規格整理',               quantity: 1, unit_price: 3000 },
      ],
    },
  ]

  const insQuote = db.prepare(`
    INSERT INTO quotes (client_id, title, issue_date, valid_days, notes, total, status, version)
    VALUES (@client_id, @title, @issue_date, @valid_days, @notes, @total, @status, @version)
  `)
  const insItem = db.prepare(
    'INSERT INTO quote_items (quote_id, description, quantity, unit_price) VALUES (@quote_id, @description, @quantity, @unit_price)'
  )
  const insLog = db.prepare(
    'INSERT INTO status_logs (quote_id, from_status, to_status, note, changed_at) VALUES (@quote_id, @from_status, @to_status, @note, @changed_at)'
  )

  db.transaction(() => {
    for (const q of QUOTES) {
      const total = q.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
      const qid = insQuote.run({
        client_id: clientIds[q.ci], title: q.title, issue_date: q.issue_date,
        valid_days: q.valid_days, notes: q.notes, total,
        status: q.status, version: q.version,
      }).lastInsertRowid

      for (const item of q.items) insItem.run({ quote_id: qid, ...item })

      for (const log of q.logs) {
        insLog.run({
          quote_id: qid,
          from_status: log.from ?? null,
          to_status:   log.to,
          note:        log.note ?? null,
          changed_at:  log.at,
        })
      }
    }
  })()

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM clients)     as clients,
      (SELECT COUNT(*) FROM projects)    as projects,
      (SELECT COUNT(*) FROM quotes)      as quotes,
      (SELECT COUNT(*) FROM quote_items) as items,
      (SELECT COUNT(*) FROM status_logs) as logs
  `).get()

  console.log(`[CRM] Demo seeded → clients:${stats.clients} projects:${stats.projects} quotes:${stats.quotes} items:${stats.items} logs:${stats.logs}`)
  return stats
}

module.exports = { seedDemo }
