import { Router, Request, Response } from 'express';
import db, { initDatabase, dbPath, reloadDatabase, getDb } from './database';
import { addVideoToDatabase, refreshAllVideos, scanAndAddVideos, scanProgress, generateSpriteForVideo } from './scanner';
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

// 格式化时间为具体日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const year = date.getFullYear();
  const currentYear = now.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  if (year === currentYear) {
    return `${month}-${day}`;
  }
  return `${year}-${month}-${day}`;
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
      SELECT v.*, a.name as author_name, c.name as category_name, ph.last_played_at
      FROM videos v
      LEFT JOIN authors a ON v.author_id = a.id
      LEFT JOIN categories c ON v.category_id = c.id
      LEFT JOIN play_history ph ON v.id = ph.video_id
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
    let orderClause = '';
    if (sort === 'random') {
      orderClause = ' ORDER BY RANDOM()';
    } else {
      const sortField = sort === 'views' ? 'v.view_count' : 
                        sort === 'duration' ? 'v.duration' :
                        sort === 'size' ? 'v.file_size' :
                        sort === 'author' ? 'a.name' :
                        sort === 'category' ? 'c.name' :
                        sort === 'last_played' ? 'ph.last_played_at' :
                        'v.file_modified_at';
      const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
      orderClause = ` ORDER BY ${sortField} ${sortOrder}`;
    }
    sql += orderClause;

    // 分页
    const offset = (Number(page) - 1) * Number(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const videos = getDb().prepare(sql).all(...params) as any[];

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

    const { total } = getDb().prepare(countSql).get(...countParams) as { total: number };

    // 格式化返回数据
    const formattedVideos = videos.map(v => ({
      id: v.id,
      title: v.title,
      duration: formatDuration(v.duration || 0),
      durationSeconds: v.duration,
      author: v.author_name || '未知作者',
      views: formatViews(v.view_count || 0),
      viewsCount: v.view_count || 0,
      time: formatDate(v.file_modified_at || v.created_at),
      fileSize: formatFileSize(v.file_size || 0),
      category: v.category_name || '其他',
      width: v.width,
      height: v.height,
      lastPlayedAt: v.last_played_at
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
    
    const video = getDb().prepare(`
      SELECT v.*, a.name as author_name, a.description as author_description, c.name as category_name, ph.play_progress
      FROM videos v
      LEFT JOIN authors a ON v.author_id = a.id
      LEFT JOIN categories c ON v.category_id = c.id
      LEFT JOIN play_history ph ON v.id = ph.video_id
      WHERE v.id = ?
    `).get(id) as any;

    if (!video) {
      return res.status(404).json({ success: false, error: '视频不存在' });
    }

    // 增加观看次数
    getDb().prepare('UPDATE videos SET view_count = view_count + 1 WHERE id = ?').run(id);

    // 获取喜欢帧数量
    const favoriteFramesCount = getDb().prepare('SELECT COUNT(*) as count FROM favorite_frames WHERE video_id = ?').get(id) as any;

    // 获取喜欢帧列表
    const favoriteFrames = getDb().prepare('SELECT * FROM favorite_frames WHERE video_id = ? ORDER BY time_seconds ASC').all(id) as any[];

    // 获取同类别的其他视频
    const relatedVideos = video.category_id ? 
      getDb().prepare(`
        SELECT id, title, duration, view_count
        FROM videos
        WHERE category_id = ? AND id != ?
        ORDER BY view_count DESC
        LIMIT 6
      `).all(video.category_id, id) as any[] : [];

    res.json({
      success: true,
      data: {
        id: video.id,
        title: video.title,
        description: video.description,
        duration: formatDuration(video.duration || 0),
        durationSeconds: video.duration,
        filePath: video.file_path,
        fileSize: formatFileSize(video.file_size || 0),
        width: video.width,
        height: video.height,
        views: formatViews(video.view_count || 0),
        viewsCount: video.view_count || 0,
        time: formatDate(video.file_modified_at || video.created_at),
        category: video.category_name || '其他',
        author: video.author_name ? {
          name: video.author_name,
          description: video.author_description
        } : null,
        likeCount: video.like_count || 0,
        isFavorite: video.is_favorite === 1,
        favoriteFramesCount: favoriteFramesCount?.count || 0,
        favoriteFrames: favoriteFrames.map(f => ({
          id: f.id,
          timeSeconds: f.time_seconds,
          note: f.note
        })),
        relatedVideos: relatedVideos.map(v => ({
          id: v.id,
          title: v.title,
          duration: formatDuration(v.duration || 0),
          views: formatViews(v.view_count || 0)
        })),
        playProgress: video.play_progress
      }
    });
  } catch (error) {
    console.error('获取视频详情失败:', error);
    res.status(500).json({ success: false, error: '获取视频详情失败' });
  }
});

// 获取同类别的视频
router.get('/videos/:id/same-category', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sort = 'random', order = 'desc', limit = 20 } = req.query;
    
    // 获取当前视频的分类
    const video = getDb().prepare('SELECT category_id FROM videos WHERE id = ?').get(id) as any;
    if (!video) {
      return res.status(404).json({ success: false, error: '视频不存在' });
    }

    let sql = `
      SELECT v.*, a.name as author_name, c.name as category_name
      FROM videos v
      LEFT JOIN authors a ON v.author_id = a.id
      LEFT JOIN categories c ON v.category_id = c.id
      WHERE v.category_id = ? AND v.id != ?
    `;
    const params: any[] = [video.category_id, id];

    // 排序
    let orderClause = '';
    if (sort === 'random') {
      orderClause = ' ORDER BY RANDOM()';
    } else {
      const sortField = sort === 'views' ? 'v.view_count' : 
                        sort === 'duration' ? 'v.duration' :
                        sort === 'size' ? 'v.file_size' :
                        sort === 'author' ? 'a.name' :
                        'v.file_modified_at';
      const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
      orderClause = ` ORDER BY ${sortField} ${sortOrder}`;
    }
    sql += orderClause;

    sql += ' LIMIT ?';
    params.push(Number(limit));

    const videos = getDb().prepare(sql).all(...params) as any[];

    // 格式化返回数据
    const formattedVideos = videos.map(v => ({
      id: v.id,
      title: v.title,
      duration: formatDuration(v.duration || 0),
      durationSeconds: v.duration,
      author: v.author_name || '未知作者',
      views: formatViews(v.view_count || 0),
      viewsCount: v.view_count || 0,
      time: formatDate(v.file_modified_at || v.created_at),
      fileSize: formatFileSize(v.file_size || 0),
      category: v.category_name || '其他',
      width: v.width,
      height: v.height
    }));

    res.json({
      success: true,
      data: formattedVideos
    });
  } catch (error) {
    console.error('获取同类别视频失败:', error);
    res.status(500).json({ success: false, error: '获取同类别视频失败' });
  }
});

