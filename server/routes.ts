import { Router, Request, Response } from 'express';
import db, { initDatabase, dbPath, reloadDatabase, getDb } from './database';
import { addVideoToDatabase, refreshAllVideos, scanAndAddVideos, scanProgress, generateSpriteForVideo, loadScanProgressFromDb, saveScanProgressToDb, clearScanProgressFromDb, startProgressAutoSave, stopProgressAutoSave, getScanProgress, stopScan, shouldStopScan, waitForAllFfmpegProcesses, findVideoFolders, clearStopScanFlags, getVideoCodecInfo } from './scanner';
import { spawn, ChildProcess, execSync } from 'child_process';

const PREVIEW_PARALLEL_LIMIT = 4;
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const router = Router();

// 检测可用的硬件加速编码器
let hardwareEncoder: string | null = null;

function detectHardwareEncoder(): string | null {
  try {
    // 检测 NVIDIA NVENC
    const nvencResult = execSync('ffmpeg -encoders 2>nul | findstr h264_nvenc', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (nvencResult.includes('h264_nvenc')) {
      console.log('检测到 NVIDIA NVENC 硬件加速');
      return 'h264_nvenc';
    }
  } catch (e) {
    // NVENC 不可用
  }
  
  try {
    // 检测 Intel QSV
    const qsvResult = execSync('ffmpeg -encoders 2>nul | findstr h264_qsv', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (qsvResult.includes('h264_qsv')) {
      console.log('检测到 Intel QSV 硬件加速');
      return 'h264_qsv';
    }
  } catch (e) {
    // QSV 不可用
  }
  
  console.log('未检测到硬件加速，使用 CPU 编码');
  return null;
}

// 初始化时检测硬件加速
hardwareEncoder = detectHardwareEncoder();

// 删除文件（带重试机制）
function deleteFileWithRetry(filePath: string, maxRetries: number = 5): boolean {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error: any) {
      if (i === maxRetries - 1) {
        console.error(`删除文件失败 (${filePath}):`, error.message);
        return false;
      }
      // 等待一段时间后重试（逐渐增加等待时间）
      const waitTime = 200 * (i + 1);
      const start = Date.now();
      while (Date.now() - start < waitTime) {
        // 忙等待
      }
    }
  }
  return false;
}

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
    if (author && author !== '全部') {
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
      LEFT JOIN authors a ON v.author_id = a.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    
    if (category && category !== '全部') {
      countSql += ' AND c.name = ?';
      countParams.push(category);
    }
    
    if (author && author !== '全部') {
      countSql += ' AND a.name = ?';
      countParams.push(author);
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
      SELECT v.*, a.name as author_name, c.name as category_name, ph.last_played_at
      FROM videos v
      LEFT JOIN authors a ON v.author_id = a.id
      LEFT JOIN categories c ON v.category_id = c.id
      LEFT JOIN play_history ph ON v.id = ph.video_id
      WHERE v.category_id = ?
    `;
    const params: any[] = [video.category_id];

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
      height: v.height,
      lastPlayedAt: v.last_played_at
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
router.put('/videos/:id', async (req: Request, res: Response) => {
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

    // 暂时禁用备注写入功能，避免文件损坏
    // TODO: 需要更安全的实现方式

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
    
    // 清理没有视频的作者
    getDb().prepare('DELETE FROM authors WHERE id NOT IN (SELECT DISTINCT author_id FROM videos WHERE author_id IS NOT NULL)').run();
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除视频失败:', error);
    res.status(500).json({ success: false, error: '删除视频失败' });
  }
});

// 检查精灵图是否存在
router.get('/videos/:id/sprite-exists', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const previewsDir = path.join(process.cwd(), 'data', 'previews');
    const spritePath = path.join(previewsDir, `${id}_sprite.jpg`);
    const exists = fs.existsSync(spritePath);
    res.json({ exists });
  } catch (error) {
    res.json({ exists: false });
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

// 批量修改分类名（修改该分类所有视频的文件夹名）
router.put('/categories/:id/rename', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName) {
      return res.status(400).json({ success: false, error: '分类名不能为空' });
    }

    const category = getDb().prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
    if (!category) {
      return res.status(404).json({ success: false, error: '分类不存在' });
    }

    const oldName = category.name;
    
    // 获取该分类的所有视频
    const videos = getDb().prepare('SELECT * FROM videos WHERE category_id = ?').all(id) as any[];
    let successCount = 0;
    let failCount = 0;

    // 按文件夹分组
    const folderMap = new Map<string, string[]>();
    for (const video of videos) {
      const dir = path.dirname(video.file_path);
      if (!folderMap.has(dir)) {
        folderMap.set(dir, []);
      }
      folderMap.get(dir)!.push(video.file_path);
    }

    // 处理每个文件夹
    for (const [oldDir, filePaths] of folderMap) {
      try {
        const parentDir = path.dirname(oldDir);
        const oldFolderName = path.basename(oldDir);
        
        // 检查文件夹名是否包含旧分类名
        if (oldFolderName === oldName || oldFolderName.includes(oldName)) {
          const newFolderName = oldFolderName.replace(oldName, newName);
          const newDir = path.join(parentDir, newFolderName);
          
          // 直接重命名文件夹
          if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
            fs.renameSync(oldDir, newDir);
          } else if (!fs.existsSync(newDir)) {
            // 旧文件夹不存在，创建新文件夹
            fs.mkdirSync(newDir, { recursive: true });
          }
          
          // 更新数据库中的文件路径
          for (const oldFilePath of filePaths) {
            const newFilePath = path.join(newDir, path.basename(oldFilePath));
            const updateVideo = getDb().prepare('UPDATE videos SET file_path = ? WHERE file_path = ?');
            updateVideo.run(newFilePath, oldFilePath);
          }
        }
        
        successCount += filePaths.length;
      } catch (e) {
        console.error(`修改文件夹 ${oldDir} 失败:`, e);
        failCount += filePaths.length;
      }
    }

    // 更新分类名
    const updateCategory = getDb().prepare('UPDATE categories SET name = ? WHERE id = ?');
    updateCategory.run(newName, id);

    res.json({ 
      success: true, 
      message: `修改完成，成功 ${successCount} 个，失败 ${failCount} 个` 
    });
  } catch (error) {
    console.error('批量修改分类名失败:', error);
    res.status(500).json({ success: false, error: '修改失败' });
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
      SELECT v.id, v.title, v.duration, v.view_count, v.file_modified_at, v.created_at, c.name as category_name
      FROM videos v
      LEFT JOIN categories c ON v.category_id = c.id
      WHERE v.author_id = ?
      ORDER BY v.file_modified_at DESC
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
          time: formatDate(v.file_modified_at || v.created_at),
          author: author.name,
          category: v.category_name
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

    // 查找包含视频的最深层文件夹
    const videoFolders = findVideoFolders(videoPath);
    
    if (videoFolders.length === 0) {
      return res.status(400).json({ success: false, error: '该路径下没有找到视频文件' });
    }

    // 添加所有找到的视频文件夹
    const addedPaths: { id: number; path: string; enabled: boolean }[] = [];
    const existingPaths: string[] = [];
    
    for (const folder of videoFolders) {
      try {
        const result = getDb().prepare('INSERT INTO video_paths (path) VALUES (?)').run(folder);
        addedPaths.push({
          id: result.lastInsertRowid as number,
          path: folder,
          enabled: true
        });
      } catch (e: any) {
        if (e.code === 'SQLITE_CONSTRAINT') {
          existingPaths.push(folder);
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        added: addedPaths,
        existing: existingPaths,
        total: videoFolders.length
      }
    });
  } catch (error: any) {
    console.error('添加路径失败:', error);
    res.status(500).json({ success: false, error: '添加路径失败' });
  }
});

// 清除路径数据（不删除路径配置）
router.post('/paths/:id/clear', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 获取路径信息
    const pathInfo = getDb().prepare('SELECT path FROM video_paths WHERE id = ?').get(id) as any;
    if (!pathInfo) {
      return res.status(404).json({ success: false, error: '路径不存在' });
    }
    
    // 等待所有ffmpeg进程完成
    await waitForAllFfmpegProcesses();
    
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
      deleteFileWithRetry(coverPath);
      
      const spritePath = path.join(previewsDir, `${video.id}_sprite.jpg`);
      deleteFileWithRetry(spritePath);
      
      const timestampPath = path.join(previewsDir, `${video.id}_timestamps.txt`);
      deleteFileWithRetry(timestampPath);
    }
    
    // 删除该路径的视频数据
    getDb().prepare(`
      DELETE FROM videos WHERE file_path LIKE ? OR file_path LIKE ?
    `).run(`${normalizedPath}%`, `${pathValue}%`);
    
    // 清理没有视频的作者
    getDb().prepare('DELETE FROM authors WHERE id NOT IN (SELECT DISTINCT author_id FROM videos WHERE author_id IS NOT NULL)').run();
    
    // 清除该路径的扫描进度
    clearScanProgressFromDb(parseInt(id));
    
    res.json({ 
      success: true, 
      message: '清除数据成功',
      deletedVideos: videos.length
    });
  } catch (error) {
    console.error('清除路径数据失败:', error);
    res.status(500).json({ success: false, error: '清除路径数据失败' });
  }
});

// 更新视频路径
router.put('/paths/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled, generate_previews } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(enabled ? 1 : 0);
    }
    
    if (generate_previews !== undefined) {
      updates.push('generate_previews = ?');
      values.push(generate_previews ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }
    
    values.push(id);
    
    const result = getDb().prepare(`UPDATE video_paths SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '路径不存在' });
    }
    
    const updatedPath = getDb().prepare('SELECT * FROM video_paths WHERE id = ?').get(id) as any;
    
    res.json({
      success: true,
      data: {
        id: updatedPath.id,
        path: updatedPath.path,
        enabled: updatedPath.enabled === 1,
        generate_previews: updatedPath.generate_previews === 1
      }
    });
  } catch (error) {
    console.error('更新路径失败:', error);
    res.status(500).json({ success: false, error: '更新路径失败' });
  }
});

