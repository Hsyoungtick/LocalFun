import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import db from './database';

const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts'];

// 扫描进度状态
export interface ScanProgress {
  status: 'idle' | 'scanning' | 'generating_covers' | 'generating_previews' | 'completed' | 'error';
  current: number;
  total: number;
  currentFile: string;
  message: string;
  startTime: number;
  phase: string; // 当前阶段描述
  videoCount: number; // 已导入的视频数
}

export const scanProgress: ScanProgress = {
  status: 'idle',
  current: 0,
  total: 0,
  currentFile: '',
  message: '',
  startTime: 0,
  phase: '',
  videoCount: 0
};

// 获取数据目录路径
const dataDir = path.join(process.cwd(), 'data');
const coversDir = path.join(dataDir, 'covers');
const previewsDir = path.join(dataDir, 'previews');

// 确保目录存在
function ensureDirs() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }
  if (!fs.existsSync(previewsDir)) {
    fs.mkdirSync(previewsDir, { recursive: true });
  }
}

// 初始化时创建目录
ensureDirs();

// 检查ffmpeg是否可用
let ffmpegAvailable = false;
function checkFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', ['-version']);
    ffprobe.on('close', (code) => {
      ffmpegAvailable = code === 0;
      resolve(ffmpegAvailable);
    });
    ffprobe.on('error', () => {
      ffmpegAvailable = false;
      resolve(false);
    });
  });
}

// 初始化时检查ffmpeg
checkFfmpeg().then(available => {
  if (!available) {
    console.warn('警告: ffmpeg/ffprobe 未安装或不在环境变量中，将无法获取视频信息和生成封面');
    console.warn('请安装 ffmpeg 并添加到系统环境变量: https://ffmpeg.org/download.html');
  }
});

// 视频信息接口
interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  size: number;
}

// 使用ffprobe获取视频信息
export function getVideoInfo(filePath: string): Promise<VideoInfo | null> {
  return new Promise((resolve) => {
    if (!ffmpegAvailable) {
      // 没有ffmpeg时，返回基本信息
      try {
        const stats = fs.statSync(filePath);
        resolve({
          duration: 0,
          width: 0,
          height: 0,
          size: stats.size
        });
      } catch {
        resolve(null);
      }
      return;
    }

    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]);

    let output = '';
    
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        // ffprobe失败时，返回基本信息
        try {
          const stats = fs.statSync(filePath);
          resolve({
            duration: 0,
            width: 0,
            height: 0,
            size: stats.size
          });
        } catch {
          resolve(null);
        }
        return;
      }

      try {
        const info = JSON.parse(output);
        const videoStream = info.streams?.find((s: any) => s.codec_type === 'video');
        
        if (videoStream) {
          resolve({
            duration: parseFloat(info.format?.duration || 0),
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            size: parseInt(info.format?.size || 0)
          });
        } else {
          resolve(null);
        }
      } catch (e) {
        // 解析失败时，返回基本信息
        try {
          const stats = fs.statSync(filePath);
          resolve({
            duration: 0,
            width: 0,
            height: 0,
            size: stats.size
          });
        } catch {
          resolve(null);
        }
      }
    });

    ffprobe.on('error', () => {
      // ffprobe执行错误时，返回基本信息
      try {
        const stats = fs.statSync(filePath);
        resolve({
          duration: 0,
          width: 0,
          height: 0,
          size: stats.size
        });
      } catch {
        resolve(null);
      }
    });
  });
}

// 使用ffmpeg生成视频封面
export function generateThumbnail(filePath: string, videoId: number, duration?: number): Promise<string | null> {
  return new Promise((resolve) => {
    if (!ffmpegAvailable) {
      resolve(null);
      return;
    }

    // 确保目录存在
    ensureDirs();

    const thumbnailPath = path.join(coversDir, `${videoId}.jpg`);
    const timestamp = duration && duration > 0 ? duration / 2 : 5;
    
    // 关键优化：-ss 放在 -i 之前，实现快速seek
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-ss', timestamp.toString(),
      '-i', filePath,
      '-vframes', '1',
      '-q:v', '2',
      '-vf', 'scale=320:-1',
      '-an',
      thumbnailPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(thumbnailPath)) {
        resolve(`/covers/${videoId}.jpg`);
      } else {
        resolve(null);
      }
    });

    ffmpeg.on('error', () => {
      resolve(null);
    });
  });
}

