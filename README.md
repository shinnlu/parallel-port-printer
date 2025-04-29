# 印表機控制服務部署說明

## 前置需求
1. 安裝 Node.js (建議版本 14.x 或以上)
2. 安裝 NSSM (Non-Sucking Service Manager)
   - 下載地址：https://nssm.cc/download
   - 解壓縮後將 nssm32.exe 和 nssm64.exe 複製到專案目錄下的 nssm 資料夾中

## 部署步驟
1. 複製整個專案資料夾到目標電腦
2. 在專案目錄中執行以下命令安裝依賴：
   ```
   npm install
   ```
3. 根據系統架構選擇對應的安裝腳本：
   - 32位元系統：執行 `install-service-x86.bat`
   - 64位元系統：執行 `install-service-x64.bat`
4. 服務會自動在開機時啟動

## 管理服務
- 啟動服務：`net start PrinterControl`
- 停止服務：`net stop PrinterControl`
- 移除服務：
  - 32位元系統：`nssm\nssm32.exe remove PrinterControl confirm`
  - 64位元系統：`nssm\nssm64.exe remove PrinterControl confirm`

## 訪問控制面板
安裝完成後，可以通過以下地址訪問控制面板：
- http://localhost:3000

## 故障排除
如果服務無法啟動，請檢查：
1. Node.js 是否正確安裝
2. 專案依賴是否已安裝
3. 檢查 Windows 事件檢視器中的錯誤日誌
4. 確認使用了正確版本的安裝腳本（32位元/64位元）