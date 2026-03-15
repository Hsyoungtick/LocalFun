import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
export const dbPath = path.join(dataDir, 'videos.db');

// 确保data目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 确保covers目录存在
const coversDir = path.join(dataDir, 'covers');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

// 确保previews目录存在
const previewsDir = path.join(dataDir, 'previews');
if (!fs.existsSync(previewsDir)) {
  fs.mkdirSync(previewsDir, { recursive: true });
}

// 获取当前数据库实例
export function getDb(): Database.Database {
  return db;
}

// 内部数据库实例
let db: Database.Database = new Database(dbPath);

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
      author_id INTEGER,
      category_id INTEGER,
      description TEXT,
      view_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      file_modified_at DATETIME,
      FOREIGN KEY (author_id) REFERENCES authors(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // 创建喜欢帧表
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorite_frames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL,
      time_seconds REAL NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (video_id) REFERENCES videos(id)
    )
  `);

  // 创建视频路径配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建播放历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL,
      play_progress REAL DEFAULT 0,
      last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (video_id) REFERENCES videos(id),
      UNIQUE(video_id)
    )
  `);

  // 不再插入默认分类，只在扫描视频时根据需要创建分类

  // 更新现有表结构（向后兼容）
  try {
    db.prepare('ALTER TABLE videos ADD COLUMN like_count INTEGER DEFAULT 0').run();
  } catch (e) {
    // 列已存在，忽略错误
  }
  try {
    db.prepare('ALTER TABLE videos ADD COLUMN is_favorite INTEGER DEFAULT 0').run();
  } catch (e) {
    // 列已存在，忽略错误
  }
  try {
    db.prepare('ALTER TABLE favorite_frames ADD COLUMN note TEXT').run();
  } catch (e) {
    // 列已存在，忽略错误
  }

  console.log('数据库表创建完成');
}

// 重新加载数据库（删除后重新创建）
export function reloadDatabase(): void {
  try {
    db.close();
  } catch (e) {
    // 忽略关闭错误
  }
  db = new Database(dbPath);
}

export default db;