// 生成预览精灵图（使用快速seek方式）
export async function generateSprite(filePath: string, videoId: number, duration: number): Promise<string | null> {
  if (!ffmpegAvailable || duration <= 0) {
    return null;
  }

  // 确保目录存在
  ensureDirs();

  const spritePath = path.join(previewsDir, `${videoId}_sprite.jpg`);
  const frameCount = 30;
  const frameWidth = 320;
  const frameHeight = 180;
  const cols = 6; // 每行6帧
  const rows = 5;  // 5行

  // 并行提取50帧，每帧使用快速seek
  const tempFrames: string[] = [];
  
  const promises = [];
  for (let i = 0; i < frameCount; i++) {
    const timestamp = duration * (i + 1) / (frameCount + 1);
    const tempPath = path.join(previewsDir, `${videoId}_temp_${i}.jpg`);
    tempFrames.push(tempPath);
    
    promises.push(new Promise<void>((resolve) => {
      // 关键优化：-ss 在 -i 之前，快速seek到目标位置
      // 使用 pad 滤镜填充黑边，保持比例
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-ss', String(timestamp.toFixed(2)),
        '-i', filePath,
        '-vframes', '1',
        '-vf', `scale=${frameWidth}:${frameHeight}:force_original_aspect_ratio=decrease,pad=${frameWidth}:${frameHeight}:(ow-iw)/2:(oh-ih)/2:black`,
        '-q:v', '2',
        '-an',
        '-threads', '1',
        tempPath
      ]);
      
      ffmpeg.on('close', () => resolve());
      ffmpeg.on('error', () => resolve());
    }));
  }

  // 等待所有帧提取完成
  await Promise.all(promises);

  // 检查有多少帧成功生成
  const existingFrames = tempFrames.filter(f => fs.existsSync(f));
  
  if (existingFrames.length === 0) {
    return null;
  }

  // 使用 ffmpeg 将所有帧合并成精灵图（10列 x N行）
  return new Promise((resolve) => {
    // 创建输入文件列表
    const concatInput = existingFrames.map(f => `file '${f}'`).join('\n');
    const listPath = path.join(previewsDir, `${videoId}_list.txt`);
    fs.writeFileSync(listPath, concatInput);

    // 计算实际的行列数
    const actualFrames = existingFrames.length;
    const actualCols = Math.min(cols, actualFrames);
    const actualRows = Math.ceil(actualFrames / cols);

    // 计算输出尺寸：每帧宽度 * 列数 x 每帧高度 * 行数
    const outputWidth = frameWidth * actualCols;
    const outputHeight = frameHeight * actualRows;

    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-vf', `tile=${actualCols}x${actualRows}:margin=0:padding=0`,
      '-frames:v', '1',
      '-q:v', '2',
      spritePath
    ]);

    ffmpeg.on('close', (code) => {
      // 清理临时文件
      try {
        fs.unlinkSync(listPath);
        existingFrames.forEach(f => {
          try { fs.unlinkSync(f); } catch {}
        });
      } catch {}

      if (code === 0 && fs.existsSync(spritePath)) {
        resolve(`/previews/${videoId}_sprite.jpg`);
      } else {
        resolve(null);
      }
    });

    ffmpeg.on('error', () => {
      resolve(null);
    });
  });
}

// 扫描目录中的视频文件
export async function scanDirectory(dirPath: string): Promise<string[]> {
  const videos: string[] = [];

  async function scan(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (VIDEO_EXTENSIONS.includes(ext)) {
            videos.push(fullPath);
          }
        }
      }
    } catch (e) {
      console.error(`扫描目录失败: ${dir}`, e);
    }
  }

  await scan(dirPath);
  return videos;
}

// 从标题开头提取作者名（【作者名】格式）
function extractAuthorFromTitle(title: string): { authorName: string | null; cleanTitle: string } {
  const match = title.match(/^【(.+?)】(.*)$/);
  if (match) {
    return {
      authorName: match[1].trim(),
      cleanTitle: match[2].trim() || title
    };
  }
  return {
    authorName: null,
    cleanTitle: title
  };
}

