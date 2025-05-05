const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const VERSION_FILE = 'https://raw.githubusercontent.com/shinnlu/parallel-port-printer/refs/heads/master/version.json';
const CURRENT_VERSION = require('./package.json').version;

function checkUpdate() {
  https.get(VERSION_FILE, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        // 移除 BOM 和空白字符
        data = data.trim().replace(/^\uFEFF/, '');

        // 檢查是否為有效的 JSON 字串
        if (!data.startsWith('{') || !data.endsWith('}')) {
          throw new Error('Invalid JSON format');
        }

        const latest = JSON.parse(data);

        // 驗證必要的欄位
        if (!latest.version || !latest.changelog || !latest.downloadUrl) {
          throw new Error('Missing required fields in version.json');
        }

        if (latest.version > CURRENT_VERSION) {
          console.log('發現新版本：', latest.version);
          console.log('更新說明：', latest.changelog);
          console.log('下載網址：', latest.downloadUrl);

          // 可以選擇自動下載並執行更新
          if (latest.autoUpdate) {
            downloadUpdate(latest.downloadUrl);
          }
        } else {
          console.log('目前已經是最新版本');
        }
      } catch (e) {
        console.error('檢查更新失敗：', e.message);
        console.error('收到的資料：', data);
      }
    });
  }).on('error', (e) => {
    console.error('檢查更新失敗：', e.message);
  });
}

function downloadUpdate(url) {
  const installer = path.join(process.env.TEMP, 'update-installer.exe');
  https.get(url, (res) => {
    if (res.statusCode !== 200) {
      console.error('下載更新失敗：HTTP', res.statusCode);
      return;
    }

    const file = fs.createWriteStream(installer);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      exec(installer, (err) => {
        if (err) console.error('執行更新失敗：', err.message);
      });
    });
  }).on('error', (e) => {
    console.error('下載更新失敗：', e.message);
  });
}

// 導出函數
module.exports = {
  checkUpdate,
  startUpdateCheck: function() {
    // 每小時檢查一次更新
    setInterval(checkUpdate, 3600000);
    // 立即檢查一次
    checkUpdate();
  }
};