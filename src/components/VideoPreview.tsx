import { useState, useRef, MouseEvent } from 'react';
import { getThumbnailUrl } from '../api';

interface VideoPreviewProps {
  videoId: number;
  thumbnail: string | null;
  duration: number;
  title: string;
}

export default function VideoPreview({ videoId, thumbnail, duration, title }: VideoPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const [spriteError, setSpriteError] = useState(false);
  
  const frameCount = 50;
  const cols = 10;
  const rows = 5;

  // 精灵图 URL
  const spriteUrl = `http://localhost:3001/previews/${videoId}_sprite.jpg`;

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
      {thumbnail && !isHovering && (
        <div
          className="w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${getThumbnailUrl(thumbnail)})` }}
        />
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
            thumbnail && (
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${getThumbnailUrl(thumbnail)})` }}
              />
            )
          )}

          {/* 时间指示器 */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div
              className="h-full bg-primary transition-all duration-75"
              style={{ width: `${((previewIndex + 1) / frameCount) * 100}%` }}
            />
          </div>

          {/* 时间显示 */}
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      )}

      {/* 无封面时的占位 */}
      {!thumbnail && !isHovering && (
        <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700">
          <span className="material-symbols-outlined text-4xl text-slate-400">video_file</span>
        </div>
      )}
    </div>
  );
}
