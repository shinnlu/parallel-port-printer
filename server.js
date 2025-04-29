const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const app = express();
const PORT = 3000;
const tempFile = path.join(__dirname, 'temp_to_print.bin');

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());

// 處理 AirControl Agent 的請求
app.post('/inform', (req, res) => {
  res.status(200).send('OK');
});

app.post('/command', (req, res) => {
  const { type, text, count, port } = req.body;

  // ✅ 限制只能使用 LPT1 或 LPT2
  const targetPort = (port === 'LPT2') ? 'LPT2' : 'LPT1';

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
      return res.status(400).send('未知的指令類型');
  }

  fs.writeFileSync(tempFile, buffer);

  const command = `copy /B "${tempFile}" ${targetPort}`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(stderr);
      return res.status(500).send('傳送失敗：' + stderr);
    }
    res.send(`已傳送至 ${targetPort}，指令類型：${type}`);
  });
});

app.listen(PORT, () => {
  console.log(`伺服器執行中：http://localhost:${PORT}`);
});