// 删除视频路径（同时删除该路径的视频数据和封面/精灵图）
router.delete('/paths/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 获取路径信息
    const pathInfo = getDb().prepare('SELECT path FROM video_paths WHERE id = ?').get(id) as any;
    if (!pathInfo) {
      return res.status(404).json({ success: false, error: '路径不存在' });
    }
    
    // 等待所有ffmpeg进程完成
    await waitForAllFfmpegProcesses();
    
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
      deleteFileWithRetry(coverPath);
      
      const spritePath = path.join(previewsDir, `${video.id}_sprite.jpg`);
      deleteFileWithRetry(spritePath);
      
      const timestampPath = path.join(previewsDir, `${video.id}_timestamps.txt`);
      deleteFileWithRetry(timestampPath);
    }
    
    // 删除该路径的视频数据
    getDb().prepare(`
      DELETE FROM videos WHERE file_path LIKE ? OR file_path LIKE ?
    `).run(`${normalizedPath}%`, `${pathValue}%`);
    
    // 清理没有视频的作者
    getDb().prepare('DELETE FROM authors WHERE id NOT IN (SELECT DISTINCT author_id FROM videos WHERE author_id IS NOT NULL)').run();
    
    // 删除该路径的扫描进度
    clearScanProgressFromDb(parseInt(id));
    
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
  const { pathId } = req.query;
  
  let progress;
  if (pathId) {
    progress = loadScanProgressFromDb(parseInt(pathId as string));
  } else {
    progress = loadScanProgressFromDb();
  }
  res.json({
    success: true,
    data: progress
  });
});

