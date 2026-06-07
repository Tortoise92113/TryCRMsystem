# Notion 整合設定指南

本指南說明如何將 Freelance CRM 與 Notion 連接，實現客戶資料與專案狀態的雙向同步。

---

## 目錄

1. [建立 Notion Integration（取得 API Token）](#1-建立-notion-integration)
2. [建立客戶 Database 並設定欄位](#2-建立客戶-database)
3. [建立專案 Database 並設定欄位](#3-建立專案-database)
4. [將 Integration 連接到 Database](#4-連接-integration-到-database)
5. [在 CRM 設定頁面填入憑證](#5-在-crm-填入設定)
6. [執行同步](#6-執行同步)
7. [常見問題](#7-常見問題)

---

## 1. 建立 Notion Integration

### 步驟

1. 打開瀏覽器，前往 [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)

2. 點擊右上角「**+ New integration**」按鈕

3. 填寫以下資訊：
   - **Name**：輸入一個名稱，例如 `Freelance CRM Sync`
   - **Associated workspace**：選擇你要同步的工作區
   - **Logo**：可選，可跳過

4. 在「**Capabilities**」區塊，確認以下權限已勾選：
   - ✅ Read content
   - ✅ Update content
   - ✅ Insert content

5. 點擊「**Submit**」送出

6. 建立成功後，你會看到「**Internal Integration Token**」  
   格式為：`secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

7. 點擊「**Copy**」複製此 Token，**妥善保管，不要分享給任何人**

> ⚠️ **注意**：此 Token 只會顯示一次，建議立即貼到記事本備份

---

## 2. 建立客戶 Database

### 2-1. 在 Notion 新增一個 Page

1. 在 Notion 左側欄點擊「**+ New page**」
2. 輸入頁面標題，例如：`CRM 客戶資料庫`

### 2-2. 建立 Database

1. 在頁面內輸入 `/database`，選擇「**Database - Full page**」
2. 資料庫標題輸入：`Clients`

### 2-3. 設定欄位（Properties）

依序新增以下欄位（點擊欄位標題旁的「**+**」按鈕）：

| 欄位名稱 | 欄位類型 | 說明 |
|---------|---------|------|
| `Name` | Title（預設） | 客戶姓名（**不要刪除或更名**） |
| `Company` | Text | 公司名稱 |
| `Email` | Email | 電子信箱 |
| `Phone` | Phone | 電話號碼 |
| `Notes` | Text | 備註 |

> ✅ 確認欄位名稱與上表**完全一致**（區分大小寫），否則同步會失敗

### 2-4. 取得 Database ID

1. 在瀏覽器網址列，找到類似以下的網址：
   ```
   https://www.notion.so/yourworkspace/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
   ```
2. 其中 `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 就是 **Database ID**（32 個字元）
3. 複製並記下這串 ID

---

## 3. 建立專案 Database

### 3-1. 新增另一個 Page

1. 點擊「**+ New page**」
2. 輸入頁面標題：`CRM 專案資料庫`

### 3-2. 建立 Database

1. 輸入 `/database`，選擇「**Database - Full page**」
2. 標題輸入：`Projects`

### 3-3. 設定欄位

| 欄位名稱 | 欄位類型 | 選項設定 |
|---------|---------|---------|
| `Name` | Title（預設） | 專案名稱（**不要更名**） |
| `Client` | Text | 客戶名稱 |
| `Status` | Select | 新增四個選項（見下方） |
| `Amount` | Number | 格式選「Number」 |
| `Deadline` | Date | — |

**Status 欄位選項**（依序新增，名稱須完全一致）：

| 選項名稱 | 建議顏色 |
|---------|---------|
| `negotiating` | 黃色 |
| `in_progress` | 藍色 |
| `completed` | 綠色 |
| `cancelled` | 灰色 |

> 🔍 同步時會以英文值傳入，在 CRM 介面則顯示中文

### 3-4. 取得專案 Database ID

同步驟 2-4，從網址列複製此資料庫的 Database ID

---

## 4. 連接 Integration 到 Database

**每個 Database 都必須個別連接**，否則 API 無法存取。

### 客戶 Database

1. 打開「Clients」資料庫頁面
2. 點擊右上角「**⋯**」（更多選項）
3. 選擇「**Connections**」（或「連線」）
4. 搜尋並選擇你在步驟 1 建立的 Integration（`Freelance CRM Sync`）
5. 點擊「**Confirm**」確認

### 專案 Database

重複上述步驟，對「Projects」資料庫執行相同操作。

> ✅ 連接成功後，資料庫頁面右上角會顯示 Integration 圖示

---

## 5. 在 CRM 填入設定

1. 打開 **Freelance CRM** 應用程式
2. 點擊左側欄「⚙️ **設定**」
3. 找到「**Notion 整合**」區塊
4. 填入以下資訊：

   **Notion API Token**
   ```
   secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   （貼上步驟 1 取得的 Token）

   **Notion Database ID**
   ```
   xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   （貼上步驟 2-4 取得的客戶 Database ID）

5. 點擊「**儲存設定**」

> 📌 目前 CRM 系統同步對象為**客戶 Database**。若需同步專案，可在設定頁面未來版本中新增第二個 Database ID。

---

## 6. 執行同步

1. 確認設定已儲存後，在設定頁面找到「**同步客戶至 Notion**」按鈕
2. 點擊按鈕，等待同步完成
3. 成功後會顯示：`同步完成 (n)`，其中 n 為同步筆數
4. 前往 Notion 的「Clients」資料庫，確認資料是否已匯入

### 同步邏輯說明

| 情況 | 行為 |
|------|------|
| 客戶在 Notion 中**不存在** | 建立新的 Page |
| 客戶在 Notion 中**已存在**（有 notion_id） | 更新現有 Page |
| 在 Notion 中**手動刪除**的資料 | 下次同步時重新建立 |

---

## 7. 常見問題

### Q：同步後顯示 Error，怎麼辦？

**可能原因與解法：**

| 錯誤訊息 | 原因 | 解法 |
|---------|------|------|
| `Notion credentials not configured` | Token 或 Database ID 未填 | 回到設定頁面確認並儲存 |
| `object_not_found` | Database ID 錯誤 | 重新從網址列複製 32 碼 ID |
| `Unauthorized` | Token 無效或已過期 | 重新到 Notion 建立 Integration |
| `restricted_resource` | Integration 未連接到 Database | 重複步驟 4 |

### Q：Database ID 在哪裡找？

網址格式：
```
https://www.notion.so/[workspace]/[DATABASE_ID]?v=[VIEW_ID]
```
取問號（`?`）之前、最後一個斜線（`/`）之後的那段，共 32 碼。

### Q：可以同步多個客戶嗎？

可以，點擊「同步客戶至 Notion」會一次同步**所有**客戶資料。

### Q：Notion 的資料會同步回 CRM 嗎？

目前版本為**單向同步**（CRM → Notion）。雙向同步需要設定 Notion Webhook，預計未來版本支援。

---

## 欄位對應總覽

### 客戶（Clients）

| CRM 欄位 | Notion 欄位 | Notion 類型 |
|---------|------------|------------|
| 姓名 | `Name` | Title |
| 公司 | `Company` | Text |
| Email | `Email` | Email |
| 電話 | `Phone` | Phone |
| 備註 | `Notes` | Text |

### 專案（Projects）— 未來版本

| CRM 欄位 | Notion 欄位 | Notion 類型 |
|---------|------------|------------|
| 專案名稱 | `Name` | Title |
| 客戶 | `Client` | Text |
| 狀態 | `Status` | Select |
| 金額 | `Amount` | Number |
| 截止日 | `Deadline` | Date |

---

*最後更新：2026-05-16*
