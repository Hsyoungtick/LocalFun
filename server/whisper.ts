import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getDb } from './database';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export interface WhisperConfig {
  whisperPath: string;
  model: string;
  language: string;
}

export interface SubtitleProgress {
  videoId: number;
  status: 'pending' | 'extracting' | 'transcribing' | 'completed' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface EngineInfo {
  name: string;
  path: string;
  type: 'cpu' | 'vulkan' | 'const-me';
  available: boolean;
}

export interface ModelInfo {
  name: string;
  path: string;
  size: string;
}

export interface RealtimeSubtitle {
  start: number;
  end: number;
  text: string;
}

const subtitlesDir = path.join(projectRoot, 'data', 'subtitles');
const whisperDir = path.join(projectRoot, 'whisper');

let currentProcess: ChildProcess | null = null;
let currentVideoId: number | null = null;
let isCancelled: boolean = false;
let realtimeCallbacks: Map<number, (subtitle: RealtimeSubtitle) => void> = new Map();

export function getWhisperDir(): string {
  return whisperDir;
}

export function getSubtitlesDir(): string {
  return subtitlesDir;
}

export function findAvailableEngines(): EngineInfo[] {
  const engines: EngineInfo[] = [];
  
  const enginePaths = [
    { name: 'Vulkan GPU', type: 'vulkan' as const, relPath: 'Whisper/Vulkan/main64.exe' },
    { name: 'Const-me GPU', type: 'const-me' as const, relPath: 'Whisper/Const-me/main.exe' },
    { name: 'CPU', type: 'cpu' as const, relPath: 'Whisper/CPU/main64.exe' },
  ];

  for (const engine of enginePaths) {
    const fullPath = path.join(whisperDir, engine.relPath);
    engines.push({
      name: engine.name,
      path: fullPath,
      type: engine.type,
      available: fs.existsSync(fullPath)
    });
  }

  return engines;
}

export function getBestEngine(): EngineInfo | null {
  const engines = findAvailableEngines();
  // 优先使用 GPU 版本
  const preferred = engines.find(e => e.available && (e.type === 'vulkan' || e.type === 'const-me'));
  return preferred || engines.find(e => e.available) || null;
}

export function findAvailableModels(): ModelInfo[] {
  const models: ModelInfo[] = [];
  
  console.log(`[Whisper] 搜索模型，whisperDir: ${whisperDir}`);
  
  // 检查 Whisper 文件夹下的 ggml-*.bin 模型
  const whisperDir2 = path.join(whisperDir, 'Whisper');
  console.log(`[Whisper] 检查目录: ${whisperDir2}, 存在: ${fs.existsSync(whisperDir2)}`);
  
  if (fs.existsSync(whisperDir2)) {
    const files = fs.readdirSync(whisperDir2);
    console.log(`[Whisper] 目录文件: ${files.join(', ')}`);
    for (const file of files) {
      if (file.endsWith('.bin') && (file.startsWith('ggml-') || file === 'whisper.bin')) {
        const fullPath = path.join(whisperDir2, file);
        const stats = fs.statSync(fullPath);
        console.log(`[Whisper] 发现模型: ${file}, 大小: ${stats.size} bytes`);
        // 过滤掉太小的无效模型（小于 10MB 可能是无效的）
        if (stats.size > 10 * 1024 * 1024) {
          models.push({
            name: file,
            path: fullPath,
            size: formatSize(stats.size)
          });
        }
      }
    }
  }

  // 检查 models 文件夹
  const modelsDir = path.join(whisperDir, 'models');
  if (fs.existsSync(modelsDir)) {
    const files = fs.readdirSync(modelsDir);
    for (const file of files) {
      if (file.endsWith('.bin')) {
        const fullPath = path.join(modelsDir, file);
        const stats = fs.statSync(fullPath);
        if (stats.size > 10 * 1024 * 1024) {
          models.push({
            name: file,
            path: fullPath,
            size: formatSize(stats.size)
          });
        }
      }
    }
  }

  // 检查 faster-whisper 模型（仅记录，whisper.cpp 不能直接使用）
  const moduleDir = path.join(whisperDir, 'Module');
  if (fs.existsSync(moduleDir)) {
    const dirs = fs.readdirSync(moduleDir);
    for (const dir of dirs) {
      const modelPath = path.join(moduleDir, dir, 'model.bin');
      if (fs.existsSync(modelPath)) {
        const stats = fs.statSync(modelPath);
        models.push({
          name: `faster-whisper/${dir}`,
          path: modelPath,
          size: formatSize(stats.size)
        });
      }
    }
  }

  console.log(`[Whisper] 找到模型: ${models.length} 个`);
  return models;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export function getSubtitleStatus(videoId: number): { exists: boolean; path?: string; status?: string } {
  const record = getDb().prepare('SELECT * FROM subtitles WHERE video_id = ?').get(videoId) as any;
  
  if (record) {
    return {
      exists: record.status === 'completed',
      path: record.srt_path || undefined,
      status: record.status
    };
  }

  const srtPath = path.join(subtitlesDir, `${videoId}.srt`);
  if (fs.existsSync(srtPath)) {
    return { exists: true, path: srtPath };
  }

  return { exists: false };
}

export function updateSubtitleProgress(videoId: number, status: string, progress: number, message: string, error?: string) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM subtitles WHERE video_id = ?').get(videoId);
  
  if (existing) {
    db.prepare(`
      UPDATE subtitles 
      SET status = ?, progress = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE video_id = ?
    `).run(status, progress, error || null, videoId);
  } else {
    db.prepare(`
      INSERT INTO subtitles (video_id, status, progress, error_message)
      VALUES (?, ?, ?, ?)
    `).run(videoId, status, progress, error || null);
  }
}

export function setSubtitleCompleted(videoId: number, srtPath: string, model: string, language: string) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM subtitles WHERE video_id = ?').get(videoId);
  
