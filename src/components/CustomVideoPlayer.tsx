import React, { useState, useRef, useEffect, useCallback } from 'react';

interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  durationSeconds?: number;
}

export default function CustomVideoPlayer({ src, poster, durationSeconds }: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastPreviewTimeRef = useRef<number>(-1);
  const previewThrottleRef = useRef<ReturnType<typeof setTimeout>>();

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying && !isSeeking) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, isSeeking]);

  const handleMouseMove = useCallback(() => {
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const handleMouseLeave = useCallback(() => {
    if (isPlaying && !isSeeking) {
      setShowControls(false);
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    }
  }, [isPlaying, isSeeking]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  const handleTimeUpdate = () => {
    if (videoRef.current && !isSeeking) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const generatePreviewImage = useCallback((time: number) => {
    if (Math.abs(time - lastPreviewTimeRef.current) < 1) return;
    lastPreviewTimeRef.current = time;
    
    if (!previewVideoRef.current) {
      previewVideoRef.current = document.createElement('video');
      previewVideoRef.current.src = src;
      previewVideoRef.current.crossOrigin = 'anonymous';
      previewVideoRef.current.muted = true;
      previewVideoRef.current.preload = 'metadata';
    }
    
    const previewVideo = previewVideoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    previewVideo.currentTime = time;
    
    const handleSeeked = () => {
      canvas.width = 160;
      canvas.height = 90;
      ctx.drawImage(previewVideo, 0, 0, canvas.width, canvas.height);
      setPreviewImage(canvas.toDataURL());
      previewVideo.removeEventListener('seeked', handleSeeked);
    };
    
    previewVideo.addEventListener('seeked', handleSeeked);
  }, [src]);

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(pos * duration, duration));
    setPreviewTime(time);
    setShowPreview(true);
    
    if (previewThrottleRef.current) {
      clearTimeout(previewThrottleRef.current);
    }
    previewThrottleRef.current = setTimeout(() => {
      generatePreviewImage(time);
    }, 100);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume || 1;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!videoRef.current) return;
    
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        const newVolUp = Math.min(1, volume + 0.1);
        setVolume(newVolUp);
        videoRef.current.volume = newVolUp;
        break;
      case 'ArrowDown':
        e.preventDefault();
        const newVolDown = Math.max(0, volume - 0.1);
        setVolume(newVolDown);
        videoRef.current.volume = newVolDown;
        break;
      case 'f':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'm':
        e.preventDefault();
        toggleMute();
        break;
    }
  }, [duration, volume]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
      if (previewThrottleRef.current) {
        clearTimeout(previewThrottleRef.current);
      }
      if (previewVideoRef.current) {
        previewVideoRef.current = null;
      }
    };
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group cursor-pointer outline-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={togglePlay}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src={src}
        poster={poster}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onClick={(e) => e.stopPropagation()}
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
      
      {!isPlaying && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
      
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-20 bg-gradient-to-t from-black/80 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div
            ref={progressRef}
            className="relative h-1 bg-white/30 rounded-full cursor-pointer group/progress mb-3 hover:h-1.5 transition-all"
            onClick={handleSeek}
            onMouseMove={handleProgressHover}
            onMouseLeave={() => setShowPreview(false)}
          >
            <div
              className="absolute top-0 left-0 h-full bg-primary rounded-full"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
            
            {showPreview && duration > 0 && (
              <div
                className="absolute bottom-4 -translate-x-1/2 pointer-events-none"
                style={{ left: `${(previewTime / duration) * 100}%` }}
              >
                <div className="flex flex-col items-center gap-1">
                  {previewImage && (
                    <img
                      src={previewImage}
                      alt="预览"
                      className="w-40 h-24 object-cover rounded-md border border-white/20"
                    />
                  )}
                  <span className="text-xs text-white bg-black/70 px-2 py-0.5 rounded">
                    {formatTime(previewTime)}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-8 h-8 flex items-center justify-center text-white hover:text-primary transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (videoRef.current) {
                    videoRef.current.currentTime = Math.max(0, currentTime - 10);
                  }
                }}
                className="w-8 h-8 flex items-center justify-center text-white hover:text-primary transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.5 3C17.15 3 21.08 6.03 22.47 10.22L20.1 11C19.05 7.81 16.04 5.5 12.5 5.5c-1.54 0-2.96.5-4.13 1.33L10 8.5H4v-6l1.96 1.96C7.63 3.27 9.97 2.5 12.5 2.5zM7.5 21c-4.65 0-8.58-3.03-9.97-7.22L-.1 13c1.05 3.19 4.06 5.5 7.6 5.5 1.54 0 2.96-.5 4.13-1.33L10 15.5h6v6l-1.96-1.96C12.37 20.73 10.03 21.5 7.5 21.5z" transform="scale(0.9) translate(2, 2)" />
                </svg>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (videoRef.current) {
                    videoRef.current.currentTime = Math.min(duration, currentTime + 10);
                  }
                }}
                className="w-8 h-8 flex items-center justify-center text-white hover:text-primary transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.5 3C7.85 3 3.92 6.03 2.53 10.22L4.9 11C5.95 7.81 8.96 5.5 12.5 5.5c1.54 0 2.96.5 4.13 1.33L15 8.5h6v-6l-1.96 1.96C17.37 3.27 15.03 2.5 12.5 2.5zM17.5 21c4.65 0 8.58-3.03 9.97-7.22L25.1 13c-1.05 3.19-4.06 5.5-7.6 5.5-1.54 0-2.96-.5-4.13-1.33L15 15.5H9v6l1.96-1.96C12.63 20.73 14.97 21.5 17.5 21.5z" transform="scale(0.9) translate(-2, 2)" />
                </svg>
              </button>
              
              <div className="flex items-center gap-2 group/volume">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  className="w-8 h-8 flex items-center justify-center text-white hover:text-primary transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  onClick={(e) => e.stopPropagation()}
                  className="w-0 group-hover/volume:w-20 transition-all duration-200 accent-primary cursor-pointer"
                />
              </div>
              
              <span className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration || durationSeconds || 0)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const speed = videoRef.current?.playbackRate || 1;
                  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
                  const currentIndex = speeds.indexOf(speed);
                  const nextIndex = (currentIndex + 1) % speeds.length;
                  if (videoRef.current) {
                    videoRef.current.playbackRate = speeds[nextIndex];
                  }
                }}
                className="px-2 py-1 text-white text-sm hover:text-primary transition-colors"
              >
                {videoRef.current?.playbackRate || 1}x
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                className="w-8 h-8 flex items-center justify-center text-white hover:text-primary transition-colors"
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
