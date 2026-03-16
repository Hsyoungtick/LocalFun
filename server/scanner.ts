import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getDb } from './database';

const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts'];

const PARALLEL_LIMIT = 16;

function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  return new Promise((resolve) => {
    const results: R[] = [];
    let currentIndex = 0;
    
    const processBatch = async () => {
      const batch: T[] = [];
      for (let i = 0; i < batchSize && currentIndex < items.length; i++) {
        batch.push(items[currentIndex++]);
      }
      
      if (batch.length === 0) {
        resolve(results);
        return;
      }
      
      const promises = batch.map(item => processor(item));
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
      
      if (onProgress) {
        onProgress(currentIndex, items.length);
      }
      
      if (currentIndex < items.length) {
        processBatch();
      } else {
        resolve(results);
      }
    };
    
    processBatch();
  });
}

// 全局ffmpeg进程管理
const activeFfmpegProcesses = new Set<ChildProcess>();

// 注册ffmpeg进程
function registerFfmpegProcess(proc: ChildProcess): ChildProcess {
  activeFfmpegProcesses.add(proc);
  proc.on('close', () => {
    activeFfmpegProcesses.delete(proc);
  });
  proc.on('error', () => {
    activeFfmpegProcesses.delete(proc);
  });
  return proc;
}

// 等待所有ffmpeg进程完成
export async function waitForAllFfmpegProcesses(timeout: number = 5000): Promise<void> {
  const startTime = Date.now();
  
  // 先等待进程自然完成
  while (activeFfmpegProcesses.size > 0 && Date.now() - startTime < timeout) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // 如果超时后还有进程，强制终止
  if (activeFfmpegProcesses.size > 0) {
    const { execSync } = require('child_process');
    try {
      if (process.platform === 'win32') {
        execSync('taskkill /F /IM ffmpeg.exe', { encoding: 'utf8' });
      } else {
        execSync('pkill -9 ffmpeg', { encoding: 'utf8' });
      }
    } catch (error) {
      // 忽略错误
    }
    
    // 清空进程列表
    activeFfmpegProcesses.clear();
  }
}

// 获取活跃的ffmpeg进程数量
export function getActiveFfmpegCount(): number {
  return activeFfmpegProcesses.size;
}

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

// 使用Map存储每个路径的独立进度
const progressMap = new Map<number | undefined, ScanProgress>();

// 停止扫描的标志
const stopScanFlags = new Map<number | undefined, boolean>();

// 获取指定路径的进度对象
export function getScanProgress(pathId?: number): ScanProgress {
  if (!progressMap.has(pathId)) {
    progressMap.set(pathId, {
      status: 'idle',
      current: 0,
      total: 0,
      currentFile: '',
      message: '',
      startTime: 0,
      phase: '',
      videoCount: 0
    });
  }
  return progressMap.get(pathId)!;
}

// 为了兼容性，保留scanProgress导出（指向全局进度）
export const scanProgress: ScanProgress = getScanProgress(undefined);

// 当前正在扫描的路径ID
let currentScanPathId: number | undefined;
let progressSaveInterval: NodeJS.Timeout | null = null;

// 开始自动保存进度
export function startProgressAutoSave(pathId?: number): void {
  currentScanPathId = pathId;
  stopScanFlags.set(pathId, false); // 重置停止标志
  if (progressSaveInterval) {
    clearInterval(progressSaveInterval);
  }
  progressSaveInterval = setInterval(() => {
    const progress = getScanProgress(currentScanPathId);
    saveScanProgressToDb(progress, currentScanPathId);
  }, 500);
}

// 停止自动保存进度
export function stopProgressAutoSave(): void {
  if (progressSaveInterval) {
    clearInterval(progressSaveInterval);
    progressSaveInterval = null;
  }
  const progress = getScanProgress(currentScanPathId);
  saveScanProgressToDb(progress, currentScanPathId);
}

