import { useState, useRef, useEffect, MouseEvent, ChangeEvent, forwardRef, useImperativeHandle } from 'react';
import { updatePlayHistory } from '../api';

interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  durationSeconds?: number;
  videoId: number;
  title?: string;
  author?: string;
  initialProgress?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onEnded?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export interface CustomVideoPlayerRef {
  getCurrentTime: () => number;
  isFullscreen: () => boolean;
  enterFullscreen: () => void;
}

const CustomVideoPlayer = forwardRef<CustomVideoPlayerRef, CustomVideoPlayerProps>(({ 
  src, 
  poster, 
  durationSeconds, 
  videoId,
  title,
  author,
  initialProgress = 0,
  onPrev,
  onNext,
  onEnded,
  hasPrev = false,
  hasNext = false
}, ref) => {
  useImperativeHandle(ref, () => ({
    getCurrentTime: () => currentTime,
    isFullscreen: () => isFullscreen,
    enterFullscreen: () => {
      if (containerRef.current && !isFullscreen) {
        containerRef.current.requestFullscreen().catch(console.error);
      }
    }
  }));
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const [spriteError, setSpriteError] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [hasSetInitialProgress, setHasSetInitialProgress] = useState(false);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const volumeIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const seekIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const frameCount = 20;
  const cols = 5;
  const rows = 4;
  const spriteUrl = `http://localhost:3001/previews/${videoId}_sprite.jpg`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      if (!durationSeconds) {
        setDuration(video.duration);
      }
    };
    const handleCanPlay = () => {
      if (!hasSetInitialProgress && initialProgress > 0) {
        console.log('设置初始播放进度:', initialProgress);
        video.currentTime = initialProgress;
        setHasSetInitialProgress(true);
      }
    };
    const handlePlay = () => {
      setIsPlaying(true);
      saveProgressIntervalRef.current = setInterval(() => {
        updatePlayHistory(videoId, video.currentTime).catch(console.error);
      }, 10000);
    };
    const handlePause = () => {
      setIsPlaying(false);
      if (saveProgressIntervalRef.current) {
        clearInterval(saveProgressIntervalRef.current);
        saveProgressIntervalRef.current = null;
      }
      updatePlayHistory(videoId, video.currentTime).catch(console.error);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      if (saveProgressIntervalRef.current) {
        clearInterval(saveProgressIntervalRef.current);
        saveProgressIntervalRef.current = null;
      }
      updatePlayHistory(videoId, video.currentTime).catch(console.error);
      if (onEnded) {
        onEnded();
      }
    };
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('volumechange', handleVolumeChange);
      
      if (saveProgressIntervalRef.current) {
        clearInterval(saveProgressIntervalRef.current);
      }
      updatePlayHistory(videoId, video.currentTime).catch(console.error);
    };
  }, [durationSeconds, videoId, initialProgress, hasSetInitialProgress]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleSeekTo = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      const video = videoRef.current;
      if (video) {
        video.currentTime = customEvent.detail;
      }
    };
    window.addEventListener('seekTo', handleSeekTo);
    return () => window.removeEventListener('seekTo', handleSeekTo);
  }, []);

  // 显示音量指示器
  const displayVolumeIndicator = () => {
    setShowVolumeIndicator(true);
    if (volumeIndicatorTimeoutRef.current) {
      clearTimeout(volumeIndicatorTimeoutRef.current);
    }
    volumeIndicatorTimeoutRef.current = setTimeout(() => {
      setShowVolumeIndicator(false);
    }, 1000);
  };

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      // 忽略输入框中的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          // 立即执行一次
          video.currentTime = Math.max(0, video.currentTime - 2);
          // 如果没有正在进行的 seek，启动持续 seek
          if (!seekIntervalRef.current) {
            seekIntervalRef.current = setInterval(() => {
              video.currentTime = Math.max(0, video.currentTime - 1);
            }, 50);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(duration, video.currentTime + 2);
          if (!seekIntervalRef.current) {
            seekIntervalRef.current = setInterval(() => {
              video.currentTime = Math.min(duration, video.currentTime + 1);
            }, 50);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.05);
          video.muted = false;
          displayVolumeIndicator();
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.05);
          displayVolumeIndicator();
          break;
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          displayVolumeIndicator();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // 停止持续 seek
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (seekIntervalRef.current) {
          clearInterval(seekIntervalRef.current);
          seekIntervalRef.current = null;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
      }
    };
  }, [duration]);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleProgressClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress || duration <= 0) return;

    const rect = progress.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    video.currentTime = Math.max(0, Math.min(1, percentage)) * duration;
  };

  const handleProgressMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const progress = progressRef.current;
    if (!progress || duration <= 0) return;

    const rect = progress.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    
    setPreviewTime(percentage * duration);
    setPreviewPosition(percentage * 100);
  };

  const handleProgressMouseEnter = () => {
    setIsHoveringProgress(true);
  };

  const handleProgressMouseLeave = () => {
    setIsHoveringProgress(false);
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    video.muted = newVolume === 0;
    displayVolumeIndicator();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      await container.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleMouseLeave = () => {
    // 鼠标离开视频区域时，无论是否播放都隐藏控制栏
    setShowControls(false);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const previewIndex = Math.floor((previewTime / duration) * frameCount);
  const clampedIndex = Math.max(0, Math.min(previewIndex, frameCount - 1));
  const col = clampedIndex % cols;
  const row = Math.floor(clampedIndex / cols);
  const backgroundPositionX = col / (cols - 1) * 100;
  const backgroundPositionY = row / (rows - 1) * 100;

  const volumePercent = Math.round((isMuted ? 0 : volume) * 100);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src={src}
        poster={poster}
        autoPlay
        onClick={handlePlayPause}
        onDoubleClick={toggleFullscreen}
      />

      {/* 音量指示器 */}
      {showVolumeIndicator && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="bg-black/60 rounded-2xl px-6 py-4 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-white text-4xl">
              {isMuted || volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
            </span>
            <span className="text-white text-2xl font-bold">{volumePercent}%</span>
          </div>
        </div>
      )}

      {showControls && (
        <>
          {/* 底部渐变 */}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
          
          {/* 全屏时的顶部渐变和标题 */}
          {isFullscreen && (
            <>
              <div className="absolute inset-0 bg-linear-to-b from-black/50 via-transparent to-transparent pointer-events-none" />
              <div className="absolute top-4 left-4 text-left pointer-events-none z-10">
                {title && (
                  <div className="text-white text-lg font-bold mb-1 drop-shadow-lg line-clamp-2 max-w-md">
                    {title}
                  </div>
                )}
                {author && (
                  <div className="text-white/80 text-sm drop-shadow-lg">
                    {author}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 底部控制区域（包含进度条和控制按钮） */}
          <div className="absolute bottom-0 left-0 right-0 z-10">
            {/* 进度条 */}
            <div className="px-4 pt-2">
              <div
                ref={progressRef}
                className="relative h-1 bg-white/30 rounded-full cursor-pointer hover:h-2 transition-all"
                onClick={handleProgressClick}
                onMouseMove={handleProgressMouseMove}
                onMouseEnter={handleProgressMouseEnter}
                onMouseLeave={handleProgressMouseLeave}
              >
                <div
                  className="absolute h-full bg-primary rounded-full"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="absolute w-3 h-3 bg-white rounded-full -top-1 shadow-lg opacity-0 hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${progress}% - 6px)` }}
                />

                {isHoveringProgress && duration > 0 && (
                  <div
                    className="absolute transform -translate-x-1/2 pointer-events-none z-20"
                    style={{ left: `${previewPosition}%`, bottom: '1rem' }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div 
                        className="bg-slate-800 rounded-lg overflow-hidden shadow-xl border border-white/10"
                        style={{ 
                          width: isFullscreen ? '240px' : '160px',
                          aspectRatio: '16/9'
                        }}
                      >
                        <img
                          src={spriteUrl}
                          alt=""
                          className="hidden"
                          onLoad={() => setSpriteLoaded(true)}
                          onError={() => setSpriteError(true)}
                        />
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
                          poster && (
                            <img
                              src={poster}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )
                        )}
                      </div>
                      <div className="bg-black/80 text-white text-xs px-2 py-1 rounded">
                        {formatTime(previewTime)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 控制按钮栏 */}
            <div className="px-4 py-3 flex items-center justify-between">
              {/* 左侧：上一个、播放/暂停、下一个、时间 */}
              <div className="flex items-center gap-1">
                {hasPrev && (
                  <button
                    onClick={onPrev}
                    className="w-10 h-10 flex items-center justify-center text-white hover:text-primary transition-colors"
                    title="上一个视频"
                  >
                    <span className="material-symbols-outlined text-2xl">skip_previous</span>
                  </button>
                )}

                <button
                  onClick={handlePlayPause}
                  className="w-12 h-12 flex items-center justify-center text-white hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-3xl">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                {hasNext && (
                  <button
                    onClick={onNext}
                    className="w-10 h-10 flex items-center justify-center text-white hover:text-primary transition-colors"
                    title="下一个视频"
                  >
                    <span className="material-symbols-outlined text-2xl">skip_next</span>
                  </button>
                )}

                <span className="text-white text-sm ml-3">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* 右侧：音量、全屏 */}
              <div className="flex items-center gap-1">
                {/* 音量控制（垂直滑块） */}
                <div 
                  className="relative"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <button
                    onClick={toggleMute}
                    className="w-10 h-10 flex items-center justify-center text-white hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {isMuted || volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                    </span>
                  </button>
                  
                  {/* 垂直音量滑块 */}
                  {showVolumeSlider && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2">
                      <div className="bg-black/80 rounded-lg px-2 py-3 shadow-xl">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="h-20 accent-primary"
                          style={{ 
                            writingMode: 'vertical-lr',
                            direction: 'rtl',
                            width: '4px'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={toggleFullscreen}
                  className="w-10 h-10 flex items-center justify-center text-white hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default CustomVideoPlayer;