  if (existing) {
    db.prepare(`
      UPDATE subtitles 
      SET status = 'completed', srt_path = ?, model = ?, language = ?, progress = 100, updated_at = CURRENT_TIMESTAMP
      WHERE video_id = ?
    `).run(srtPath, model, language, videoId);
  } else {
    db.prepare(`
      INSERT INTO subtitles (video_id, status, srt_path, model, language, progress)
      VALUES (?, 'completed', ?, ?, ?, 100)
    `).run(videoId, srtPath, model, language);
  }
}

export function cancelSubtitleGeneration(videoId: number): boolean {
  console.log(`[Whisper] 尝试取消生成，当前视频ID: ${currentVideoId}, 请求视频ID: ${videoId}`);
  if (currentVideoId === videoId && currentProcess) {
    console.log(`[Whisper] 杀死进程并清理状态`);
    isCancelled = true;
    currentProcess.kill();
    currentProcess = null;
    currentVideoId = null;
    realtimeCallbacks.delete(videoId);
    updateSubtitleProgress(videoId, 'cancelled', 0, '已取消');
    return true;
  }
  // 即使不是同一个视频，也清理状态（防止状态残留）
  if (currentProcess) {
    console.log(`[Whisper] 强制清理残留进程`);
    isCancelled = true;
    currentProcess.kill();
    currentProcess = null;
    currentVideoId = null;
  }
  return false;
}

export function isGenerating(): boolean {
  return currentProcess !== null;
}

export function getCurrentGeneratingVideoId(): number | null {
  return currentVideoId;
}