// 添加视频到数据库（只生成封面）
export async function addVideoToDatabase(filePath: string): Promise<number | null> {
  try {
    // 检查是否已存在
    const existing = db.prepare('SELECT id FROM videos WHERE file_path = ?').get(filePath);
    if (existing) {
      return (existing as any).id;
    }

    // 获取视频信息（即使没有ffmpeg也会返回基本信息）
    const info = await getVideoInfo(filePath);
    if (!info) {
      console.error(`无法访问视频文件: ${filePath}`);
      return null;
    }

    // 获取文件修改时间
    const stats = fs.statSync(filePath);
    const fileModifiedAt = stats.mtime.toISOString();

    // 从文件名提取标题
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // 从标题提取作者名
    const { authorName, cleanTitle } = extractAuthorFromTitle(fileName);
    const title = cleanTitle;

    // 从文件路径提取直接父目录名作为分类
    // 例如: E:\Video\subfolder\video.mp4 -> subfolder
    const pathParts = filePath.split(/[\\/]/);
    let categoryName = '未分类';
    if (pathParts.length >= 2) {
      // 获取视频文件的直接父目录名
      categoryName = pathParts[pathParts.length - 2] || '未分类';
    }

    // 获取或创建分类
    let categoryResult = db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryName);
    let categoryId: number;
    
    if (categoryResult) {
      categoryId = (categoryResult as any).id;
    } else {
      const insertResult = db.prepare('INSERT INTO categories (name) VALUES (?)').run(categoryName);
      categoryId = insertResult.lastInsertRowid as number;
    }

    // 获取或创建作者
    let authorId: number | null = null;
    if (authorName) {
      let authorResult = db.prepare('SELECT id FROM authors WHERE name = ?').get(authorName);
      if (authorResult) {
        authorId = (authorResult as any).id;
      } else {
        const insertAuthor = db.prepare('INSERT INTO authors (name) VALUES (?)').run(authorName);
        authorId = insertAuthor.lastInsertRowid as number;
        console.log(`创建新作者: ${authorName}`);
      }
    }

    // 插入视频记录
    const result = db.prepare(`
      INSERT INTO videos (title, file_path, file_size, duration, width, height, file_modified_at, category_id, author_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, filePath, info.size, info.duration, info.width, info.height, fileModifiedAt, categoryId, authorId);

    const videoId = result.lastInsertRowid as number;

    // 生成封面（不需要更新数据库，封面路径由 videoId 决定）
    await generateThumbnail(filePath, videoId, info.duration);

    console.log(`添加视频: ${title} (ID: ${videoId}, 分类: ${categoryName}, 作者: ${authorName || '未知'})`);
    return videoId;
  } catch (e) {
    console.error(`添加视频失败: ${filePath}`, e);
    return null;
  }
}

// 为视频生成精灵图
export async function generateSpriteForVideo(videoId: number): Promise<void> {
  try {
    const video = db.prepare('SELECT file_path, duration FROM videos WHERE id = ?').get(videoId) as any;
    if (video && video.duration > 0) {
      await generateSprite(video.file_path, videoId, video.duration);
    }
  } catch (e) {
    console.error(`生成精灵图失败: videoId=${videoId}`, e);
  }
}

// 扫描并添加所有视频（带进度更新）
export async function scanAndAddVideos(dirPath: string, updateProgress: boolean = false): Promise<{ added: number; skipped: number; failed: number; videoIds: number[] }> {
  const videos = await scanDirectory(dirPath);
  let added = 0;
  let skipped = 0;
  let failed = 0;
  const videoIds: number[] = [];

  if (updateProgress) {
    scanProgress.total = videos.length;
    scanProgress.status = 'scanning';
    scanProgress.phase = '扫描视频文件...';
    scanProgress.startTime = Date.now();
  }

  for (let i = 0; i < videos.length; i++) {
    const videoPath = videos[i];
    
    if (updateProgress) {
      scanProgress.current = i + 1;
      scanProgress.currentFile = path.basename(videoPath);
      scanProgress.message = path.basename(videoPath);
    }

    const existing = db.prepare('SELECT id FROM videos WHERE file_path = ?').get(videoPath);
    if (existing) {
      skipped++;
      continue;
    }
    
    const result = await addVideoToDatabase(videoPath);
    if (result === null) {
      failed++;
    } else {
      added++;
      videoIds.push(result);
    }
  }

  return { added, skipped, failed, videoIds };
}

// 刷新所有已配置路径的视频（带进度更新）
export async function refreshAllVideos(): Promise<{ added: number; total: number }> {
  const paths = db.prepare('SELECT path FROM video_paths WHERE enabled = 1').all() as { path: string }[];
  let totalAdded = 0;
  let totalVideos = 0;
  const allVideoIds: number[] = [];

  // 计算总视频数
  let totalFiles = 0;
  for (const { path: dirPath } of paths) {
    if (fs.existsSync(dirPath)) {
      const videos = await scanDirectory(dirPath);
      totalFiles += videos.length;
    }
  }

  scanProgress.total = totalFiles;
  scanProgress.current = 0;
  scanProgress.status = 'scanning';
  scanProgress.phase = '扫描视频文件...';
  scanProgress.message = '';
  scanProgress.startTime = Date.now();
  scanProgress.videoCount = 0;

  // 第一阶段：扫描所有路径，生成封面
  for (const { path: dirPath } of paths) {
    if (fs.existsSync(dirPath)) {
      const result = await scanAndAddVideos(dirPath, true);
      totalAdded += result.added;
      totalVideos += result.added + result.skipped;
      allVideoIds.push(...result.videoIds);
      scanProgress.videoCount += result.added;
    }
  }

  // 第二阶段：生成所有精灵图
  if (allVideoIds.length > 0) {
    scanProgress.status = 'generating_previews';
    scanProgress.phase = '生成精灵图...';
    scanProgress.total = allVideoIds.length;
    scanProgress.current = 0;

    for (let i = 0; i < allVideoIds.length; i++) {
      scanProgress.current = i + 1;
      const video = db.prepare('SELECT file_path FROM videos WHERE id = ?').get(allVideoIds[i]) as any;
      if (video) {
        scanProgress.currentFile = path.basename(video.file_path);
        scanProgress.message = path.basename(video.file_path);
      }
      await generateSpriteForVideo(allVideoIds[i]);
    }
  }

  scanProgress.status = 'completed';
  scanProgress.phase = `已完成（${scanProgress.videoCount} 个视频）`;
  scanProgress.message = '';

  // 获取总视频数
  const count = db.prepare('SELECT COUNT(*) as count FROM videos').get() as { count: number };
  
  return { added: totalAdded, total: count.count };
}
