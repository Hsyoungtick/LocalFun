import { Router, Request, Response } from 'express';
import db from './database';
import { addVideoToDatabase, refreshAllVideos, scanAndAddVideos } from './scanner';
import fs from 'fs';
import path from 'path';

const router = Router();

// 格式化时长
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// 格式化时间
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  if (days < 365) return `${Math.floor(days / 30)}个月前`;
  return `${Math.floor(days / 365)}年前`;
}

// 格式化观看次数
function formatViews(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return (count / 1000).toFixed(1) + 'K';
  if (count < 100000000) return (count / 10000).toFixed(1) + '万';
  return (count / 100000000).toFixed(1) + '亿';
}

// 获取视频列表
router.get('/videos', (req: Request, res: Response) => {
  try {
    const { category, author, sort, order, search, page = 1, limit = 20 } = req.query;
    
    let sql = `
      SELECT v.*, a.name as author_name, a.avatar as author_avatar, c.name as category_name
      FROM videos v
      LEFT JOIN authors a ON v.author_id = a.id
      LEFT JOIN categories c ON v.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // 分类筛选
    if (category && category !== '全部') {
      sql += ' AND c.name = ?';
      params.push(category);
    }

    // 作者筛选
    if (author) {
      sql += ' AND a.name = ?';
      params.push(author);
    }

    // 搜索
    if (search) {
      sql += ' AND v.title LIKE ?';
      params.push(`%${search}%`);
    }

    // 排序
    const sortField = sort === 'views' ? 'v.view_count' : 
                      sort === 'duration' ? 'v.duration' :
                      sort === 'size' ? 'v.file_size' :
                      'v.created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortField} ${sortOrder}`;

    // 分页
    const offset = (Number(page) - 1) * Number(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const videos = db.prepare(sql).all(...params) as any[];

    // 获取总数
    let countSql = `
      SELECT COUNT(*) as total
      FROM videos v
      LEFT JOIN categories c ON v.category_id = c.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    
    if (category && category !== '全部') {
      countSql += ' AND c.name = ?';
      countParams.push(category);
    }
    
    if (search) {
      countSql += ' AND v.title LIKE ?';
      countParams.push(`%${search}%`);
    }

    const { total } = db.prepare(countSql).get(...countParams) as { total: number };

    // 格式化返回数据
    const formattedVideos = videos.map(v => ({
      id: v.id,
      title: v.title,
      duration: formatDuration(v.duration || 0),
      durationSeconds: v.duration,
      thumbnail: v.thumbnail || null,
      author: v.author_name || '未知作者',
      authorAvatar: v.author_avatar,
      views: formatViews(v.view_count || 0),
      viewsCount: v.view_count || 0,
      time: formatTimeAgo(v.created_at),
      fileSize: formatFileSize(v.file_size || 0),
      category: v.category_name || '其他',
      width: v.width,
      height: v.height
    }));

    res.json({
      success: true,
      data: {
        videos: formattedVideos,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('获取视频列表失败:', error);
    res.status(500).json({ success: false, error: '获取视频列表失败' });
  }
});

// 获取视频详情
router.get('/videos/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const video = db.prepare(`
      SELECT v.*, a.name as author_name, a.avatar as author_avatar, a.description as author_description, c.name as category_name
      FROM videos v
      LEFT JOIN authors a ON v.author_id = a.id
      LEFT JOIN categories c ON v.category_id = c.id
      WHERE v.id = ?
    `).get(id) as any;

    if (!video) {
      return res.status(404).json({ success: false, error: '视频不存在' });
    }

    // 增加观看次数
    db.prepare('UPDATE videos SET view_count = view_count + 1 WHERE id = ?').run(id);

    // 获取作者的其他视频
    const relatedVideos = video.author_id ? 
      db.prepare(`
        SELECT id, title, duration, thumbnail, view_count
        FROM videos
        WHERE author_id = ? AND id != ?
        ORDER BY view_count DESC
        LIMIT 6
      `).all(video.author_id, id) as any[] : [];

    res.json({
      success: true,
      data: {
        id: video.id,
        title: video.title,
        description: video.description,
        duration: formatDuration(video.duration || 0),
        durationSeconds: video.duration,
        thumbnail: video.thumbnail,
        filePath: video.file_path,
        fileSize: formatFileSize(video.file_size || 0),
        width: video.width,
        height: video.height,
        views: formatViews(video.view_count || 0),
        viewsCount: video.view_count || 0,
        time: formatTimeAgo(video.created_at),
        category: video.category_name || '其他',
        author: video.author_name ? {
          name: video.author_name,
          avatar: video.author_avatar,
          description: video.author_description
        } : null,
        relatedVideos: relatedVideos.map(v => ({
          id: v.id,
          title: v.title,
          duration: formatDuration(v.duration || 0),
          thumbnail: v.thumbnail,
          views: formatViews(v.view_count || 0)
        }))
      }
    });
  } catch (error) {
    console.error('获取视频详情失败:', error);
    res.status(500).json({ success: false, error: '获取视频详情失败' });
  }
});

// 更新视频信息
router.put('/videos/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, author_id, category_id } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (author_id !== undefined) {
      updates.push('author_id = ?');
      params.push(author_id);
    }
    if (category_id !== undefined) {
      updates.push('category_id = ?');
      params.push(category_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    params.push(id);
    db.prepare(`UPDATE videos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新视频失败:', error);
    res.status(500).json({ success: false, error: '更新视频失败' });
  }
});

// 删除视频记录
router.delete('/videos/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 获取视频信息以删除封面
    const video = db.prepare('SELECT thumbnail FROM videos WHERE id = ?').get(id) as any;
    
    if (video && video.thumbnail) {
      const thumbnailPath = path.join(process.cwd(), 'data', video.thumbnail.replace('/covers/', 'covers/'));
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }
    
    db.prepare('DELETE FROM videos WHERE id = ?').run(id);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除视频失败:', error);
    res.status(500).json({ success: false, error: '删除视频失败' });
  }
});

