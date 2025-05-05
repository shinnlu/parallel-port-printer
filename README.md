# Parallel Port Printer Controller

## 專案說明
這是一個用於控制並行埠印表機的 Node.js 應用程式，支援 LPT1 和 LPT2 埠口。

## 功能特點
- 支援 LPT1/LPT2 印表機控制
- 文字列印功能
- 自動換行功能
- 紙張裁切功能
- 可設定預設印表機埠
- 自動更新功能
- Windows 服務安裝

## 系統需求
- Windows 作業系統
- Node.js 14.x 或以上版本
- 並行埠印表機（LPT1 或 LPT2）

## 安裝方式

### 方法一：使用安裝程式（推薦）
1. 下載最新版本的安裝程式：`ParallelPortPrinter-Setup.exe`
2. 執行安裝程式
3. 依照安裝精靈的指示完成安裝
4. 選擇是否建立桌面捷徑和開機自動啟動

### 方法二：手動安裝
1. 克隆專案：
   ```bash
   git clone https://github.com/shinnlu/parallel-port-printer.git
   cd parallel-port-printer
   ```

2. 安裝依賴：
   ```bash
   npm install
   ```

3. 安裝 Windows 服務：
   - 32位元系統：執行 `install-service-x86.bat`
   - 64位元系統：執行 `install-service-x64.bat`

## 使用方式
1. 啟動應用程式：
   - 如果使用安裝程式：從開始選單或桌面捷徑啟動
   - 如果手動安裝：執行 `start-server.bat`

2. 開啟瀏覽器訪問：
   ```
   http://localhost:3000
   ```

3. 在網頁介面中：
   - 選擇印表機埠（LPT1/LPT2）
   - 輸入要列印的文字
   - 點擊「列印一行文字」按鈕
   - 使用「插入換行」按鈕控制換行
   - 使用「裁切紙張」按鈕裁切紙張

## 設定說明
- 預設印表機埠設定會儲存在 `.env` 檔案中
- 可以透過網頁介面修改預設印表機埠
- 設定會自動儲存並在下次啟動時載入

## 自動更新
- 應用程式會自動檢查更新
- 當有新版本時，會顯示更新通知
- 可以選擇自動或手動更新

## 管理服務
- 啟動服務：`net start PrinterControl`
- 停止服務：`net stop PrinterControl`
- 移除服務：
  - 32位元系統：`nssm\nssm32.exe remove PrinterControl confirm`
  - 64位元系統：`nssm\nssm64.exe remove PrinterControl confirm`

## 故障排除
如果遇到問題，請檢查：
1. Node.js 是否正確安裝
2. 專案依賴是否已安裝
3. 印表機埠是否正確連接
4. 檢查 Windows 事件檢視器中的錯誤日誌
5. 確認使用了正確版本的安裝腳本（32位元/64位元）

## 開發相關
1. 開發模式啟動：
   ```bash
   npm run dev
   ```

2. 生產模式啟動：
   ```bash
   npm start
   ```

## 版本歷史
- v1.0.0 (2024-03-xx)
  - 初始版本
  - 基本列印功能
  - 自動更新功能
  - Windows 服務支援

## 授權說明
本專案採用 MIT 授權條款。詳見 [LICENSE](LICENSE) 檔案。

## 貢獻指南
1. Fork 本專案
2. 建立你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟一個 Pull Request

## 聯絡方式
- 作者：Shinn Lu
- 電子郵件：你的電子郵件
- 專案連結：https://github.com/shinnlu/parallel-port-printer