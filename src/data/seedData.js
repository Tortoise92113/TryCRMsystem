// Demo seed data — run via:  node scripts/seed.js

const clients = [
  {
    name: '林雅婷',
    company: '映見室內設計有限公司',
    email: 'yating.lin@mirrorsight.tw',
    phone: '0912345678',
    notes: '偏好極簡北歐風格，預算彈性大，溝通管道以 Line 為主',
  },
  {
    name: '陳俊宏',
    company: '科技樹數位行銷',
    email: 'junhong.chen@techtree.com.tw',
    phone: '0922111222',
    notes: '電商客戶，長期合作，每季固定需要廣告素材與 Landing Page 設計',
  },
  {
    name: 'Sarah Wu',
    company: 'BrightLeaf Organic Co.',
    email: 'sarah.wu@brightleaf.com',
    phone: '0933456789',
    notes: '美商台灣分公司，需英文版設計稿，報價以美金計算後換算台幣',
  },
  {
    name: '黃志偉',
    company: '悅讀文創工作室',
    email: 'chihwei.huang@yuedu-studio.com',
    phone: '0955678901',
    notes: '出版社客戶，主要需求為書籍封面與電子書排版，付款週期 30 天',
  },
  {
    name: '吳明哲',
    company: '鼎立建設股份有限公司',
    email: 'mingche.wu@dingli-construction.tw',
    phone: '0988765432',
    notes: '建設公司，需要建案 DM、VR 導覽腳本、接待中心視覺，案子規模大',
  },
  {
    name: '許佳蓉',
    company: '芳漾美學診所',
    email: 'chia.hsu@fangyang-clinic.com',
    phone: '0966234567',
    notes: '醫美診所，需月費社群內容服務，每月固定 8 則貼文 + 4 則限時',
  },
]

// Dates relative to 2026-05-16
const projects = [
  // 洽談中 (negotiating) × 2
  {
    clientIndex: 0, // 林雅婷
    title: '信義區豪宅客廳空間視覺規劃',
    status: 'negotiating',
    amount: 85000,
    deadline: '2026-06-20',
    description: '750 坪豪宅公共空間，包含 3D 模擬圖與材質提案',
  },
  {
    clientIndex: 4, // 吳明哲
    title: '青埔新案接待中心視覺系統',
    status: 'negotiating',
    amount: 150000,
    deadline: '2026-07-01',
    description: '建案識別系統設計、DM 印刷品、接待中心大圖輸出',
  },

  // 進行中 (in_progress) × 2
  {
    clientIndex: 1, // 陳俊宏
    title: '夏季電商促銷廣告素材製作',
    status: 'in_progress',
    amount: 45000,
    deadline: '2026-05-30',
    description: 'FB/IG/Google 三平台廣告橫幅，共 24 個尺寸',
  },
  {
    clientIndex: 5, // 許佳蓉
    title: '六月份診所社群內容月包',
    status: 'in_progress',
    amount: 28000,
    deadline: '2026-06-05',
    description: '8 則貼文文案與設計、4 則限時動態、1 則 Reels 腳本',
  },

  // 已完成 (completed) × 3
  {
    clientIndex: 2, // Sarah Wu
    title: 'BrightLeaf 品牌識別系統重塑',
    status: 'completed',
    amount: 120000,
    deadline: '2026-04-30',
    description: 'Logo、色彩系統、字型規範、品牌手冊 PDF',
  },
  {
    clientIndex: 3, // 黃志偉
    title: '《城市光廊》散文集封面設計',
    status: 'completed',
    amount: 18000,
    deadline: '2026-04-10',
    description: '書籍正封、封底、書背設計，含 EPUB 封面轉檔',
  },
  {
    clientIndex: 0, // 林雅婷
    title: '大安區咖啡廳品牌視覺',
    status: 'completed',
    amount: 55000,
    deadline: '2026-03-15',
    description: 'Logo、菜單設計、包裝貼紙、名片、店頭招牌規格輸出',
  },

  // 已取消 (cancelled) × 2
  {
    clientIndex: 4, // 吳明哲
    title: '淡水輕軌沿線廣告看板設計',
    status: 'cancelled',
    amount: 35000,
    deadline: '2026-02-28',
    description: '因建案暫停銷售，客戶主動取消',
  },
  {
    clientIndex: 1, // 陳俊宏
    title: '品牌週年慶 Microsite 開發',
    status: 'cancelled',
    amount: 75000,
    deadline: '2026-03-31',
    description: '預算重新分配，需求已轉移至其他廠商',
  },
]

const quotes = [
  {
    clientIndex: 0, // 林雅婷
    title: '信義豪宅空間視覺企劃報價單',
    issue_date: '2026-05-10',
    valid_days: 30,
    notes: '報價含兩次修改，第三次起加收 10%',
    items: [
      { description: '空間概念提案簡報（含 3D 示意圖）', quantity: 1, unit_price: 25000 },
      { description: '材質搭配情境圖（4 種方案）', quantity: 4, unit_price: 8000 },
      { description: '施工圖說明文件整理', quantity: 1, unit_price: 12000 },
      { description: '最終定案輸出（大圖 A0 + PDF）', quantity: 1, unit_price: 5000 },
    ],
  },
  {
    clientIndex: 1, // 陳俊宏
    title: '夏季促銷廣告素材報價單',
    issue_date: '2026-05-05',
    valid_days: 14,
    notes: '急件處理費已含入單價',
    items: [
      { description: 'FB/IG 貼文主視覺（1080×1080）', quantity: 6, unit_price: 2500 },
      { description: 'FB/IG 限時動態（1080×1920）', quantity: 6, unit_price: 2000 },
      { description: 'Google Display Banner（6 種尺寸）', quantity: 2, unit_price: 4500 },
      { description: '設計調整（3 輪）', quantity: 1, unit_price: 3000 },
    ],
  },
  {
    clientIndex: 3, // 黃志偉
    title: '《城市光廊》書籍設計報價單',
    issue_date: '2026-03-20',
    valid_days: 21,
    notes: '已結案，此報價單存檔用',
    items: [
      { description: '書籍正封面設計', quantity: 1, unit_price: 12000 },
      { description: '封底與書背設計', quantity: 1, unit_price: 4000 },
      { description: 'EPUB 封面尺寸轉換', quantity: 1, unit_price: 2000 },
    ],
  },
]

module.exports = { clients, projects, quotes }