// 获取分类列表
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY name').all() as any[];
    
    res.json({
      success: true,
      data: categories.map(c => ({
        id: c.id,
        name: c.name
      }))
    });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ success: false, error: '获取分类失败' });
  }
});

// 获取作者列表
router.get('/authors', (req: Request, res: Response) => {
  try {
    const authors = db.prepare(`
      SELECT a.*, COUNT(v.id) as video_count
      FROM authors a
      LEFT JOIN videos v ON a.id = v.author_id
      GROUP BY a.id
      ORDER BY video_count DESC
    `).all() as any[];
    
    res.json({
      success: true,
      data: authors.map(a => ({
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        description: a.description,
        videoCount: a.video_count
      }))
    });
  } catch (error) {
    console.error('获取作者列表失败:', error);
    res.status(500).json({ success: false, error: '获取作者列表失败' });
  }
});

// 获取作者详情
router.get('/authors/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    const author = db.prepare('SELECT * FROM authors WHERE name = ?').get(name) as any;
    
    if (!author) {
      return res.status(404).json({ success: false, error: '作者不存在' });
    }

    // 获取作者的视频
    const videos = db.prepare(`
      SELECT id, title, duration, thumbnail, view_count, created_at
      FROM videos
      WHERE author_id = ?
      ORDER BY created_at DESC
    `).all(author.id) as any[];

    // 统计数据
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_videos,
        SUM(view_count) as total_views
      FROM videos
      WHERE author_id = ?
    `).get(author.id) as any;

    res.json({
      success: true,
      data: {
        id: author.id,
        name: author.name,
        avatar: author.avatar,
        description: author.description,
        totalVideos: stats.total_videos || 0,
        totalViews: formatViews(stats.total_views || 0),
        videos: videos.map(v => ({
          id: v.id,
          title: v.title,
          duration: formatDuration(v.duration || 0),
          thumbnail: v.thumbnail,
          views: formatViews(v.view_count || 0),
          time: formatTimeAgo(v.created_at)
        }))
      }
    });
  } catch (error) {
    console.error('获取作者详情失败:', error);
    res.status(500).json({ success: false, error: '获取作者详情失败' });
  }
});

// 创建作者
router.post('/authors', (req: Request, res: Response) => {
  try {
    const { name, avatar, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: '作者名称不能为空' });
    }

    const result = db.prepare('INSERT INTO authors (name, avatar, description) VALUES (?, ?, ?)').run(name, avatar, description);
    
    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        name,
        avatar,
        description
      }
    });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ success: false, error: '作者名称已存在' });
    }
    console.error('创建作者失败:', error);
    res.status(500).json({ success: false, error: '创建作者失败' });
  }
});

// 更新作者
router.put('/authors/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, avatar, description } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(avatar);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    params.push(id);
    db.prepare(`UPDATE authors SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    res.json({ success: true, message: '更新成功' });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ success: false, error: '作者名称已存在' });
    }
    console.error('更新作者失败:', error);
    res.status(500).json({ success: false, error: '更新作者失败' });
  }
});

// 视频路径管理
router.get('/paths', (req: Request, res: Response) => {
  try {
    const paths = db.prepare('SELECT * FROM video_paths ORDER BY created_at DESC').all() as any[];
    
    res.json({
      success: true,
      data: paths.map(p => ({
        id: p.id,
        path: p.path,
        enabled: p.enabled === 1,
        createdAt: p.created_at
      }))
    });
  } catch (error) {
    console.error('获取路径列表失败:', error);
    res.status(500).json({ success: false, error: '获取路径列表失败' });
  }
});

// 添加视频路径
router.post('/paths', (req: Request, res: Response) => {
  try {
    const { path: videoPath } = req.body;
    
    if (!videoPath) {
      return res.status(400).json({ success: false, error: '路径不能为空' });
    }

    // 检查路径是否存在
    if (!fs.existsSync(videoPath)) {
      return res.status(400).json({ success: false, error: '路径不存在' });
    }

    const result = db.prepare('INSERT INTO video_paths (path) VALUES (?)').run(videoPath);
    
    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        path: videoPath,
        enabled: true
      }
    });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ success: false, error: '路径已存在' });
    }
    console.error('添加路径失败:', error);
    res.status(500).json({ success: false, error: '添加路径失败' });
  }
});