// 停止扫描
export function stopScan(pathId?: number): void {
  // 设置停止标志
  stopScanFlags.set(pathId, true);
  // 同时设置全局标志，确保批量扫描也能停止
  stopScanFlags.set(undefined, true);
  
  const progress = getScanProgress(pathId);
  progress.status = 'idle';
  progress.phase = '';
  progress.current = 0;
  progress.total = 0;
  progress.currentFile = '';
  progress.videoCount = 0;
  saveScanProgressToDb(progress, pathId);
}

// 清除停止标志
export function clearStopScanFlags(pathId?: number): void {
  stopScanFlags.delete(pathId);
  stopScanFlags.delete(undefined);
}

// 检查是否应该停止扫描
export function shouldStopScan(pathId?: number): boolean {
  // 检查全局停止标志
  if (stopScanFlags.get(undefined)) {
    return true;
  }
  // 检查特定路径的停止标志
  if (pathId !== undefined && stopScanFlags.get(pathId)) {
    return true;
  }
  return false;
}

// 从数据库加载扫描进度
export function loadScanProgressFromDb(pathId?: number): ScanProgress {
  try {
    let progress;
    if (pathId) {
      progress = getDb().prepare('SELECT * FROM scan_progress WHERE path_id = ?').get(pathId) as any;
    } else {
      progress = getDb().prepare('SELECT * FROM scan_progress WHERE path_id IS NULL ORDER BY id DESC LIMIT 1').get() as any;
    }
    
    if (progress) {
      return {
        status: progress.status as any,
        current: progress.current,
        total: progress.total,
        currentFile: progress.current_file,
        message: progress.message,
        startTime: progress.start_time,
        phase: progress.phase,
        videoCount: progress.video_count
      };
    }
  } catch (e) {
    console.error('加载扫描进度失败:', e);
  }
  return {
    status: 'idle',
    current: 0,
    total: 0,
    currentFile: '',
    message: '',
    startTime: 0,
    phase: '',
    videoCount: 0
  };
}

// 保存扫描进度到数据库
export function saveScanProgressToDb(progress: ScanProgress, pathId?: number): void {
  try {
    const now = Date.now();
    if (pathId) {
      getDb().prepare(`
        INSERT OR REPLACE INTO scan_progress 
        (path_id, status, current, total, current_file, message, start_time, phase, video_count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        pathId,
        progress.status,
        progress.current,
        progress.total,
        progress.currentFile,
        progress.message,
        progress.startTime,
        progress.phase,
        progress.videoCount,
        now
      );
    } else {
      getDb().prepare(`
        INSERT OR REPLACE INTO scan_progress 
        (path_id, status, current, total, current_file, message, start_time, phase, video_count, updated_at)
        VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        progress.status,
        progress.current,
        progress.total,
        progress.currentFile,
        progress.message,
        progress.startTime,
        progress.phase,
        progress.videoCount,
        now
      );
    }
  } catch (e) {
    console.error('保存扫描进度失败:', e);
  }
}

// 清除扫描进度
export function clearScanProgressFromDb(pathId?: number): void {
  try {
    if (pathId) {
      getDb().prepare('DELETE FROM scan_progress WHERE path_id = ?').run(pathId);
    } else {
      getDb().prepare('DELETE FROM scan_progress WHERE path_id IS NULL').run();
    }
  } catch (e) {
    console.error('清除扫描进度失败:', e);
  }
}

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
    const ffmpeg = registerFfmpegProcess(spawn('ffmpeg', [
      '-y',
      '-ss', timestamp.toString(),
      '-i', filePath,
      '-vframes', '1',
      '-q:v', '2',
      '-vf', 'scale=320:-1',
      '-an',
      thumbnailPath
    ]));

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
      const ffmpeg = registerFfmpegProcess(spawn('ffmpeg', [
        '-y',
        '-ss', String(timestamp.toFixed(2)),
        '-i', filePath,
        '-vframes', '1',
        '-vf', `scale=${frameWidth}:${frameHeight}:force_original_aspect_ratio=decrease,pad=${frameWidth}:${frameHeight}:(ow-iw)/2:(oh-ih)/2:black`,
        '-q:v', '2',
        '-an',
        '-threads', '1',
        tempPath
      ]));
      
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

    const ffmpeg = registerFfmpegProcess(spawn('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-vf', `tile=${actualCols}x${actualRows}:margin=0:padding=0`,
      '-frames:v', '1',
      '-q:v', '2',
      spritePath
    ]));

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

