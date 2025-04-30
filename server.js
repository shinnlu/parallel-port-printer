const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Path for tmp directory
const TMP_DIR = path.join(__dirname, 'tmp');

// Ensure tmp directory exists
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR);
}

// Function to get temporary filename
const getTempFileName = () => {
  return path.join(TMP_DIR, `print_${Date.now()}.bin`);
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

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());
app.use(express.static(__dirname));

// Read settings
app.get('/settings', (req, res) => {
  res.json({
    DEFAULT_PORT: process.env.DEFAULT_PORT || 'LPT1'
  });
});

// Save settings
app.post('/settings', (req, res) => {
  const { port } = req.body;
  if (!port || !['LPT1', 'LPT2'].includes(port)) {
    return res.status(400).send('Invalid printer port');
  }

  const envContent = `DEFAULT_PORT=${port}`;
  fs.writeFileSync('.env', envContent);
  process.env.DEFAULT_PORT = port;
  res.send('Settings saved');
});

// Handle AirControl Agent requests
app.post('/inform', (req, res) => {
  res.status(200).send('OK');
});

app.post('/command', (req, res) => {
  const { type, text, count, port } = req.body;
  const targetPort = (port === 'LPT2') ? 'LPT2' : 'LPT1';
  const tempFile = getTempFileName();

  let buffer;

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
    default:
      return res.status(400).send('Unknown command type');
  }

  const maxRetries = 3;
  let currentTry = 0;

  const tryWriteFile = () => {
    try {
      fs.writeFileSync(tempFile, buffer, { flag: 'w' });
      return true;
    } catch (error) {
      console.error(`Write failed, attempt ${currentTry + 1}, error:`, error);
      return false;
    }
  };

  const tryWrite = () => {
    if (currentTry >= maxRetries) {
      return res.status(500).send('Unable to write temporary file, please try again later');
    }

    if (tryWriteFile()) {
      const command = `copy /B "${tempFile}" ${targetPort}`;
      exec(command, (error, stdout, stderr) => {
        // Clean up temporary file
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          console.error('Unable to delete temporary file:', e);
        }

        if (error) {
          console.error('Error message:', stderr);
          return res.status(500).send('Transmission failed: Please check LPT Port settings');
        }

        res.send(`Sent to ${targetPort}, command type: ${type}`);
      });
    } else {
      currentTry++;
      setTimeout(tryWrite, 100);
    }
  };

  tryWrite();
});

app.listen(PORT, () => {
  console.log(`Server running at: http://localhost:${PORT}`);
  // Clean up old temporary files on startup
  cleanupTempFiles();
});
