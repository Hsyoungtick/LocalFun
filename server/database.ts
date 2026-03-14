import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'videos.db');

// 确保data目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 确保covers目录存在
const coversDir = path.join(dataDir, 'covers');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

const db = new Database(dbPath);

// 初始化数据库表
export async function initDatabase() {
  // 创建作者表
  db.exec(`
    CREATE TABLE IF NOT EXISTS authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      avatar TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建分类表
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建视频表
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL UNIQUE,
      file_size INTEGER,
      duration REAL,
      width INTEGER,
      height INTEGER,
      thumbnail TEXT,
      previews TEXT,
      author_id INTEGER,
      category_id INTEGER,
      description TEXT,
      view_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      file_modified_at DATETIME,
      FOREIGN KEY (author_id) REFERENCES authors(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // 添加 previews 列（如果不存在）
  try {
    db.exec(`ALTER TABLE videos ADD COLUMN previews TEXT`);
  } catch (e) {
    // 列已存在，忽略错误
  }

  // 创建视频路径配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 插入默认分类
  const defaultCategories = ['动画', '电影', '游戏', '音乐', '科技', '纪录片', '美食', '生活', 'Vlog', '其他'];
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  
  for (const category of defaultCategories) {
    insertCategory.run(category);
  }

  console.log('数据库表创建完成');
}

export default db;
