const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const VERSION_FILE = 'https://raw.githubusercontent.com/shinnlu/parallel-port-printer/blob/master/version.json';
const CURRENT_VERSION = require('./package.json').version;

function checkUpdate() {
  https.get(VERSION_FILE, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const latest = JSON.parse(data);
        if (latest.version > CURRENT_VERSION) {
          console.log('發現新版本：', latest.version);
          console.log('更新說明：', latest.changelog);
          console.log('下載網址：', latest.downloadUrl);

          // 可以選擇自動下載並執行更新
          if (latest.autoUpdate) {
            downloadUpdate(latest.downloadUrl);
          }
        }
      } catch (e) {
        console.error('檢查更新失敗：', e);
      }
    });
  }).on('error', (e) => {
    console.error('檢查更新失敗：', e);
  });
}

function downloadUpdate(url) {
  const installer = path.join(process.env.TEMP, 'update-installer.exe');
  https.get(url, (res) => {
    const file = fs.createWriteStream(installer);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      exec(installer, (err) => {
        if (err) console.error('執行更新失敗：', err);
      });
    });
  });
}

// 每小時檢查一次更新
setInterval(checkUpdate, 3600000);
checkUpdate();