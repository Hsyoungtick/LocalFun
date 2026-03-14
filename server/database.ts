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

// 内部数据库实例
let _db = new Database(dbPath);

// 使用 Proxy 确保始终使用最新的数据库实例
const db = new Proxy({} as Database.Database, {
  get(_, prop) {
    return Reflect.get(_db, prop);
  }
});

// 初始化数据库表
export async function initDatabase() {
  // 创建作者表
  _db.exec(`
    CREATE TABLE IF NOT EXISTS authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      avatar TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建分类表
  _db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建视频表
  _db.exec(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      file_modified_at DATETIME,
      FOREIGN KEY (author_id) REFERENCES authors(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // 创建视频路径配置表
  _db.exec(`
    CREATE TABLE IF NOT EXISTS video_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 插入默认分类
  const defaultCategories = ['动画', '电影', '游戏', '音乐', '科技', '纪录片', '美食', '生活', 'Vlog', '其他'];
  const insertCategory = _db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  
  for (const category of defaultCategories) {
    insertCategory.run(category);
  }

  console.log('数据库表创建完成');
}

// 重新加载数据库（删除后重新创建）
export function reloadDatabase(): void {
  try {
    _db.close();
  } catch (e) {
    // 忽略关闭错误
  }
  _db = new Database(dbPath);
}

export default db;
