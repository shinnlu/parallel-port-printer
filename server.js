const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const iconv = require('iconv-lite');
const updateChecker = require('./check-update');

// 設定 .env 檔案路徑到 AppData 目錄
const envFilePath = path.join(
  os.homedir(),
  'AppData',
  'Local',
  'ParallelPortPrinter',
  '.env'
);

// 載入 .env 檔案
require('dotenv').config({ path: envFilePath });

const app = express();
const LISTEN_PORT = process.env.LISTEN_PORT || 3000;

const escResetStyle = Buffer.from([0x1B, 0x45, 0x00, 0x1D, 0x21, 0x00]);
const escInit = Buffer.from([0x1B, 0x40]); // 初始化
const escBoldOn = Buffer.from([0x1B, 0x45, 0x01]); // 加粗開啟
const escBoldOff = Buffer.from([0x1B, 0x45, 0x00]); // 加粗關閉
const escFontA = Buffer.from([0x1B, 0x4D, 0x00]); // 字型 A
const escFontB = Buffer.from([0x1B, 0x4D, 0x01]); // 字型 B
const escDouble = Buffer.from([0x1D, 0x21, 0x11]); // 雙倍高寬
const escDouble_off = Buffer.from([0x1D, 0x21, 0x00]); // 雙倍高寬關閉
const escAlignRight = Buffer.from([0x1B, 0x61, 0x02]); // 置右對齊
const escAlignJustify = Buffer.from([0x1B, 0x61, 0x03]); // 兩端對齊
const escAlignCenter = Buffer.from([0x1B, 0x61, 0x01]); // 置中對齊
const escAlignLeft = Buffer.from([0x1B, 0x61, 0x00]); // 左對齊
const escCut = Buffer.from([0x1D, 0x56, 0x00]); // 全切紙
const escCutPartial = Buffer.from([0x1D, 0x56, 0x01]); // 半切紙
const escLineFeed = Buffer.from([0x0A]); // 換行

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());
app.use(express.static(__dirname));

/*app.use(express.json({ limit: '1mb' })); // 限制請求大小
app.use(express.static(__dirname, {
  dotfiles: 'ignore',
  etag: true,
  index: 'index.html',  // 指定預設檔案為 index.html
  maxAge: '1h'
}));*/

// Input validation middleware
const validatePort = (req, res, next) => {
  const { port } = req.body;
  if (!port || !['LPT1', 'LPT2'].includes(port)) {
    return res.status(400).json({ error: 'Invalid printer port' });
  }
  next();
};

// API Routes
// Read settings
app.get('/settings', (req, res) => {
  res.json({
    PRINTER_PORT: process.env.PRINTER_PORT || 'LPT1'
  });
});

// Save settings
app.post('/settings', validatePort, (req, res) => {
  const { port } = req.body;
  const envContent = `PRINTER_PORT=${port}`;
  try {
    fs.writeFileSync(envFilePath, envContent, { encoding: 'utf8' });
    process.env.PRINTER_PORT = port;
    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Handle AirControl Agent requests
app.post('/inform', (req, res) => {
  res.status(200).send('OK');
});

// Command validation middleware
const validateCommand = (req, res, next) => {
  const { type, text, count, port } = req.body;

  if (!type || !['printLine', 'newline', 'cut'].includes(type)) {
    return res.status(400).json({ error: 'Invalid command type' });
  }

  if (type === 'printLine' && (!text || typeof text !== 'string' || text.length > 1000)) {
    return res.status(400).json({ error: 'Invalid text content' });
  }

  if (type === 'newline' && (count && (isNaN(count) || count < 1 || count > 50))) {
    return res.status(400).json({ error: 'Invalid line count' });
  }

  if (port && !['LPT1', 'LPT2'].includes(port)) {
    return res.status(400).json({ error: 'Invalid port' });
  }

  next();
};

// 檢查印表機狀態
function checkPrinterStatus(port) {
  return new Promise((resolve) => {
    const command = `mode ${port}`;
    exec(command, { encoding: 'buffer' }, (error, stdout, stderr) => {
      if (error) {
        console.error('Error querying printer status:', error);
        console.error('Error output:', stderr);
        const errorMessage = iconv.decode(stderr, 'cp950');
        console.error('Printer status check error:', errorMessage);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

app.post('/command', validateCommand, async (req, res) => {
  const { type, text, count, port } = req.body;
  const targetPort = port || process.env.PRINTER_PORT || 'LPT1';
  const realPort = '\\\\.\\' + targetPort;
  // 檢查印表機狀態
  const isPrinterReady = await checkPrinterStatus(targetPort);
  if (!isPrinterReady) {
    return res.json({ status: 'error', message: 'Printer is not ready. Please check if the printer is turned on and connected.' });
  }

  let buffer;

  try {
    switch (type) {
      case 'printLine':
        buffer = iconv.encode(text + '\n', 'big5');
        break;
      case 'newline':
        const n = Math.max(1, Math.min(parseInt(count) || 1, 50));
        buffer = Buffer.from('\n'.repeat(n));
        break;
      case 'cut':
        buffer = Buffer.from([0x1D, 0x56, 0x00]); // ESC/POS Full cut
        break;
    }
  } catch (error) {
    console.error('Error preparing buffer:', error);
    return res.status(500).json({ error: 'Failed to prepare print data' });
  }

  const tryWrite = () => {
    // 將 buffer 直接寫入 LPT 埠
    try {
      const lptStream = fs.createWriteStream(realPort, { flags: 'w' });
      lptStream.write(buffer);
      lptStream.end();
      lptStream.on('finish', () => {
        res.json({ message: `Sent to ${targetPort}, command type: ${type}` });
      });
      lptStream.on('error', (error) => {
        console.error('Error writing to LPT port:', error);
        res.status(500).json({ error: 'Transmission failed: Please check LPT Port settings' });
      });
    } catch (error) {
      console.error('Error writing to LPT port:', error);
      res.status(500).json({ error: 'Transmission failed: Please check LPT Port settings' });
    }
  };

  tryWrite();
});

app.post('/printer-status', async (req, res) => {
  const { port } = req.body;
  const targetPort = port || process.env.PRINTER_PORT || 'LPT1';
  const isPrinterReady = await checkPrinterStatus(targetPort);
  if (!isPrinterReady) {
    return res.json({ status: 'error', message: 'Printer is not ready. Please check if the printer is turned on and connected.' });
  }
  res.json({ status: 'success', message: 'Printer is ready' });
});

// 確保所有其他路由都返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(LISTEN_PORT, () => {
  console.log(`\x1b[31mParallel Port Printer Server\x1b[0m running at: http://localhost:${LISTEN_PORT}`);
  console.log('\x1b[33m請不要關閉這個視窗! 如果您想停止伺服器，請使用 Ctrl+C。\x1b[0m');
  console.log(`\x1b[32mLoaded PRINTER_PORT from .env: ${process.env.PRINTER_PORT}\x1b[0m`);
  // Start update checker
  updateChecker.startUpdateCheck();
});