// 停止扫描
router.post('/stop-scan', (req: Request, res: Response) => {
  const { pathId } = req.body;
  stopScan(pathId);
  res.json({
    success: true,
    message: '扫描已停止'
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
    
    const { path: scanPath, pathId } = req.body;
    
    let result;
    if (scanPath) {
      // 清除停止标志
      clearStopScanFlags(pathId);
      
      // 扫描指定路径（只添加新视频）
      const progress = getScanProgress(pathId);
      startProgressAutoSave(pathId);
      
      try {
        result = await scanAndAddVideos(scanPath, pathId);
        
        progress.status = 'completed';
        progress.phase = `已完成(${result.added}个视频)`;
        progress.videoCount = result.added;
        // 立即保存completed状态到数据库
        saveScanProgressToDb(progress, req.body.pathId);
      } finally {
        stopProgressAutoSave();
      }
    } else {
      // 扫描所有已配置的路径
      startProgressAutoSave();
      try {
        result = await refreshAllVideos();
      } finally {
        stopProgressAutoSave();
      }
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('扫描视频失败:', error);
    const progress = getScanProgress(req.body.pathId);
    progress.status = 'error';
    progress.phase = '扫描失败';
    saveScanProgressToDb(progress, req.body.pathId);
    stopProgressAutoSave();
    res.status(500).json({ success: false, error: '扫描视频失败' });
  }
});

// 生成预览图
router.post('/generate-previews', async (req: Request, res: Response) => {
  try {
    const { pathId } = req.body;
    
    if (!pathId) {
      return res.status(400).json({ success: false, error: '路径ID不能为空' });
    }
    
    // 获取路径信息
    const pathInfo = getDb().prepare('SELECT path FROM video_paths WHERE id = ?').get(pathId) as any;
    if (!pathInfo) {
      return res.status(404).json({ success: false, error: '路径不存在' });
    }
    
    // 清除停止标志
    clearStopScanFlags(pathId);
    
    const progress = getScanProgress(pathId);
    startProgressAutoSave(pathId);
    
    try {
      // 获取该路径下所有视频
      const normalizedPath = pathInfo.path.replace(/\\/g, '/');
      const pathVideos = getDb().prepare(`
        SELECT id FROM videos 
        WHERE file_path LIKE ? OR file_path LIKE ?
      `).all(`${normalizedPath}%`, `${pathInfo.path}%`) as any[];
      
      // 检查哪些视频缺少预览图
      const previewsDir = path.join(process.cwd(), 'data', 'previews');
      const videosWithoutPreview: number[] = [];
      
      for (const video of pathVideos) {
        const spritePath = path.join(previewsDir, `${video.id}_sprite.jpg`);
        if (!fs.existsSync(spritePath)) {
          videosWithoutPreview.push(video.id);
        }
      }
      
      if (videosWithoutPreview.length > 0) {
        progress.status = 'generating_previews';
        progress.total = videosWithoutPreview.length;
        progress.current = 0;
        progress.phase = `生成预览图(0/${videosWithoutPreview.length})...`;
        
        for (let i = 0; i < videosWithoutPreview.length; i++) {
          if (shouldStopScan(pathId)) {
            progress.status = 'idle';
            progress.phase = `已暂停(${progress.current}/${videosWithoutPreview.length})`;
            saveScanProgressToDb(progress, pathId);
            break;
          }
          
          const videoId = videosWithoutPreview[i];
          const video = getDb().prepare('SELECT file_path FROM videos WHERE id = ?').get(videoId) as any;
          if (video) {
            progress.currentFile = path.basename(video.file_path);
            progress.phase = `生成预览图(${i + 1}/${videosWithoutPreview.length}): ${path.basename(video.file_path)}`;
          }
          
          await generateSpriteForVideo(videoId);
          
          progress.current = i + 1;
        }
      }
      
      progress.status = 'completed';
      progress.phase = `已完成(${videosWithoutPreview.length}个预览图)`;
      progress.videoCount = videosWithoutPreview.length;
      saveScanProgressToDb(progress, pathId);
      
      res.json({
        success: true,
        data: { added: videosWithoutPreview.length, total: pathVideos.length }
      });
    } finally {
      stopProgressAutoSave();
    }
  } catch (error) {
    console.error('生成预览图失败:', error);
    const progress = getScanProgress(req.body.pathId);
    progress.status = 'error';
    progress.phase = '生成预览图失败';
    saveScanProgressToDb(progress, req.body.pathId);
    stopProgressAutoSave();
    res.status(500).json({ success: false, error: '生成预览图失败' });
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
    
    const { path: scanPath, pathId } = req.body;
    
    if (!scanPath) {
      return res.status(400).json({ success: false, error: '路径不能为空' });
    }
    
    // 清除旧的扫描进度
    clearScanProgressFromDb(pathId);
    const progress = getScanProgress(pathId);
    startProgressAutoSave(pathId);
    
    try {
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
      
      // 清理没有视频的作者
      getDb().prepare('DELETE FROM authors WHERE id NOT IN (SELECT DISTINCT author_id FROM videos WHERE author_id IS NOT NULL)').run();
      
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
      const result = await scanAndAddVideos(scanPath, pathId);
      
      progress.status = 'completed';
      progress.phase = `已完成(${result.added}个视频)`;
      progress.videoCount = result.added;
      
      res.json({
        success: true,
        data: result
      });
    } finally {
      stopProgressAutoSave();
    }
  } catch (error) {
    console.error('重新扫描失败:', error);
    const progress = getScanProgress(req.body.pathId);
    progress.status = 'error';
    progress.phase = '重新扫描失败';
    saveScanProgressToDb(progress, req.body.pathId);
    stopProgressAutoSave();
    res.status(500).json({ success: false, error: '重新扫描失败' });
  }
});

// 视频流播放接口 - 支持Range请求和实时转码
router.get('/stream/:id', async (req: Request, res: Response) => {
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

    // 检测视频编码
    const codecInfo = await getVideoCodecInfo(filePath);
    
    if (codecInfo.needsTranscoding) {
      if (codecInfo.onlyContainerTranscode) {
        // 编码支持但容器不支持：先转成临时文件，再支持 Range 请求
        console.log(`视频 ${id} 快速转码（仅容器）: ${codecInfo.containerFormat} -> mp4 (编码: ${codecInfo.videoCodec})`);
        
        // 创建临时目录
        const tempDir = path.join(process.cwd(), 'data', 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, `temp_${id}_${Date.now()}.mp4`);
        
        const ffmpegArgs = [
          '-i', filePath,
          '-c', 'copy',
          '-movflags', 'faststart',
          '-y',
          tempFilePath
        ];
        
        console.log(`执行 ffmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);
        
        try {
          // 先完成转码到临时文件
          await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ffmpegArgs);
            let ffmpegErrorLog = '';
            
            ffmpeg.stderr.on('data', (data) => {
              ffmpegErrorLog += data.toString();
            });
            
            ffmpeg.on('close', (code) => {
              if (code !== 0 && code !== null) {
                console.error(`ffmpeg 转码结束，退出码: ${code}`);
                console.error(`ffmpeg 错误日志:\n${ffmpegErrorLog}`);
                reject(new Error('转码失败'));
              } else {
                console.log(`视频 ${id} 转码完成，临时文件: ${tempFilePath}`);
                resolve();
              }
            });
            
            ffmpeg.on('error', (err) => {
              console.error('ffmpeg 转码错误:', err);
              reject(err);
            });
          });
          
          // 转码成功，用临时文件支持 Range 请求
          const stat = fs.statSync(tempFilePath);
          const fileSize = stat.size;
          const range = req.headers.range;
          
          if (range) {
            // 解析Range头
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;
            
            const fileStream = fs.createReadStream(tempFilePath, { start, end });
            
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': 'video/mp4'
            });
            
            fileStream.pipe(res);
            
            // 传输完成后删除临时文件
            fileStream.on('close', () => {
              setTimeout(() => {
                try {
                  if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                    console.log(`临时文件已删除: ${tempFilePath}`);
                  }
                } catch (e) {
                  console.error('删除临时文件失败:', e);
                }
              }, 5000);
            });
          } else {
            // 不带Range头，返回整个文件
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Content-Type': 'video/mp4'
            });
            
            const fileStream = fs.createReadStream(tempFilePath);
            fileStream.pipe(res);
            
            // 传输完成后删除临时文件
            fileStream.on('close', () => {
              setTimeout(() => {
                try {
                  if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                    console.log(`临时文件已删除: ${tempFilePath}`);
                  }
                } catch (e) {
                  console.error('删除临时文件失败:', e);
                }
              }, 5000);
            });
          }
          
          // 客户端断开连接时删除临时文件
          req.on('close', () => {
            setTimeout(() => {
              try {
                if (fs.existsSync(tempFilePath)) {
                  fs.unlinkSync(tempFilePath);
                  console.log(`客户端断开连接，删除临时文件: ${tempFilePath}`);
                }
              } catch (e) {
                console.error('删除临时文件失败:', e);
              }
            }, 1000);
          });
          
        } catch (err) {
          // 转码失败，删除临时文件（如果存在）
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } catch (e) {
            // 忽略
          }
          
          // 回退到直接流式传输
          console.log('转码失败，尝试直接流式传输...');
          try {
            const stat = fs.statSync(filePath);
            const fileSize = stat.size;
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Content-Type': 'video/mp4'
            });
            fs.createReadStream(filePath).pipe(res);
          } catch (fallbackErr) {
            console.error('回退也失败:', fallbackErr);
            res.status(500).json({ success: false, error: '视频播放失败' });
          }
        }
        
      } else {
        // 编码不支持：完整转码，使用缓存机制支持进度拖动
        console.log(`视频 ${id} 完整转码 (容器: ${codecInfo.containerFormat}, 编码: ${codecInfo.videoCodec} -> h264)`);
        
        // 创建转码缓存目录
        const cacheDir = path.join(process.cwd(), 'data', 'transcode_cache');
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        
        // 缓存文件名：基于视频ID和原文件修改时间
        const originalStat = fs.statSync(filePath);
        const cacheFileName = `${id}_${originalStat.mtimeMs.toFixed(0)}.mp4`;
        const cacheFilePath = path.join(cacheDir, cacheFileName);
        
        // 检查缓存是否存在
        let needTranscode = !fs.existsSync(cacheFilePath);
        
        if (needTranscode) {
          // 清理该视频的旧缓存文件
          try {
            const oldCacheFiles = fs.readdirSync(cacheDir).filter(f => f.startsWith(`${id}_`));
            for (const oldFile of oldCacheFiles) {
              try {
                fs.unlinkSync(path.join(cacheDir, oldFile));
                console.log(`清理旧缓存: ${oldFile}`);
              } catch (e) {
                // 忽略
              }
            }
          } catch (e) {
            // 忽略
          }
          
          // 开始转码
          console.log(`开始转码到缓存: ${cacheFilePath}`);
          
          // 根据硬件加速情况选择编码参数
          let ffmpegArgs: string[];
          
          if (hardwareEncoder === 'h264_nvenc') {
            // NVIDIA NVENC 硬件加速
            ffmpegArgs = [
              '-i', filePath,
              '-c:v', 'h264_nvenc',
              '-preset', 'p1',
              '-tune', 'll',
              '-cq', '28',
              '-c:a', 'aac',
              '-b:a', '128k',
              '-movflags', '+faststart',
              '-y',
              cacheFilePath
            ];
          } else if (hardwareEncoder === 'h264_qsv') {
            // Intel QSV 硬件加速
            ffmpegArgs = [
              '-i', filePath,
              '-c:v', 'h264_qsv',
              '-preset', 'veryfast',
              '-global_quality', '28',
              '-c:a', 'aac',
              '-b:a', '128k',
              '-movflags', '+faststart',
              '-y',
              cacheFilePath
            ];
          } else {
            // CPU 编码（优化参数）
            ffmpegArgs = [
              '-i', filePath,
              '-c:v', 'libx264',
              '-preset', 'ultrafast',
              '-tune', 'fastdecode',
              '-crf', '28',
              '-threads', '0',
              '-c:a', 'aac',
              '-b:a', '128k',
              '-movflags', '+faststart',
              '-y',
              cacheFilePath
            ];
          }
          
          console.log(`执行 ffmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);
          
          try {
            await new Promise<void>((resolve, reject) => {
              const ffmpeg = spawn('ffmpeg', ffmpegArgs);
              let ffmpegErrorLog = '';
              
              ffmpeg.stderr.on('data', (data) => {
                ffmpegErrorLog += data.toString();
                if (data.toString().includes('frame=')) {
                  process.stdout.write(data);
                }
              });
              
              ffmpeg.on('close', (code) => {
                if (code !== 0 && code !== null) {
                  console.error(`ffmpeg 转码结束，退出码: ${code}`);
                  console.error(`ffmpeg 错误日志:\n${ffmpegErrorLog}`);
                  reject(new Error('转码失败'));
                } else {
                  console.log(`视频 ${id} 转码完成，缓存: ${cacheFilePath}`);
                  resolve();
                }
              });
              
              ffmpeg.on('error', (err) => {
                console.error('ffmpeg 转码错误:', err);
                reject(err);
              });
            });
          } catch (err) {
            // 转码失败，删除可能的部分文件
            try {
              if (fs.existsSync(cacheFilePath)) {
                fs.unlinkSync(cacheFilePath);
              }
            } catch (e) {
              // 忽略
            }
            
            // 回退到直接流式传输
            console.log('转码失败，尝试直接流式传输...');
            try {
              const stat = fs.statSync(filePath);
              const fileSize = stat.size;
              res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4'
              });
              fs.createReadStream(filePath).pipe(res);
            } catch (fallbackErr) {
              console.error('回退也失败:', fallbackErr);
              res.status(500).json({ success: false, error: '视频播放失败' });
            }
            return;
          }
        } else {
          console.log(`使用缓存文件: ${cacheFilePath}`);
        }
        
        // 使用缓存文件支持 Range 请求
        try {
          const stat = fs.statSync(cacheFilePath);
          const fileSize = stat.size;
          const range = req.headers.range;
          
          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;
            
            const fileStream = fs.createReadStream(cacheFilePath, { start, end });
            
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': 'video/mp4'
            });
            
            fileStream.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Content-Type': 'video/mp4'
            });
            
            fs.createReadStream(cacheFilePath).pipe(res);
          }
        } catch (err) {
          console.error('读取缓存文件失败:', err);
          res.status(500).json({ success: false, error: '视频播放失败' });
        }
      }

    } else {
      // 不需要转码：直接流式传输
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
    // 清除旧的扫描进度
    clearScanProgressFromDb();
    startProgressAutoSave();
    
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
      getDb().exec('DELETE FROM scan_progress');
      getDb().exec('DELETE FROM video_paths');
      
      // 重置自增计数器
      getDb().exec("DELETE FROM sqlite_sequence WHERE name='videos'");
      getDb().exec("DELETE FROM sqlite_sequence WHERE name='authors'");
      getDb().exec("DELETE FROM sqlite_sequence WHERE name='categories'");
      getDb().exec("DELETE FROM sqlite_sequence WHERE name='favorite_frames'");
      getDb().exec("DELETE FROM sqlite_sequence WHERE name='play_history'");
      getDb().exec("DELETE FROM sqlite_sequence WHERE name='scan_progress'");
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
    } finally {
      stopProgressAutoSave();
    }
  } catch (error) {
    console.error('全部重新扫描失败:', error);
    scanProgress.status = 'error';
    scanProgress.phase = '全部重新扫描失败';
    saveScanProgressToDb(scanProgress);
    stopProgressAutoSave();
    res.status(500).json({ success: false, error: '全部重新扫描失败' });
  }
});