// 普通生成模式：生成完整 SRT 文件
export async function generateSubtitle(
  videoPath: string,
  videoId: number,
  options: { model?: string; language?: string; engine?: string } = {}
): Promise<{ success: boolean; srtPath?: string; error?: string }> {
  const { model, language = 'auto' } = options;

  if (currentProcess) {
    return { success: false, error: '已有字幕生成任务正在进行中' };
  }

  const engine = getBestEngine();
  if (!engine) {
    return { success: false, error: '未找到可用的 Whisper 引擎' };
  }

  const modelPath = model || findAvailableModels()[0]?.path;
  if (!modelPath || !fs.existsSync(modelPath)) {
    return { success: false, error: '未找到可用的模型文件' };
  }

  if (!fs.existsSync(videoPath)) {
    return { success: false, error: '视频文件不存在' };
  }

  const tempAudioPath = path.join(subtitlesDir, `${videoId}_temp.wav`);
  const outputBasePath = path.join(subtitlesDir, `${videoId}`);

  try {
    currentVideoId = videoId;
    updateSubtitleProgress(videoId, 'extracting', 0, '正在提取音频...');

    await extractAudio(videoPath, tempAudioPath, (progress) => {
      updateSubtitleProgress(videoId, 'extracting', progress, '正在提取音频...');
    });

    updateSubtitleProgress(videoId, 'transcribing', 0, '正在生成字幕...');

    await runWhisperCpp(engine.path, modelPath, tempAudioPath, outputBasePath, language, (progress, message) => {
      updateSubtitleProgress(videoId, 'transcribing', progress, message);
    });

    const outputSrtPath = `${outputBasePath}.srt`;
    
    if (!fs.existsSync(outputSrtPath)) {
      throw new Error('字幕文件生成失败');
    }

    setSubtitleCompleted(videoId, outputSrtPath, path.basename(modelPath), language);

    // 清理临时文件
    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath);
    }

    currentProcess = null;
    currentVideoId = null;

    return { success: true, srtPath: outputSrtPath };

  } catch (error: any) {
    currentProcess = null;
    currentVideoId = null;
    
    updateSubtitleProgress(videoId, 'error', 0, '生成失败', error.message);
    
    if (fs.existsSync(tempAudioPath)) {
      try { fs.unlinkSync(tempAudioPath); } catch (e) { }
    }

    return { success: false, error: error.message };
  }
}

// 实时生成模式：边播放边生成字幕
export async function startRealtimeGeneration(
  videoPath: string,
  videoId: number,
  options: { model?: string; language?: string; startTime?: number } = {},
  onSubtitle: (subtitle: RealtimeSubtitle) => void
): Promise<{ success: boolean; error?: string }> {
  const { language = 'auto', startTime = 0 } = options;

  console.log(`[Whisper] 开始实时字幕生成，视频ID: ${videoId}`);
  console.log(`[Whisper] 视频路径: ${videoPath}`);
  console.log(`[Whisper] 起始时间: ${startTime}秒`);

  // 注意：不再在这里检查 currentProcess，由 routes.ts 统一处理

  const engine = getBestEngine();
  console.log(`[Whisper] 选择的引擎: ${engine?.name || '无'}`);
  if (!engine) {
    return { success: false, error: '未找到可用的 Whisper 引擎' };
  }

  const availableModels = findAvailableModels();
  console.log(`[Whisper] 可用模型: ${availableModels.map(m => m.name).join(', ')}`);
  
  const modelPath = options.model || availableModels[0]?.path;
  console.log(`[Whisper] 选择的模型: ${modelPath}`);
  
  if (!modelPath || !fs.existsSync(modelPath)) {
    return { success: false, error: '未找到可用的模型文件' };
  }

  if (!fs.existsSync(videoPath)) {
    return { success: false, error: '视频文件不存在' };
  }

  const tempAudioPath = path.join(subtitlesDir, `${videoId}_realtime_temp.wav`);
  console.log(`[Whisper] 临时音频路径: ${tempAudioPath}`);

  try {
    // 重置取消标志
    isCancelled = false;
    currentVideoId = videoId;
    realtimeCallbacks.set(videoId, onSubtitle);

    console.log(`[Whisper] 开始提取音频...`);
    // 提取音频（从指定时间开始）
    await extractAudio(videoPath, tempAudioPath, () => {}, startTime);
    console.log(`[Whisper] 音频提取完成`);

    console.log(`[Whisper] 启动 Whisper 转录...`);
    // 启动实时转录，传递 startTime 用于调整字幕时间戳
    await runWhisperCppRealtime(engine.path, modelPath, tempAudioPath, language, onSubtitle, startTime);
    console.log(`[Whisper] 转录完成`);

    // 清理
    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath);
    }

    realtimeCallbacks.delete(videoId);
    currentProcess = null;
    currentVideoId = null;

    return { success: true };

  } catch (error: any) {
    console.error(`[Whisper] 实时字幕生成错误: ${error.message}`);
    realtimeCallbacks.delete(videoId);
    currentProcess = null;
    currentVideoId = null;
    
    if (fs.existsSync(tempAudioPath)) {
      try { fs.unlinkSync(tempAudioPath); } catch (e) { }
    }

    return { success: false, error: error.message };
  }
}

