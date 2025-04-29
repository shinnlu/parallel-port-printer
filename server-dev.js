const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 8080;

// 處理 AirControl Agent 的請求
app.post('/inform', (req, res) => {
  res.status(200).send('OK');
});

// 代理 API 請求到 Express 服務器
app.use('/command', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true
}));

// 提供靜態文件
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`開發服務器運行在 http://localhost:${PORT}`);
});