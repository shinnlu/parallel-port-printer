@echo off
echo 正在安裝印表機控制服務 (32位元)...

REM 使用 NSSM 安裝服務
nssm\nssm32.exe install PrinterControl "%~dp0start-server.bat"
nssm\nssm32.exe set PrinterControl DisplayName "印表機控制服務 (32位元)"
nssm\nssm32.exe set PrinterControl Description "自動啟動印表機控制服務 (32位元)"
nssm\nssm32.exe set PrinterControl Start SERVICE_AUTO_START
nssm\nssm32.exe set PrinterControl AppDirectory "%~dp0"

echo 服務安裝完成！
echo 請確保已經安裝了 Node.js 和所需的 npm 套件
echo 使用以下命令來管理服務：
echo - 啟動服務：net start PrinterControl
echo - 停止服務：net stop PrinterControl
echo - 移除服務：nssm\nssm32.exe remove PrinterControl confirm
pause