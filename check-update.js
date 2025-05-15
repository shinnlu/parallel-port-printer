const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const GITHUB_REPO = 'shinnlu/parallel-port-printer';
const CHECK_INTERVAL = 1000 * 60 * 60; // 每小時檢查一次

// 設定更新記錄檔案路徑到 AppData 目錄
const UPDATE_RECORD_FILE = path.join(
  os.homedir(),
  'AppData',
  'Local',
  'ParallelPortPrinter',
  'update-record.json'
);

// 確保 AppData 目錄存在
function ensureAppDataDir() {
  const appDataDir = path.dirname(UPDATE_RECORD_FILE);
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
}

// 從 package.json 讀取當前版本號
function getCurrentVersion() {
  try {
    const packageData = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    return packageData.version;
  } catch (error) {
    console.error('Error reading package.json:', error);
    return '1.0.0'; // 如果讀取失敗，返回預設版本號
  }
}

// 讀取更新記錄
function getUpdateRecord() {
  try {
    ensureAppDataDir();
    if (fs.existsSync(UPDATE_RECORD_FILE)) {
      return JSON.parse(fs.readFileSync(UPDATE_RECORD_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error reading update record:', error);
  }
  return {
    lastCheck: '',
    lastDownloadedVersion: '',
    lastDownloadTime: ''
  };
}

// 更新記錄
function updateRecord(version) {
  try {
    ensureAppDataDir();
    const record = getUpdateRecord();
    record.lastCheck = new Date().toISOString();
    record.lastDownloadedVersion = version;
    record.lastDownloadTime = new Date().toISOString();
    fs.writeFileSync(UPDATE_RECORD_FILE, JSON.stringify(record, null, 2));
  } catch (error) {
    console.error('Error updating record:', error);
  }
}

function getLatestVersion() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'Node.js'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          resolve({
            version: release.tag_name.replace('v', ''),
            downloadUrl: release.assets[0].browser_download_url
          });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function downloadUpdate(downloadUrl) {
  return new Promise((resolve, reject) => {
    // 確保 installer 目錄存在
    const installerDir = path.join(__dirname, 'installer');
    if (!fs.existsSync(installerDir)) {
      fs.mkdirSync(installerDir);
    }

    const installerPath = path.join(installerDir, 'ParallelPortPrinter-Setup.exe');
    const file = fs.createWriteStream(installerPath);

    console.log('開始下載更新檔...');
    console.log('下載網址:', downloadUrl);

    const request = https.get(downloadUrl, (response) => {
      // 處理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log('重定向到:', redirectUrl);
        file.close();
        fs.unlink(installerPath, () => {});
        // 遞迴調用下載函數
        downloadUpdate(redirectUrl).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下載失敗: HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = (downloadedSize / totalSize * 100).toFixed(2);
        process.stdout.write(`\r下載進度: ${progress}%`);
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('\n下載完成！');
        resolve(installerPath);
      });
    });

    request.on('error', (err) => {
      fs.unlink(installerPath, () => {}); // 刪除不完整的檔案
      reject(new Error(`下載請求失敗: ${err.message}`));
    });

    file.on('error', (err) => {
      fs.unlink(installerPath, () => {}); // 刪除不完整的檔案
      reject(new Error(`檔案寫入失敗: ${err.message}`));
    });
  });
}

function openFolder(folderPath) {
  const command = process.platform === 'win32' ?
    `start "" "${folderPath}"` :
    `open "${folderPath}"`;

  exec(command, (error) => {
    if (error) {
      console.error('Error opening folder:', error);
    }
  });
}

async function checkForUpdates() {
  try {
    console.log('Checking for updates...');
    const currentVersion = getCurrentVersion();
    const latest = await getLatestVersion();
    const record = getUpdateRecord();

    if (latest.version > currentVersion) {
      console.log(`\n發現新版本 ${latest.version} (當前版本: ${currentVersion})`);

      // 檢查是否已經下載過這個版本
      const installerPath = path.join(__dirname, 'installer', 'ParallelPortPrinter-Setup.exe');
      if (record.lastDownloadedVersion === latest.version && fs.existsSync(installerPath)) {
        console.log('\n此版本已下載過，無需重新下載。');
        console.log(`\n安裝檔位置：${installerPath}\n請關閉程式後執行安裝檔進行更新。`);
        openFolder(path.dirname(installerPath));
        updateRecord(latest.version);
        return;
      }

      console.log('\n正在下載更新...');
      try {
        const downloadedPath = await downloadUpdate(latest.downloadUrl);
        console.log('下載完成！');
        console.log(`\n安裝檔位置：${downloadedPath}\n請關閉程式後執行安裝檔進行更新。`);

        // 自動打開安裝檔所在資料夾
        openFolder(path.dirname(downloadedPath));

        // 更新記錄
        updateRecord(latest.version);
      } catch (error) {
        console.error('下載更新失敗:', error);
      }
    } else {
      console.log('No updates available. Current version:', currentVersion);
      // 更新最後檢查時間
      updateRecord(currentVersion);
    }
  } catch (error) {
    console.error('Update check failed:', error);
  }
}

function startUpdateCheck() {
  // 立即執行一次檢查
  checkForUpdates();

  // 設定定期檢查
  setInterval(checkForUpdates, CHECK_INTERVAL);
}

module.exports = {
  startUpdateCheck
};