// 递归查找包含视频文件的文件夹（到最深层）
export function findVideoFolders(dirPath: string): string[] {
  const videoFolders: string[] = [];
  
  function scan(dir: string): boolean {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let hasVideo = false;
      const subDirs: string[] = [];
      
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (VIDEO_EXTENSIONS.includes(ext)) {
            hasVideo = true;
          }
        } else if (entry.isDirectory()) {
          subDirs.push(path.join(dir, entry.name));
        }
      }
      
      // 如果当前目录有视频，检查子目录是否也有视频
      if (hasVideo) {
        let childHasVideo = false;
        for (const subDir of subDirs) {
          if (scan(subDir)) {
            childHasVideo = true;
          }
        }
        // 如果子目录没有视频，则当前目录是最深层的视频文件夹
        if (!childHasVideo) {
          videoFolders.push(dir);
        }
        return true;
      } else {
        // 当前目录没有视频，继续扫描子目录
        let found = false;
        for (const subDir of subDirs) {
          if (scan(subDir)) {
            found = true;
          }
        }
        return found;
      }
    } catch (e) {
      return false;
    }
  }
  
  scan(dirPath);
  return videoFolders;
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
    const existing = getDb().prepare('SELECT id FROM videos WHERE file_path = ?').get(filePath);
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
    let categoryResult = getDb().prepare('SELECT id FROM categories WHERE name = ?').get(categoryName);
    let categoryId: number;
    
    if (categoryResult) {
      categoryId = (categoryResult as any).id;
    } else {
      const insertResult = getDb().prepare('INSERT INTO categories (name) VALUES (?)').run(categoryName);
      categoryId = insertResult.lastInsertRowid as number;
    }

    // 获取或创建作者
    let authorId: number | null = null;
    if (authorName) {
      let authorResult = getDb().prepare('SELECT id FROM authors WHERE name = ?').get(authorName);
      if (authorResult) {
        authorId = (authorResult as any).id;
      } else {
        const insertAuthor = getDb().prepare('INSERT INTO authors (name) VALUES (?)').run(authorName);
        authorId = insertAuthor.lastInsertRowid as number;
        console.log(`创建新作者: ${authorName}`);
      }
    }

    // 插入视频记录
    const result = getDb().prepare(`
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
    const video = getDb().prepare('SELECT file_path, duration FROM videos WHERE id = ?').get(videoId) as any;
    if (video && video.duration > 0) {
      await generateSprite(video.file_path, videoId, video.duration);
    }
  } catch (e) {
    console.error(`生成精灵图失败: videoId=${videoId}`, e);
  }
}

// 扫描并添加所有视频（带进度更新）
export async function scanAndAddVideos(dirPath: string, pathId?: number): Promise<{ added: number; skipped: number; failed: number; videoIds: number[] }> {
  // 只清除特定路径的停止标志，不清除全局标志
  stopScanFlags.delete(pathId);
  
  const videos = await scanDirectory(dirPath);
  
  const progress = getScanProgress(pathId);
  progress.total = videos.length;
  progress.status = 'scanning';
  progress.phase = `扫描视频文件(0/${videos.length})...`;
  progress.startTime = Date.now();
  progress.videoCount = 0;
  saveScanProgressToDb(progress, pathId);

  const newVideos: string[] = [];
  let skipped = 0;
  
  for (let i = 0; i < videos.length; i++) {
    if (shouldStopScan(pathId)) {
      return { added: 0, skipped: i, failed: 0, videoIds: [] };
    }
    
    progress.current = i + 1;
    progress.currentFile = path.basename(videos[i]);
    progress.phase = `扫描视频文件(${i + 1}/${videos.length})...`;

    const existing = getDb().prepare('SELECT id FROM videos WHERE file_path = ?').get(videos[i]);
    if (existing) {
      skipped++;
    } else {
      newVideos.push(videos[i]);
    }
  }

  if (newVideos.length === 0) {
    return { added: 0, skipped, failed: 0, videoIds: [] };
  }

  const results = await processInBatches(
    newVideos,
    PARALLEL_LIMIT,
    async (videoPath: string) => {
      const videoId = await addVideoToDatabase(videoPath);
      return videoId;
    },
    (completed, total) => {
      progress.current = completed;
      progress.phase = `导入视频(${completed}/${total})...`;
    }
  );

  const added = results.filter(r => r !== null).length;
  const videoIds = results.filter(r => r !== null) as number[];
  const failed = newVideos.length - added;

  return { added, skipped, failed, videoIds };
}

// 刷新所有已配置路径的视频（带进度更新）
export async function refreshAllVideos(): Promise<{ added: number; total: number }> {
  // 清除全局停止标志
  stopScanFlags.delete(undefined);
  
  const paths = getDb().prepare('SELECT id, path FROM video_paths WHERE enabled = 1').all() as { id: number; path: string }[];
  let totalAdded = 0;
  let totalVideos = 0;
  const allVideoIds: number[] = [];

  // 先设置所有路径为"排队中"状态
  for (const { id: pathId } of paths) {
    const progress = getScanProgress(pathId);
    progress.status = 'scanning';
    progress.phase = '排队中...';
    progress.current = 0;
    progress.total = 0;
    progress.videoCount = 0;
    saveScanProgressToDb(progress, pathId);
  }

  // 第一阶段：扫描所有路径，生成封面
  for (let i = 0; i < paths.length; i++) {
    const { id: pathId, path: dirPath } = paths[i];
    
    // 检查是否应该停止扫描
    if (shouldStopScan(undefined)) {
      return { added: totalAdded, total: totalVideos };
    }
    
    if (fs.existsSync(dirPath)) {
      const result = await scanAndAddVideos(dirPath, pathId);
      totalAdded += result.added;
      totalVideos += result.added + result.skipped;
      allVideoIds.push(...result.videoIds);
      
      // 更新该路径的进度（记录添加的视频数）
      const progress = getScanProgress(pathId);
      progress.videoCount = result.added;
      saveScanProgressToDb(progress, pathId);
    }
  }

  // 第二阶段：生成所有精灵图（按路径分组）
  if (allVideoIds.length > 0) {
    // 按路径分组视频ID
    const videosByPath = new Map<number, number[]>();
    for (const videoId of allVideoIds) {
      const video = getDb().prepare('SELECT file_path FROM videos WHERE id = ?').get(videoId) as any;
      if (video) {
        // 找到该视频所属的路径ID
        for (const { id: pathId, path: dirPath } of paths) {
          if (video.file_path.startsWith(dirPath)) {
            if (!videosByPath.has(pathId)) {
              videosByPath.set(pathId, []);
            }
            videosByPath.get(pathId)!.push(videoId);
            break;
          }
        }
      }
    }

    // 标记所有路径完成
    for (const { id: pathId } of paths) {
      const progress = getScanProgress(pathId);
      progress.status = 'completed';
      progress.phase = `已完成(${progress.videoCount}个视频)`;
      saveScanProgressToDb(progress, pathId);
    }
  } else {
    // 如果没有新视频，标记所有路径为完成
    for (const { id: pathId } of paths) {
      const progress = getScanProgress(pathId);
      progress.status = 'completed';
      progress.phase = '已完成(0个视频)';
      saveScanProgressToDb(progress, pathId);
    }
  }

  // 获取总视频数
  const count = getDb().prepare('SELECT COUNT(*) as count FROM videos').get() as { count: number };
  
  return { added: totalAdded, total: count.count };
}
