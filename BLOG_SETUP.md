# Blog 系統設置說明

## Phase 1 完成項目 ✅

### 已完成內容
1. ✅ 安裝所有必要套件
2. ✅ 建立 TypeScript 型別定義
3. ✅ 建立 Firebase CRUD 函數
4. ✅ 建立認證 Hook
5. ✅ 建立後台路由保護
6. ✅ 建立登入頁面與後台首頁

## 環境變數設定

請確認您的 `.env.local` 檔案包含以下變數：

```env
# Firebase 配置（應該已經設定好了）
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_DATABASE_URL=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...

# 管理員 Email（新增這一行，用於後台權限控制）
NEXT_PUBLIC_ADMIN_EMAIL=您的Google帳號@gmail.com
```

## Firebase Console 設定確認

請確認以下設定已完成：

### 1. Authentication
- ✅ 啟用 Google 登入
- ✅ 授權網域包含：
  - `localhost`
  - 您的 Vercel 網域（如：`yoursite.vercel.app`）

### 2. Firestore Database
- ✅ 建立資料庫（測試模式或生產模式）
- ✅ 規則設定（建議先使用測試模式，之後再調整）

```javascript
// 測試用規則（之後需要調整為更安全的規則）
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: true;
      allow write: if request.auth != null;
    }
  }
}
```

### 3. Storage
- ✅ 建立 Storage
- ✅ 規則設定

```javascript
// 測試用規則
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: true;
      allow write: if request.auth != null;
    }
  }
}
```

## 測試 Phase 1

### 1. 啟動開發伺服器
```bash
npm run dev
```

### 2. 訪問登入頁面
```
http://localhost:3000/admin/login
```

### 3. 測試登入功能
- 點擊「使用 Google 登入」按鈕
- 選擇您的 Google 帳號
- 登入成功後應該會導向 `/admin` 後台首頁

### 4. 檢查後台首頁
- 應該能看到四個管理卡片：
  - 文章管理
  - 分類管理
  - 標籤管理
  - 系列管理
- 右上角顯示您的 email
- 可以點擊「登出」按鈕

### 5. 測試路由保護
- 登出後嘗試訪問 `/admin`
- 應該會自動導向登入頁面

## 已建立的檔案結構

```
/app
├── types/
│   └── blog.ts                              # 型別定義
│
├── lib/
│   ├── firebase/
│   │   ├── posts.ts                         # 文章 CRUD
│   │   ├── categories.ts                    # 分類 CRUD
│   │   ├── tags.ts                          # 標籤 CRUD
│   │   ├── series.ts                        # 系列 CRUD
│   │   └── storage.ts                       # 圖片上傳
│   │
│   └── hooks/
│       └── useAuth.ts                       # 認證 Hook
│
├── components/
│   └── admin/
│       └── ProtectedRoute/                  # 路由保護組件
│
└── [locale]/
    └── admin/
        ├── layout.tsx                       # 後台 Layout（含權限控制）
        ├── page.tsx                         # 後台首頁
        ├── admin.module.scss
        └── login/
            ├── page.tsx                     # 登入頁面
            └── login.module.scss
```

## 下一步：Phase 2

確認 Phase 1 所有功能正常後，我們將進入 **Phase 2: 分類/標籤/系列管理**

### Phase 2 將建立：
- 分類管理頁面（新增、編輯、刪除、多語言）
- 標籤管理頁面
- 系列管理頁面

請測試 Phase 1 的功能，確認無誤後告訴我，我們就可以繼續進行！