// 添加喜欢帧
router.post('/videos/:id/favorite-frames', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { timeSeconds, note } = req.body;

    if (timeSeconds === undefined) {
      return res.status(400).json({ success: false, error: '缺少 timeSeconds 参数' });
    }

    const result = getDb().prepare('INSERT INTO favorite_frames (video_id, time_seconds, note) VALUES (?, ?, ?)').run(id, timeSeconds, note || null);
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    console.error('添加喜欢帧失败:', error);
    res.status(500).json({ success: false, error: '添加喜欢帧失败' });
  }
});

// 更新喜欢帧注释
router.put('/videos/:id/favorite-frames/:frameId', (req: Request, res: Response) => {
  try {
    const { frameId } = req.params;
    const { note } = req.body;
    
    getDb().prepare('UPDATE favorite_frames SET note = ? WHERE id = ?').run(note || null, frameId);
    res.json({ success: true });
  } catch (error) {
    console.error('更新喜欢帧注释失败:', error);
    res.status(500).json({ success: false, error: '更新喜欢帧注释失败' });
  }
});

// 删除喜欢帧
router.delete('/videos/:id/favorite-frames/:frameId', (req: Request, res: Response) => {
  try {
    const { frameId } = req.params;
    getDb().prepare('DELETE FROM favorite_frames WHERE id = ?').run(frameId);
    res.json({ success: true });
  } catch (error) {
    console.error('删除喜欢帧失败:', error);
    res.status(500).json({ success: false, error: '删除喜欢帧失败' });
  }
});

// 重置视频数据
router.post('/videos/:id/reset', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 删除喜欢的帧
    getDb().prepare('DELETE FROM favorite_frames WHERE video_id = ?').run(id);
    
    // 重置播放量、点赞数、收藏状态
    getDb().prepare('UPDATE videos SET view_count = 0, like_count = 0, is_favorite = 0 WHERE id = ?').run(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('重置视频数据失败:', error);
    res.status(500).json({ success: false, error: '重置视频数据失败' });
  }
});

