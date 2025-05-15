const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const updateChecker = require('./check-update');
require('dotenv').config();

const app = express();
const LISTEN_PORT = process.env.LISTEN_PORT || 3000;

// Path for tmp directory
const TMP_DIR = path.join(__dirname, 'tmp');

// Ensure tmp directory exists with proper permissions
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { mode: 0o755 });
}

// Function to get temporary filename
const getTempFileName = () => {
  return path.join(TMP_DIR, `print_${Date.now()}_${Math.random().toString(36).substring(7)}.bin`);
};

// Function to clean up temporary files
const cleanupTempFiles = () => {
  try {
    const files = fs.readdirSync(TMP_DIR);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(TMP_DIR, file);
      // Delete files older than 1 hour
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > 3600000) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (error) {
    console.error('Error cleaning up temporary files:', error);
  }
};

// Clean up temporary files every hour
setInterval(cleanupTempFiles, 3600000);

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
    fs.writeFileSync('.env', envContent);
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
    console.log(command);
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
  const targetPort = (port === 'LPT2') ? 'LPT2' : 'LPT1';
  const tempFile = getTempFileName();

  // 檢查印表機狀態
  const isPrinterReady = await checkPrinterStatus(targetPort);
  if (!isPrinterReady) {
    return res.status(503).json({ error: 'Printer is not ready. Please check if the printer is turned on and connected.' });
  }

  let buffer;

  try {
    switch (type) {
      case 'printLine':
        buffer = iconv.encode(text + '\n', 'big5');
        break;
      case 'newline':
        const n = Math.max(1, Math.min(parseInt(count) || 1, 50));
        buffer = Buffer.from('\n'.repeat(n), 'utf8');
        break;
      case 'cut':
        buffer = Buffer.from([0x1D, 0x56, 0x00]); // ESC/POS Full cut
        break;
    }
  } catch (error) {
    console.error('Error preparing buffer:', error);
    return res.status(500).json({ error: 'Failed to prepare print data' });
  }

  const maxRetries = 3;
  let currentTry = 0;

  const tryWriteFile = () => {
    try {
      fs.writeFileSync(tempFile, buffer, { flag: 'w', mode: 0o600 });
      return true;
    } catch (error) {
      console.error(`Write failed, attempt ${currentTry + 1}, error:`, error);
      return false;
    }
  };

  const tryWrite = () => {
    if (currentTry >= maxRetries) {
      return res.status(500).json({ error: 'Unable to write temporary file, please try again later' });
    }

    if (tryWriteFile()) {
      const command = `copy /B "${tempFile}" ${targetPort}`;
      console.log(command);

      // 設置超時
      const timeout = setTimeout(() => {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (e) {
          console.error('Error cleaning up temp file on timeout:', e);
        }
        res.status(504).json({ error: 'Print command timed out. Please check printer connection.' });
      }, 5000); // 5 秒超時

      exec(command, { encoding: 'buffer' }, (error, stdout, stderr) => {
        clearTimeout(timeout);
        // Clean up temporary file
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (e) {
          console.error('Unable to delete temporary file:', e);
        }

        if (error) {
          const errorMessage = iconv.decode(stderr, 'cp950');
          console.error('Error message:', errorMessage);
          return res.status(500).json({ error: 'Transmission failed: Please check LPT Port settings' });
        }

        res.json({ message: `Sent to ${targetPort}, command type: ${type}` });
      });
    } else {
      currentTry++;
      setTimeout(tryWrite, 100);
    }
  };

  tryWrite();
});

app.post('/printer-status', async (req, res) => {
  const { port } = req.body;
  const targetPort = port || process.env.PRINTER_PORT || 'LPT1';

  const buffer = Buffer.from([0x1D, 0x28, 0x41]); // ESC ( A 指令
  const tempFile = getTempFileName();

  try {
    fs.writeFileSync(tempFile, buffer, { flag: 'w', mode: 0o600 });
    const command = `copy /B "${tempFile}" ${targetPort}`;
    console.log(`Executing command: ${command}`);

    exec(command, { encoding: 'buffer' }, (error, stdout, stderr) => {
      // Clean up temporary file
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (e) {
        console.error('Unable to delete temporary file:', e);
      }

      if (error) {
        // Handle error
        // if error contains "Error: Command failed:" then it's printer not ready
        if (error.message.includes('Command failed:')) {
          console.error('Printer not ready or command failed:', error);
          return res.status(503).json({ status: 'error', message: 'Printer not ready or command failed' });
        }
        //console.error('Error executing command:', error);
        const errorMessage = iconv.decode(stderr, 'cp950');
        console.error('Error querying printer status:', errorMessage);
        return res.status(500).json({ status: 'error', message: errorMessage });
      }else{
        // const outputMessage = iconv.decode(stdout, 'cp950');
        // console.log('Printer status output:', outputMessage);
        // res.json({ status: 'success', message: outputMessage });
        res.json({ status: 'success', message: 'Printer is ready' });
      }
    });
  } catch (error) {
    console.error('Error preparing printer status query:', error);
    res.status(500).json({ status: 'error', message: 'Failed to prepare printer status query' });
  }
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
  console.log(`Server running at: http://localhost:${LISTEN_PORT}`);
  // Clean up old temporary files on startup
  cleanupTempFiles();
  // Start update checker
  updateChecker.startUpdateCheck();
});