function extractAudio(
  videoPath: string,
  outputPath: string,
  onProgress: (progress: number) => void,
  startTime: number = 0
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查视频文件是否存在
    if (!fs.existsSync(videoPath)) {
      reject(new Error(`视频文件不存在: ${videoPath}`));
      return;
    }

    const args = [
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
    ];

    // 如果有起始时间，添加 -ss 参数
    if (startTime > 0) {
      args.unshift('-ss', startTime.toString());
    }

    args.push('-y', outputPath);

    console.log(`[FFmpeg] 提取音频: ffmpeg ${args.join(' ')}`);

    const ffmpeg = spawn('ffmpeg', args);
    currentProcess = ffmpeg;
    
    // 捕获当前的取消状态
    const wasCancelled = { value: false };
    const originalKill = ffmpeg.kill.bind(ffmpeg);
    ffmpeg.kill = () => {
      wasCancelled.value = true;
      return originalKill();
    };

    let duration = 0;
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;

      const durationMatch = text.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (durationMatch) {
        duration = parseInt(durationMatch[1]) * 3600 + 
                   parseInt(durationMatch[2]) * 60 + 
                   parseInt(durationMatch[3]);
      }

      const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (timeMatch && duration > 0) {
        const currentTime = parseInt(timeMatch[1]) * 3600 + 
                           parseInt(timeMatch[2]) * 60 + 
                           parseInt(timeMatch[3]);
        const progress = Math.min(100, Math.round((currentTime / duration) * 100));
        onProgress(progress);
      }
    });

    ffmpeg.on('close', (code) => {
      currentProcess = null;
      if (code === 0) {
        resolve();
      } else if (wasCancelled.value) {
        // 进程被取消，不报错
        console.log(`[FFmpeg] 进程被取消`);
        reject(new Error('已取消'));
      } else {
        // 提取错误信息
        const errorMatch = stderr.match(/Error: (.+)/);
        const errorMsg = errorMatch ? errorMatch[1] : `退出码: ${code}`;
        console.error(`[FFmpeg] 错误输出: ${stderr}`);
        reject(new Error(`音频提取失败: ${errorMsg}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`启动 ffmpeg 失败: ${err.message}`));
    });
  });
}

function runWhisperCpp(
  enginePath: string,
  modelPath: string,
  audioPath: string,
  outputPath: string,
  language: string,
  onProgress: (progress: number, message: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-m', modelPath,
      '-l', language,
      '-osrt',
      '-of', outputPath,
      '-pp',
      '-np',
      audioPath  // 音频文件作为位置参数
    ];

    const whisper = spawn(enginePath, args);
    currentProcess = whisper;

    let stderr = '';

    whisper.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    whisper.stdout.on('data', (data) => {
      const text = data.toString();
      // 解析进度
      const progressMatch = text.match(/(\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1]);
        onProgress(progress, `正在处理: ${progress}%`);
      }
    });

    whisper.on('close', (code) => {
      if (code === 0) {
        onProgress(100, '字幕生成完成');
        resolve();
      } else {
        reject(new Error(`Whisper 执行失败，退出码: ${code}\n${stderr}`));
      }
    });

    whisper.on('error', (err) => {
      reject(new Error(`启动 Whisper 失败: ${err.message}`));
    });
  });
}

function runWhisperCppRealtime(
  enginePath: string,
  modelPath: string,
  audioPath: string,
  language: string,
  onSubtitle: (subtitle: RealtimeSubtitle) => void,
  startTime: number = 0
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-m', modelPath,
      '-l', language,
      '-osrt',
      '-of', audioPath.replace('.wav', ''),
      audioPath
    ];

    console.log(`[Whisper] 启动实时字幕生成: ${enginePath}`);
    console.log(`[Whisper] 参数: ${args.join(' ')}`);
    console.log(`[Whisper] 时间戳偏移: ${startTime}秒`);

    const whisper = spawn(enginePath, args);
    currentProcess = whisper;

    let stderr = '';
    let processedSubtitles = new Set<string>();

    whisper.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Whisper stdout] ${output.trim()}`);
      
      // 实时解析输出并发送字幕
      parseRealtimeOutput(output, (subtitle) => {
        const key = `${subtitle.start.toFixed(2)}-${subtitle.text}`;
        if (!processedSubtitles.has(key)) {
          processedSubtitles.add(key);
          // 调整时间戳，加上起始时间偏移
          const adjustedSubtitle = {
            ...subtitle,
            start: subtitle.start + startTime,
            end: subtitle.end + startTime
          };
          console.log(`[Whisper] 发送实时字幕: [${adjustedSubtitle.start.toFixed(2)}] ${adjustedSubtitle.text}`);
          onSubtitle(adjustedSubtitle);
        }
      });
    });

    whisper.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`[Whisper stderr] ${data.toString().trim()}`);
    });

    whisper.on('close', (code) => {
      console.log(`[Whisper] 进程结束，退出码: ${code}`);
      
      if (code === 0 || code === null) {
        const srtPath = audioPath.replace('.wav', '.srt');
        try { 
          if (fs.existsSync(srtPath)) {
            fs.unlinkSync(srtPath); 
          }
        } catch (e) { }
        resolve();
      } else {
        reject(new Error(`Whisper 执行失败，退出码: ${code}\n${stderr}`));
      }
    });

    whisper.on('error', (err) => {
      console.error(`[Whisper] 进程错误: ${err.message}`);
      reject(new Error(`启动 Whisper 失败: ${err.message}`));
    });
  });
}

