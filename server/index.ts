import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './database';
import { createVideoRoutes } from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 静态文件服务 - 用于封面图片
const dataDir = path.join(process.cwd(), 'data');
const coversDir = path.join(dataDir, 'covers');
const previewsDir = path.join(dataDir, 'previews');

// 确保目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}
if (!fs.existsSync(previewsDir)) {
  fs.mkdirSync(previewsDir, { recursive: true });
}

app.use('/covers', express.static(coversDir));
app.use('/previews', express.static(previewsDir));

// 初始化数据库并启动服务器
async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    // 注册路由
    app.use('/api', createVideoRoutes());
    
    app.listen(PORT, () => {
      console.log(`后端服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