// 修改视频的标题和文件路径（同时重命名文件）
router.put('/videos/:id/rename', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newTitle, newAuthor } = req.body;
    
    console.log(`收到重命名请求: id=${id}, newTitle=${newTitle}, newAuthor=${newAuthor}`);

    const video = getDb().prepare('SELECT * FROM videos WHERE id = ?').get(id) as any;
    if (!video) {
      return res.status(404).json({ success: false, error: '视频不存在' });
    }

    const oldFilePath = video.file_path;
    const ext = path.extname(oldFilePath);
    const dir = path.dirname(oldFilePath);
    let newFileName = '';
    let finalTitle = newTitle || video.title;
    
    console.log(`原文件路径: ${oldFilePath}, 扩展名: ${ext}, 目录: ${dir}`);
    
    // 如果提供了 newAuthor（包括空字符串表示清除作者）
    if (newAuthor !== undefined) {
      if (newAuthor && newAuthor.trim()) {
        // 有新作者名
        newFileName = `【${newAuthor.trim()}】${finalTitle}${ext}`;
        console.log(`设置新作者: ${newAuthor.trim()}, 新文件名: ${newFileName}`);
      } else {
        // 清除作者，直接用标题
        newFileName = `${finalTitle}${ext}`;
        console.log(`清除作者, 新文件名: ${newFileName}`);
      }
    } else {
      // 从原文件名中提取作者名（如果有）
      const oldFileName = path.basename(oldFilePath, ext);
      const authorMatch = oldFileName.match(/^【(.+?)】(.*)$/);
      if (authorMatch) {
        if (newTitle) {
          // 只修改标题，保留作者
          newFileName = `【${authorMatch[1]}】${newTitle}${ext}`;
        } else {
          // 不修改任何东西
          newFileName = oldFileName + ext;
        }
      } else {
        newFileName = `${finalTitle}${ext}`;
      }
    }
    
    const newFilePath = path.join(dir, newFileName);
    console.log(`新文件路径: ${newFilePath}`);

    // 检查新路径是否已存在
    if (fs.existsSync(newFilePath) && newFilePath !== oldFilePath) {
      return res.status(400).json({ success: false, error: '目标文件已存在' });
    }

    // 重命名文件
    if (newFilePath !== oldFilePath) {
      fs.renameSync(oldFilePath, newFilePath);
      console.log(`重命名文件: ${oldFilePath} -> ${newFilePath}`);
    }

    // 更新数据库中的标题和路径
    const updateVideoPath = getDb().prepare('UPDATE videos SET title = ?, file_path = ? WHERE id = ?');
    updateVideoPath.run(finalTitle, newFilePath, id);

    // 如果修改了作者，同时更新作者信息
    if (newAuthor !== undefined) {
      let authorId: number | null = null;
      if (newAuthor && newAuthor.trim()) {
        let authorResult = getDb().prepare('SELECT id FROM authors WHERE name = ?').get(newAuthor.trim());
        if (authorResult) {
          authorId = (authorResult as any).id;
        } else {
          const insertAuthor = getDb().prepare('INSERT INTO authors (name) VALUES (?)').run(newAuthor.trim());
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

// 移动视频到其他分类
router.put('/videos/:id/move', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { categoryName } = req.body;

    if (!categoryName) {
      return res.status(400).json({ success: false, error: '分类名不能为空' });
    }

    const video = getDb().prepare('SELECT * FROM videos WHERE id = ?').get(id) as any;
    if (!video) {
      return res.status(404).json({ success: false, error: '视频不存在' });
    }

    // 获取或创建目标分类
    let categoryResult = getDb().prepare('SELECT id FROM categories WHERE name = ?').get(categoryName);
    let categoryId: number;
    
    if (categoryResult) {
      categoryId = (categoryResult as any).id;
    } else {
      const insertCategory = getDb().prepare('INSERT INTO categories (name) VALUES (?)').run(categoryName);
      categoryId = insertCategory.lastInsertRowid as number;
    }

    // 更新视频的分类
    const updateVideo = getDb().prepare('UPDATE videos SET category_id = ? WHERE id = ?');
    updateVideo.run(categoryId, id);

    res.json({ success: true, message: '移动成功' });
  } catch (error) {
    console.error('移动视频失败:', error);
    res.status(500).json({ success: false, error: '移动失败' });
  }
});

// 打开视频源文件所在目录
router.post('/videos/:id/open', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const video = getDb().prepare('SELECT * FROM videos WHERE id = ?').get(id) as any;
    if (!video) {
      return res.status(404).json({ success: false, error: '视频不存在' });
    }

    const filePath = video.file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }

    // 使用 Windows 命令打开文件所在目录并选中文件
    exec(`explorer /select,"${filePath}"`);
    
    res.json({ success: true, message: '已打开文件所在目录' });
  } catch (error) {
    console.error('打开文件失败:', error);
    res.status(500).json({ success: false, error: '打开文件失败' });
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
    // 先删除有外键依赖的表
    getDb().exec('DELETE FROM scan_progress');
    getDb().exec('DELETE FROM favorite_frames');
    getDb().exec('DELETE FROM play_history');
    getDb().exec('DELETE FROM videos');
    getDb().exec('DELETE FROM authors');
    getDb().exec('DELETE FROM categories');
    getDb().exec('DELETE FROM video_paths');
    
    // 重置自增计数器
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='videos'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='authors'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='categories'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='favorite_frames'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='play_history'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='video_paths'");
    getDb().exec("DELETE FROM sqlite_sequence WHERE name='scan_progress'");
    
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

    // 使用本地时间 (UTC+8)
    const now = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

    getDb().prepare(`
      INSERT INTO play_history (video_id, play_progress, last_played_at)
      VALUES (?, ?, ?)
      ON CONFLICT(video_id) DO UPDATE SET
        play_progress = excluded.play_progress,
        last_played_at = excluded.last_played_at
    `).run(id, progress || 0, now);

    res.json({ success: true });
  } catch (error) {
    console.error('更新观看历史失败:', error);
    res.status(500).json({ success: false, error: '更新观看历史失败' });
  }
});

export function createVideoRoutes(): Router {
  return router;
}