// 增加点赞数
router.post('/videos/:id/like', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    getDb().prepare('UPDATE videos SET like_count = like_count + 1 WHERE id = ?').run(id);
    const { like_count } = getDb().prepare('SELECT like_count FROM videos WHERE id = ?').get(id) as any;
    res.json({ success: true, data: { likeCount: like_count } });
  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ success: false, error: '点赞失败' });
  }
});

// 切换收藏状态
router.post('/videos/:id/favorite', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isFavorite } = req.body;
    console.log('切换收藏状态:', { id, isFavorite });
    getDb().prepare('UPDATE videos SET is_favorite = ? WHERE id = ?').run(isFavorite ? 1 : 0, id);
    // 验证更新是否成功
    const result = getDb().prepare('SELECT is_favorite FROM videos WHERE id = ?').get(id) as any;
    console.log('更新后的收藏状态:', result?.is_favorite);
    res.json({ success: true });
  } catch (error) {
    console.error('切换收藏失败:', error);
    res.status(500).json({ success: false, error: '切换收藏失败' });
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
    getDb().prepare(`UPDATE videos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

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
    
    // 删除封面和精灵图
    const coversDir = path.join(process.cwd(), 'data', 'covers');
    const previewsDir = path.join(process.cwd(), 'data', 'previews');
    
    const coverPath = path.join(coversDir, `${id}.jpg`);
    if (fs.existsSync(coverPath)) {
      fs.unlinkSync(coverPath);
    }
    
    const spritePath = path.join(previewsDir, `${id}_sprite.jpg`);
    if (fs.existsSync(spritePath)) {
      fs.unlinkSync(spritePath);
    }
    
    getDb().prepare('DELETE FROM videos WHERE id = ?').run(id);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除视频失败:', error);
    res.status(500).json({ success: false, error: '删除视频失败' });
  }
});

// 获取分类列表（只返回有视频的分类）
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = getDb().prepare(`
      SELECT c.*, COUNT(v.id) as video_count
      FROM categories c
      INNER JOIN videos v ON c.id = v.category_id
      GROUP BY c.id
      ORDER BY c.name
    `).all() as any[];
    
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
    const authors = getDb().prepare(`
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
    
    const author = getDb().prepare('SELECT * FROM authors WHERE name = ?').get(name) as any;
    
    if (!author) {
      return res.status(404).json({ success: false, error: '作者不存在' });
    }

    // 获取作者的视频
    const videos = getDb().prepare(`
      SELECT id, title, duration, view_count, file_modified_at, created_at
      FROM videos
      WHERE author_id = ?
      ORDER BY file_modified_at DESC
    `).all(author.id) as any[];

    // 统计数据
    const stats = getDb().prepare(`
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
        description: author.description,
        totalVideos: stats.total_videos || 0,
        totalViews: formatViews(stats.total_views || 0),
        videos: videos.map(v => ({
          id: v.id,
          title: v.title,
          duration: formatDuration(v.duration || 0),
          durationSeconds: v.duration || 0,
          views: formatViews(v.view_count || 0),
          viewsCount: v.view_count || 0,
          time: formatDate(v.file_modified_at || v.created_at)
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
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: '作者名称不能为空' });
    }

    const result = getDb().prepare('INSERT INTO authors (name, description) VALUES (?, ?)').run(name, description);
    
    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        name,
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
    const { name, description } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    params.push(id);
    getDb().prepare(`UPDATE authors SET ${updates.join(', ')} WHERE id = ?`).run(...params);

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
    const paths = getDb().prepare('SELECT * FROM video_paths ORDER BY created_at DESC').all() as any[];
    
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

    const result = getDb().prepare('INSERT INTO video_paths (path) VALUES (?)').run(videoPath);
    
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

// 删除视频路径（同时删除该路径的视频数据和封面/精灵图）
router.delete('/paths/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 获取路径信息
    const pathInfo = getDb().prepare('SELECT path FROM video_paths WHERE id = ?').get(id) as any;
    if (!pathInfo) {
      return res.status(404).json({ success: false, error: '路径不存在' });
    }
    
    const pathValue = pathInfo.path;
    const normalizedPath = pathValue.replace(/\\/g, '/');
    
    // 获取该路径下的所有视频ID
    const videos = getDb().prepare(`
      SELECT id FROM videos 
      WHERE file_path LIKE ? OR file_path LIKE ?
    `).all(`${normalizedPath}%`, `${pathValue}%`) as any[];
    
    // 删除该路径视频的相关数据
    if (videos.length > 0) {
      const videoIds = videos.map(v => v.id);
      const placeholders = videoIds.map(() => '?').join(',');
      
      // 删除喜欢的帧
      getDb().prepare(`
        DELETE FROM favorite_frames WHERE video_id IN (${placeholders})
      `).run(...videoIds);
      
      // 删除播放历史
      getDb().prepare(`
        DELETE FROM play_history WHERE video_id IN (${placeholders})
      `).run(...videoIds);
    }
    
    // 删除封面和精灵图
    const coversDir = path.join(process.cwd(), 'data', 'covers');
    const previewsDir = path.join(process.cwd(), 'data', 'previews');
    
    for (const video of videos) {
      const coverPath = path.join(coversDir, `${video.id}.jpg`);
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
      }
      
      const spritePath = path.join(previewsDir, `${video.id}_sprite.jpg`);
      if (fs.existsSync(spritePath)) {
        fs.unlinkSync(spritePath);
      }
      
      const timestampPath = path.join(previewsDir, `${video.id}_timestamps.txt`);
      if (fs.existsSync(timestampPath)) {
        fs.unlinkSync(timestampPath);
      }
    }
    
    // 删除该路径的视频数据
    getDb().prepare(`
      DELETE FROM videos WHERE file_path LIKE ? OR file_path LIKE ?
    `).run(`${normalizedPath}%`, `${pathValue}%`);
    
    // 删除路径配置
    getDb().prepare('DELETE FROM video_paths WHERE id = ?').run(id);
    
    // 检查并重置自增计数器
    const videoCount = getDb().prepare('SELECT COUNT(*) as count FROM videos').get() as { count: number };
    if (videoCount.count === 0) {
      getDb().exec("DELETE FROM sqlite_sequence WHERE name='videos'");
    }
    
    const authorCount = getDb().prepare('SELECT COUNT(*) as count FROM authors').get() as { count: number };
    if (authorCount.count === 0) {
      getDb().exec("DELETE FROM sqlite_sequence WHERE name='authors'");
    }
    
    const pathCount = getDb().prepare('SELECT COUNT(*) as count FROM video_paths').get() as { count: number };
    if (pathCount.count === 0) {
      getDb().exec("DELETE FROM sqlite_sequence WHERE name='video_paths'");
    }
    
    res.json({ 
      success: true, 
      message: '删除成功',
      deletedVideos: videos.length
    });
  } catch (error) {
    console.error('删除路径失败:', error);
    res.status(500).json({ success: false, error: '删除路径失败' });
  }
});

// 获取扫描进度
router.get('/scan-progress', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: scanProgress
  });
});

// 扫描视频（只添加新视频）
router.post('/scan', async (req: Request, res: Response) => {
  try {
    // 检查数据库是否存在，不存在则初始化
    if (!fs.existsSync(dbPath)) {
      console.log('数据库不存在，正在初始化...');
      await initDatabase();
    }
    
    const { path: scanPath } = req.body;
    
    let result;
    if (scanPath) {
      // 扫描指定路径（只添加新视频）
      result = await scanAndAddVideos(scanPath, true);
      
      // 生成精灵图
      if (result.videoIds.length > 0) {
        scanProgress.status = 'generating_previews';
        scanProgress.total = result.videoIds.length;
        scanProgress.message = '正在生成预览图...';
        
        for (let i = 0; i < result.videoIds.length; i++) {
          scanProgress.current = i + 1;
          const video = getDb().prepare('SELECT file_path FROM videos WHERE id = ?').get(result.videoIds[i]) as any;
          if (video) {
            scanProgress.currentFile = path.basename(video.file_path);
            scanProgress.message = `正在生成预览图: ${path.basename(video.file_path)}`;
          }
          await generateSpriteForVideo(result.videoIds[i]);
        }
      }
      
      scanProgress.status = 'completed';
      scanProgress.message = '扫描完成';
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
    // 检查数据库是否存在，不存在则初始化
    if (!fs.existsSync(dbPath)) {
      console.log('数据库不存在，正在初始化...');
      await initDatabase();
    }
    
    const { path: scanPath } = req.body;
    
    if (!scanPath) {
      return res.status(400).json({ success: false, error: '路径不能为空' });
    }

    // 标准化路径（统一使用正斜杠）
    const normalizedPath = scanPath.replace(/\\/g, '/');

    // 获取该路径下的所有视频文件（同时匹配正斜杠和反斜杠格式）
    const videos = getDb().prepare(`
      SELECT id, file_path FROM videos 
      WHERE file_path LIKE ? OR file_path LIKE ?
    `).all(`${normalizedPath}%`, `${scanPath}%`) as any[];

    console.log(`重新扫描路径: ${scanPath}（标准化: ${normalizedPath}），找到 ${videos.length} 个视频需要删除`);

    // 删除这些视频的封面和精灵图
    const coversDir = path.join(process.cwd(), 'data', 'covers');
    const previewsDir = path.join(process.cwd(), 'data', 'previews');

    for (const video of videos) {
      console.log(`处理视频: ID=${video.id}, 路径=${video.file_path}`);
      // 删除封面
      const coverPath = path.join(coversDir, `${video.id}.jpg`);
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
        console.log(`删除封面: ${coverPath}`);
      }
      // 删除精灵图
      const spritePath = path.join(previewsDir, `${video.id}_sprite.jpg`);
      if (fs.existsSync(spritePath)) {
        fs.unlinkSync(spritePath);
        console.log(`删除精灵图: ${spritePath}`);
      }
      // 删除临时文件
      try {
        const tempFiles = fs.readdirSync(previewsDir).filter(f => f.startsWith(`${video.id}_temp`));
        for (const tempFile of tempFiles) {
          fs.unlinkSync(path.join(previewsDir, tempFile));
        }
      } catch (e) {
        // 忽略错误
      }
    }

    // 从数据库删除这些视频（同时匹配正斜杠和反斜杠格式）
    getDb().prepare(`DELETE FROM videos WHERE file_path LIKE ? OR file_path LIKE ?`).run(`${normalizedPath}%`, `${scanPath}%`);
    console.log(`已从数据库删除 ${videos.length} 个视频记录`);
    
    // 检查并重置自增计数器
    const videoCount = getDb().prepare('SELECT COUNT(*) as count FROM videos').get() as { count: number };
    if (videoCount.count === 0) {
      getDb().exec("DELETE FROM sqlite_sequence WHERE name='videos'");
    }
    
    const authorCount = getDb().prepare('SELECT COUNT(*) as count FROM authors').get() as { count: number };
    if (authorCount.count === 0) {
      getDb().exec("DELETE FROM sqlite_sequence WHERE name='authors'");
    }

    // 重新扫描该路径
    const result = await scanAndAddVideos(scanPath, true);
    
    // 生成精灵图
    if (result.videoIds.length > 0) {
      scanProgress.status = 'generating_previews';
      scanProgress.total = result.videoIds.length;
      scanProgress.message = '正在生成预览图...';
      
      for (let i = 0; i < result.videoIds.length; i++) {
        scanProgress.current = i + 1;
        const video = getDb().prepare('SELECT file_path FROM videos WHERE id = ?').get(result.videoIds[i]) as any;
        if (video) {
          scanProgress.currentFile = path.basename(video.file_path);
          scanProgress.message = `正在生成预览图: ${path.basename(video.file_path)}`;
        }
        await generateSpriteForVideo(result.videoIds[i]);
      }
    }
    
    scanProgress.status = 'completed';
    scanProgress.message = '扫描完成';
    
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
    
    const video = getDb().prepare('SELECT file_path FROM videos WHERE id = ?').get(id) as any;
    
    if (!video) {
      console.log('视频不存在:', id);
      return res.status(404).json({ success: false, error: '视频不存在' });
    }

    const filePath = video.file_path;
    
    if (!fs.existsSync(filePath)) {
      console.log('视频文件不存在:', filePath);
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
    const videoCount = getDb().prepare('SELECT COUNT(*) as count FROM videos').get() as { count: number };
    const authorCount = getDb().prepare('SELECT COUNT(*) as count FROM authors').get() as { count: number };
    const totalViews = getDb().prepare('SELECT SUM(view_count) as total FROM videos').get() as { total: number };
    const totalSize = getDb().prepare('SELECT SUM(file_size) as total FROM videos').get() as { total: number };
    
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

// 清除所有缓存（删除数据库文件并重新生成，保留视频路径配置）
router.post('/clear-cache', async (req: Request, res: Response) => {
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

    // 保存视频路径配置
    const videoPaths = getDb().prepare('SELECT path, enabled FROM video_paths').all() as any[];

    // 删除数据库文件
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('已删除数据库文件');
    }

    // 重新加载数据库连接并初始化
    reloadDatabase();
    await initDatabase();
    console.log('已重新创建数据库');

    // 恢复视频路径配置
    if (videoPaths.length > 0) {
      const insertPath = getDb().prepare('INSERT INTO video_paths (path, enabled) VALUES (?, ?)');
      for (const vp of videoPaths) {
        try {
          insertPath.run(vp.path, vp.enabled);
        } catch (e) {
          // 忽略重复错误
        }
      }
      console.log(`已恢复 ${videoPaths.length} 个视频路径配置`);
    }

    res.json({
      success: true,
      message: '缓存已清除，数据库已重新生成'
    });
  } catch (error) {
    console.error('清除缓存失败:', error);
    res.status(500).json({ success: false, error: '清除缓存失败' });
  }
});

// 全部重新扫描（清空所有表，保留视频路径配置，然后扫描）
router.post('/rescan-all', async (req: Request, res: Response) => {
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

    // 保存视频路径配置
    const videoPaths = getDb().prepare('SELECT path, enabled FROM video_paths').all() as any[];

    // 清空所有表（不删除数据库文件）
    getDb().exec('DELETE FROM videos');
    getDb().exec('DELETE FROM authors');
    getDb().exec('DELETE FROM categories');
    getDb().exec('DELETE FROM favorite_frames');
    getDb().exec('DELETE FROM play_history');
    getDb().exec('DELETE FROM video_paths');
    
    // 重置自增计数器
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='videos'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='authors'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='categories'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='favorite_frames'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='play_history'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='video_paths'");
    
    // 不再插入默认分类，只在扫描视频时根据需要创建分类
    
    console.log('已清空所有表');

    // 恢复视频路径配置
    if (videoPaths.length > 0) {
      const insertPath = getDb().prepare('INSERT INTO video_paths (path, enabled) VALUES (?, ?)');
      for (const vp of videoPaths) {
        try {
          insertPath.run(vp.path, vp.enabled);
        } catch (e) {
          // 忽略重复错误
        }
      }
      console.log(`已恢复 ${videoPaths.length} 个视频路径配置`);
    }

    // 扫描所有路径
    const result = await refreshAllVideos();

    res.json({
      success: true,
      message: '数据库已重新生成并扫描完成',
      data: result
    });
  } catch (error) {
    console.error('全部重新扫描失败:', error);
    res.status(500).json({ success: false, error: '全部重新扫描失败' });
  }
});

// 修改视频的标题和文件路径（同时重命名文件）
router.put('/videos/:id/rename', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newTitle, newAuthor } = req.body;

    const video = getDb().prepare('SELECT * FROM videos WHERE id = ?').get(id) as any;
    if (!video) {
      return res.status(404).json({ success: false, error: '视频不存在' });
    }

    const oldFilePath = video.file_path;
    const ext = path.extname(oldFilePath);
    const dir = path.dirname(oldFilePath);
    let newFileName = '';
    
    // 如果提供了 newAuthor，保留或添加作者名前缀
    if (newAuthor !== undefined) {
      newFileName = `【${newAuthor}】${newTitle || video.title}${ext}`;
    } else {
      // 从原文件名中提取作者名（如果有）
      const oldFileName = path.basename(oldFilePath, ext);
      const authorMatch = oldFileName.match(/^【(.+?)】(.*)$/);
      if (authorMatch) {
        newFileName = `【${authorMatch[1]}】${newTitle || video.title}${ext}`;
      } else {
        newFileName = `${newTitle || video.title}${ext}`;
      }
    }
    
    const newFilePath = path.join(dir, newFileName);

    // 检查新路径是否已存在
    if (fs.existsSync(newFilePath) && newFilePath !== oldFilePath) {
      return res.status(400).json({ success: false, error: '目标文件已存在' });
    }

    // 重命名文件
    if (newFilePath !== oldFilePath) {
      fs.renameSync(oldFilePath, newFilePath);
      console.log(`重命名文件: ${oldFilePath} -> ${newFilePath}`);
    }

    // 更新数据库
    const updateVideo = getDb().prepare('UPDATE videos SET title = ?, file_path = ? WHERE id = ?');
    updateVideo.run(newTitle || video.title, newFilePath, id);

    // 如果修改了作者，同时更新作者信息
    if (newAuthor !== undefined) {
      let authorId: number | null = null;
      if (newAuthor) {
        let authorResult = getDb().prepare('SELECT id FROM authors WHERE name = ?').get(newAuthor);
        if (authorResult) {
          authorId = (authorResult as any).id;
        } else {
          const insertAuthor = getDb().prepare('INSERT INTO authors (name) VALUES (?)').run(newAuthor);
          authorId = insertAuthor.lastInsertRowid as number;
        }
      }
      const updateAuthor = getDb().prepare('UPDATE videos SET author_id = ? WHERE id = ?');
      updateAuthor.run(authorId, id);
    }

    res.json({ success: true, message: '修改成功' });
  } catch (error) {
    console.error('修改视频失败:', error);
    res.status(500).json({ success: false, error: '修改失败' });
  }
});

// 批量修改作者名（修改该作者所有视频的文件名）
router.put('/authors/:id/rename', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName) {
      return res.status(400).json({ success: false, error: '作者名不能为空' });
    }

    const author = getDb().prepare('SELECT * FROM authors WHERE id = ?').get(id) as any;
    if (!author) {
      return res.status(404).json({ success: false, error: '作者不存在' });
    }

    // 获取该作者的所有视频
    const videos = getDb().prepare('SELECT * FROM videos WHERE author_id = ?').all(id) as any[];
    let successCount = 0;
    let failCount = 0;

    for (const video of videos) {
      try {
        const oldFilePath = video.file_path;
        const ext = path.extname(oldFilePath);
        const dir = path.dirname(oldFilePath);
        const oldFileName = path.basename(oldFilePath, ext);
        
        // 替换或添加作者名前缀
        let newFileName = '';
        const authorMatch = oldFileName.match(/^【(.+?)】(.*)$/);
        if (authorMatch) {
          newFileName = `【${newName}】${authorMatch[2]}${ext}`;
        } else {
          newFileName = `【${newName}】${oldFileName}${ext}`;
        }
        
        const newFilePath = path.join(dir, newFileName);

        // 检查新路径是否已存在
        if (fs.existsSync(newFilePath) && newFilePath !== oldFilePath) {
          failCount++;
          continue;
        }

        // 重命名文件
        if (newFilePath !== oldFilePath) {
          fs.renameSync(oldFilePath, newFilePath);
        }

        // 更新数据库
        const updateVideo = getDb().prepare('UPDATE videos SET file_path = ? WHERE id = ?');
        updateVideo.run(newFilePath, video.id);
        successCount++;
      } catch (e) {
        console.error(`修改视频 ${video.id} 失败:`, e);
        failCount++;
      }
    }

    // 更新作者名
    const updateAuthor = getDb().prepare('UPDATE authors SET name = ? WHERE id = ?');
    updateAuthor.run(newName, id);

    res.json({ 
      success: true, 
      message: `修改完成，成功 ${successCount} 个，失败 ${failCount} 个` 
    });
  } catch (error) {
    console.error('批量修改作者名失败:', error);
    res.status(500).json({ success: false, error: '修改失败' });
  }
});

// 全部删除（清空所有表，包括路径配置）
router.post('/delete-all', async (req: Request, res: Response) => {
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

    // 清空所有表（不删除数据库文件）
    getDb().exec('DELETE FROM videos');
    getDb().exec('DELETE FROM authors');
    getDb().exec('DELETE FROM categories');
    getDb().exec('DELETE FROM favorite_frames');
    getDb().exec('DELETE FROM play_history');
    getDb().exec('DELETE FROM video_paths');
    
    // 重置自增计数器
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='videos'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='authors'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='categories'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='favorite_frames'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='play_history'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='video_paths'");
    
    // 不再插入默认分类，只在扫描视频时根据需要创建分类
    
    console.log('已清空所有表');

    res.json({
      success: true,
      message: '所有数据已删除'
    });
  } catch (error) {
    console.error('全部删除失败:', error);
    res.status(500).json({ success: false, error: '全部删除失败' });
  }
});

// 获取收藏的视频列表
router.get('/favorites', (req: Request, res: Response) => {
  try {
    const { sort = 'created_at', order = 'desc', search, page = 1, limit = 20 } = req.query;
    
    let sql = `
      SELECT v.*, a.name as author_name, c.name as category_name, ph.last_played_at
      FROM videos v
      LEFT JOIN authors a ON v.author_id = a.id
      LEFT JOIN categories c ON v.category_id = c.id
      LEFT JOIN play_history ph ON v.id = ph.video_id
      WHERE v.is_favorite = 1
    `;
    const params: any[] = [];

    // 搜索
    if (search) {
      sql += ' AND v.title LIKE ?';
      params.push(`%${search}%`);
    }

    // 排序
    let orderClause = '';
    const sortField = sort === 'views' ? 'v.view_count' : 
                      sort === 'duration' ? 'v.duration' :
                      sort === 'size' ? 'v.file_size' :
                      sort === 'author' ? 'a.name' :
                      sort === 'category' ? 'c.name' :
                      sort === 'last_played' ? 'ph.last_played_at' :
                      'v.created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    orderClause = ` ORDER BY ${sortField} ${sortOrder}`;
    sql += orderClause;

    // 分页
    const offset = (Number(page) - 1) * Number(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const videos = getDb().prepare(sql).all(...params) as any[];

    // 获取总数
    let countSql = `
      SELECT COUNT(*) as total
      FROM videos v
      WHERE v.is_favorite = 1
    `;
    const countParams: any[] = [];
    
    if (search) {
      countSql += ' AND v.title LIKE ?';
      countParams.push(`%${search}%`);
    }

    const { total } = getDb().prepare(countSql).get(...countParams) as { total: number };

    // 格式化返回数据
    const formattedVideos = videos.map(v => ({
      id: v.id,
      title: v.title,
      duration: formatDuration(v.duration || 0),
      durationSeconds: v.duration,
      author: v.author_name || '未知作者',
      views: formatViews(v.view_count || 0),
      viewsCount: v.view_count || 0,
      time: formatDate(v.file_modified_at || v.created_at),
      fileSize: formatFileSize(v.file_size || 0),
      category: v.category_name || '其他',
      width: v.width,
      height: v.height,
      lastPlayedAt: v.last_played_at
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
    console.error('获取收藏视频失败:', error);
    res.status(500).json({ success: false, error: '获取收藏视频失败' });
  }
});

// 获取观看历史
router.get('/history', (req: Request, res: Response) => {
  try {
    const { sort = 'last_played', order = 'desc', search, page = 1, limit = 20 } = req.query;
    
    let sql = `
      SELECT v.*, a.name as author_name, c.name as category_name, ph.play_progress, ph.last_played_at
      FROM videos v
      INNER JOIN play_history ph ON v.id = ph.video_id
      LEFT JOIN authors a ON v.author_id = a.id
      LEFT JOIN categories c ON v.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // 搜索
    if (search) {
      sql += ' AND v.title LIKE ?';
      params.push(`%${search}%`);
    }

    // 排序
    let orderClause = '';
    const sortField = sort === 'views' ? 'v.view_count' : 
                      sort === 'duration' ? 'v.duration' :
                      sort === 'size' ? 'v.file_size' :
                      sort === 'author' ? 'a.name' :
                      sort === 'category' ? 'c.name' :
                      sort === 'last_played' ? 'ph.last_played_at' :
                      'ph.last_played_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    orderClause = ` ORDER BY ${sortField} ${sortOrder}`;
    sql += orderClause;

    // 分页
    const offset = (Number(page) - 1) * Number(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const videos = getDb().prepare(sql).all(...params) as any[];

    // 获取总数
    let countSql = `
      SELECT COUNT(*) as total
      FROM videos v
      INNER JOIN play_history ph ON v.id = ph.video_id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    
    if (search) {
      countSql += ' AND v.title LIKE ?';
      countParams.push(`%${search}%`);
    }

    const { total } = getDb().prepare(countSql).get(...countParams) as { total: number };

    // 格式化返回数据
    const formattedVideos = videos.map(v => ({
      id: v.id,
      title: v.title,
      duration: formatDuration(v.duration || 0),
      durationSeconds: v.duration,
      author: v.author_name || '未知作者',
      views: formatViews(v.view_count || 0),
      viewsCount: v.view_count || 0,
      time: formatDate(v.file_modified_at || v.created_at),
      fileSize: formatFileSize(v.file_size || 0),
      category: v.category_name || '其他',
      width: v.width,
      height: v.height,
      lastPlayedAt: v.last_played_at,
      playProgress: v.play_progress
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
    console.error('获取历史记录失败:', error);
    res.status(500).json({ success: false, error: '获取历史记录失败' });
  }
});

// 清空历史记录
router.delete('/history', (req: Request, res: Response) => {
  try {
    getDb().prepare('DELETE FROM play_history').run();
    res.json({ success: true, message: '历史记录已清空' });
  } catch (error) {
    console.error('清空历史记录失败:', error);
    res.status(500).json({ success: false, error: '清空历史记录失败' });
  }
});

// 记录观看历史和播放进度
router.post('/videos/:id/play-history', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { progress } = req.body;

    getDb().prepare(`
      INSERT INTO play_history (video_id, play_progress, last_played_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(video_id) DO UPDATE SET
        play_progress = excluded.play_progress,
        last_played_at = excluded.last_played_at
    `).run(id, progress || 0);

    res.json({ success: true });
  } catch (error) {
    console.error('更新观看历史失败:', error);
    res.status(500).json({ success: false, error: '更新观看历史失败' });
  }
});

export function createVideoRoutes(): Router {
  return router;
}
