import { useState, useRef, MouseEvent } from 'react';
import { getThumbnailUrl } from '../api';

interface VideoPreviewProps {
  videoId: number;
  duration: number;
  title: string;
  views?: string;
}

export default function VideoPreview({ videoId, duration, title, views }: VideoPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const [spriteError, setSpriteError] = useState(false);
  const [coverError, setCoverError] = useState(false);
  
  const frameCount = 30;
  const cols = 6;
  const rows = 5;

  // 精灵图 URL
  const spriteUrl = `http://localhost:3001/previews/${videoId}_sprite.jpg`;
  // 封面 URL
  const coverUrl = getThumbnailUrl(videoId);

  // 鼠标移动时计算预览索引
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration <= 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const index = Math.floor(percentage * frameCount);

    setPreviewIndex(Math.max(0, Math.min(index, frameCount - 1)));
  };

  // 鼠标进入时
  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  // 鼠标离开时
  const handleMouseLeave = () => {
    setIsHovering(false);
    setPreviewIndex(0);
  };

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 计算当前预览帧对应的时间
  const currentTime = (previewIndex + 1) / frameCount * duration;

  // 计算精灵图位置
  // 精灵图布局: 10列 x 5行
  const col = previewIndex % cols;
  const row = Math.floor(previewIndex / cols);
  
  // CSS background-position 百分比公式: offset = (container - image) * percentage
  // backgroundSize: 1000% 500% → image = 10*container 宽, 5*container 高
  // 要显示第 col 列: offset_x = -col * containerWidth
  // (containerWidth - 10*containerWidth) * percentage_x = -col * containerWidth
  // percentage_x = col / 9 = col / (cols - 1)
  const backgroundPositionX = col / (cols - 1) * 100;
  const backgroundPositionY = row / (rows - 1) * 100;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* 默认封面 - 非悬浮时显示 */}
      {!isHovering && !coverError && (
        <img
          src={coverUrl}
          alt={title}
          className="w-full h-full object-cover"
          onError={() => setCoverError(true)}
        />
      )}

      {/* 非悬浮时的底部渐变和元素 */}
      {!isHovering && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-black/70 to-transparent pointer-events-none" />
          {/* 播放量 - 左下角 */}
          {views && (
            <div className="absolute bottom-1.5 left-2 flex items-center gap-0.5 text-white text-[10px] font-bold leading-none pointer-events-none z-10">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="4" width="18" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 8l6 4-6 4V8z" fill="currentColor"/>
              </svg>
              <span>{views}</span>
            </div>
          )}
          {/* 时长 - 右下角 */}
          <div className="absolute bottom-1.5 right-2 text-white text-[10px] font-bold leading-none pointer-events-none z-10">
            {formatTime(duration)}
          </div>
        </>
      )}

      {/* 悬浮时显示精灵图预览 */}
      {isHovering && (
        <div className="absolute inset-0 bg-slate-800">
          {/* 预加载精灵图 */}
          <img
            src={spriteUrl}
            alt=""
            className="hidden"
            onLoad={() => setSpriteLoaded(true)}
            onError={() => setSpriteError(true)}
          />
          
          {/* 精灵图预览帧 */}
          {!spriteError && spriteLoaded ? (
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url(${spriteUrl})`,
                backgroundPosition: `${backgroundPositionX}% ${backgroundPositionY}%`,
                backgroundSize: `${cols * 100}% ${rows * 100}%`,
                backgroundRepeat: 'no-repeat'
              }}
            />
          ) : (
            // 精灵图加载失败或未加载时显示封面
            !coverError && (
              <img
                src={coverUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            )
          )}

          {/* 底部渐变 */}
          <div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-black/70 to-transparent pointer-events-none" />

          {/* 时间指示器 */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div
              className="h-full bg-primary transition-all duration-75"
              style={{ width: `${((previewIndex + 1) / frameCount) * 100}%` }}
            />
          </div>

          {/* 播放量 - 左下角 */}
          {views && (
            <div className="absolute bottom-1.5 left-2 flex items-center gap-0.5 text-white text-[10px] font-bold leading-none pointer-events-none z-10">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="4" width="18" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 8l6 4-6 4V8z" fill="currentColor"/>
              </svg>
              <span>{views}</span>
            </div>
          )}

          {/* 时间显示 - 右下角显示当前时间/总时长 */}
          <div className="absolute bottom-1.5 right-2 text-white text-[10px] font-bold leading-none pointer-events-none z-10">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      )}

      {/* 无封面时的占位 */}
      {coverError && !isHovering && (
        <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700">
          <span className="material-symbols-outlined text-4xl text-slate-400">video_file</span>
        </div>
      )}
    </div>
  );
}