function parseRealtimeOutput(output: string, onSubtitle: (subtitle: RealtimeSubtitle) => void) {
  // 解析 whisper.cpp 的输出格式
  // 格式类似: [00:00:00.000 --> 00:00:05.000]  Hello world
  const lines = output.split('\n');
  
  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]\s*(.+)/);
    if (match) {
      const start = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
      const end = parseInt(match[5]) * 3600 + parseInt(match[6]) * 60 + parseInt(match[7]) + parseInt(match[8]) / 1000;
      const text = match[9].trim();
      
      if (text) {
        onSubtitle({ start, end, text });
      }
    }
  }
}

export function parseSRT(srtContent: string): Array<{ index: number; start: number; end: number; text: string }> {
  const subtitles: Array<{ index: number; start: number; end: number; text: string }> = [];
  const blocks = srtContent.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const index = parseInt(lines[0]);
    const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    
    if (!timeMatch) continue;

    const start = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
    const end = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
    const text = lines.slice(2).join('\n');

    subtitles.push({ index, start, end, text });
  }

  return subtitles;
}

export function readSRTFile(videoId: number): string | null {
  const srtPath = path.join(subtitlesDir, `${videoId}.srt`);
  
  if (!fs.existsSync(srtPath)) {
    const record = getDb().prepare('SELECT srt_path FROM subtitles WHERE video_id = ?').get(videoId) as any;
    if (record?.srt_path && fs.existsSync(record.srt_path)) {
      return fs.readFileSync(record.srt_path, 'utf-8');
    }
    return null;
  }

  return fs.readFileSync(srtPath, 'utf-8');
}

export function deleteSubtitle(videoId: number): boolean {
  const srtPath = path.join(subtitlesDir, `${videoId}.srt`);
  
  if (fs.existsSync(srtPath)) {
    fs.unlinkSync(srtPath);
  }

  getDb().prepare('DELETE FROM subtitles WHERE video_id = ?').run(videoId);
  
  return true;
}