// 删除视频路径
router.delete('/paths/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM video_paths WHERE id = ?').run(id);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除路径失败:', error);
    res.status(500).json({ success: false, error: '删除路径失败' });
  }
});

// 扫描视频
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { path: scanPath } = req.body;
    
    let result;
    if (scanPath) {
      // 扫描指定路径
      result = await scanAndAddVideos(scanPath);
    } else {
      // 扫描所有已配置的路径
      result = await refreshAllVideos();
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('扫描视频失败:', error);
    res.status(500).json({ success: false, error: '扫描视频失败' });
  }
});

// 重新扫描指定路径（清除该路径的缓存后重新扫描）
router.post('/rescan', async (req: Request, res: Response) => {
  try {
    const { path: scanPath } = req.body;
    
    if (!scanPath) {
      return res.status(400).json({ success: false, error: '路径不能为空' });
    }

    // 获取该路径下的所有视频文件
    const videos = db.prepare('SELECT id, file_path FROM videos WHERE file_path LIKE ?')
      .all(`${scanPath.replace(/\\/g, '/')}%`) as any[];

    // 删除这些视频的封面和精灵图
    const coversDir = path.join(process.cwd(), 'data', 'covers');
    const previewsDir = path.join(process.cwd(), 'data', 'previews');

    for (const video of videos) {
      // 删除封面
      const coverPath = path.join(coversDir, `${video.id}.jpg`);
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
      }
      // 删除精灵图
      const spritePath = path.join(previewsDir, `${video.id}_sprite.jpg`);
      if (fs.existsSync(spritePath)) {
        fs.unlinkSync(spritePath);
      }
    }

    // 从数据库删除这些视频
    const pathPattern = scanPath.replace(/\\/g, '/');
    db.prepare('DELETE FROM videos WHERE file_path LIKE ?').run(`${pathPattern}%`);

    // 重新扫描该路径
    const result = await scanAndAddVideos(scanPath);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('重新扫描失败:', error);
    res.status(500).json({ success: false, error: '重新扫描失败' });
  }
});

// 视频流播放接口 - 支持Range请求
router.get('/stream/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const video = db.prepare('SELECT file_path FROM videos WHERE id = ?').get(id) as any;
    
    if (!video) {
      return res.status(404).json({ success: false, error: '视频不存在' });
    }

    const filePath = video.file_path;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '视频文件不存在' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // 解析Range头
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4'
      });

      fileStream.pipe(res);
    } else {
      // 不带Range头，返回整个文件
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      });

      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('视频流播放失败:', error);
    res.status(500).json({ success: false, error: '视频流播放失败' });
  }
});

// 获取统计信息
router.get('/stats', (req: Request, res: Response) => {
  try {
    const videoCount = db.prepare('SELECT COUNT(*) as count FROM videos').get() as { count: number };
    const authorCount = db.prepare('SELECT COUNT(*) as count FROM authors').get() as { count: number };
    const totalViews = db.prepare('SELECT SUM(view_count) as total FROM videos').get() as { total: number };
    const totalSize = db.prepare('SELECT SUM(file_size) as total FROM videos').get() as { total: number };
    
    res.json({
      success: true,
      data: {
        videoCount: videoCount.count,
        authorCount: authorCount.count,
        totalViews: totalViews.total || 0,
        totalSize: formatFileSize(totalSize.total || 0)
      }
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ success: false, error: '获取统计信息失败' });
  }
});

// 清除所有缓存（数据库和封面，但保留视频路径）
router.post('/clear-cache', (req: Request, res: Response) => {
  try {
    // 删除所有封面图片
    const coversDir = path.join(process.cwd(), 'data', 'covers');
    if (fs.existsSync(coversDir)) {
      const files = fs.readdirSync(coversDir);
      for (const file of files) {
        if (file.endsWith('.jpg')) {
          fs.unlinkSync(path.join(coversDir, file));
        }
      }
    }

    // 删除所有预览精灵图
    const previewsDir = path.join(process.cwd(), 'data', 'previews');
    if (fs.existsSync(previewsDir)) {
      const files = fs.readdirSync(previewsDir);
      for (const file of files) {
        if (file.endsWith('.jpg') || file.endsWith('.txt')) {
          fs.unlinkSync(path.join(previewsDir, file));
        }
      }
    }

    // 清空数据库表（保留 video_paths）
    db.prepare('DELETE FROM videos').run();
    db.prepare('DELETE FROM authors').run();
    db.prepare('DELETE FROM categories').run();
    
    // 重置自增ID（保留 video_paths）
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('videos', 'authors', 'categories')").run();

    res.json({
      success: true,
      message: '缓存已清除'
    });
  } catch (error) {
    console.error('清除缓存失败:', error);
    res.status(500).json({ success: false, error: '清除缓存失败' });
  }
});

export function createVideoRoutes(): Router {
  return router;
}
