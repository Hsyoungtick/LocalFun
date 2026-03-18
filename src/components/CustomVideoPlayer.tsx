import { useState, useRef, useEffect, MouseEvent, ChangeEvent, forwardRef, useImperativeHandle, useCallback } from 'react';
import { updatePlayHistory, checkSpriteExists, getSubtitleStatus, getSubtitleContent, generateSubtitle, cancelSubtitleGeneration, getWhisperConfig, startRealtimeSubtitle, getSubtitleSegments, SubtitleContent, WhisperConfig, RealtimeSubtitleEvent, SubtitleSegment } from '../api';
import { useVideoSettings, WHISPER_LANGUAGES } from '../hooks/useVideoSettings';

interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  durationSeconds?: number;
  videoId: number;
  title?: string;
  author?: string;
  initialProgress?: number;
  startTime?: number;
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
  startTime,
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
  
  // 视频设置
  const { settings, updateSettings } = useVideoSettings();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [spriteAvailable, setSpriteAvailable] = useState<boolean | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [hasSetInitialProgress, setHasSetInitialProgress] = useState(false);
  const [showEndCountdown, setShowEndCountdown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  
  // 字幕相关状态
  const [subtitles, setSubtitles] = useState<SubtitleContent | null>(null);
  const [subtitleStatus, setSubtitleStatus] = useState<{ exists: boolean; isGenerating: boolean }>({ exists: false, isGenerating: false });
  const [showVideoSettings, setShowVideoSettings] = useState(false);
  const [whisperConfig, setWhisperConfig] = useState<WhisperConfig | null>(null);
  const [subtitleEnabled, setSubtitleEnabled] = useState(settings.autoShowSubtitle);
  const [generatingMessage, setGeneratingMessage] = useState('');
  
  // 实时字幕相关状态
  const [isRealtimeMode, setIsRealtimeMode] = useState(false);
  const [realtimeSubtitles, setRealtimeSubtitles] = useState<Array<{ start: number; end: number; text: string }>>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<string>('');
  const [savedSegments, setSavedSegments] = useState<SubtitleSegment[]>([]);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const volumeIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const seekIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopRealtimeRef = useRef<(() => void) | null>(null);
  const subtitleIdCounterRef = useRef(0);
  
  const frameCount = 20;
  const cols = 5;
  const rows = 4;
  const spriteUrl = `http://localhost:3001/previews/${videoId}_sprite.jpg`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // 发送时间更新事件
      window.dispatchEvent(new CustomEvent('videoTimeUpdate', { detail: video.currentTime }));
    };
    const handleLoadedMetadata = () => {
      if (!durationSeconds) {
        setDuration(video.duration);
      }
    };
    const handleCanPlay = () => {
      // 如果有 startTime 参数，优先使用
      if (startTime !== undefined && startTime > 0 && !hasSetInitialProgress) {
        video.currentTime = startTime;
        setHasSetInitialProgress(true);
      } else if (!hasSetInitialProgress && initialProgress > 0) {
        // 如果进度 >= 100%，从 0 开始播放
        if (initialProgress >= 100) {
          video.currentTime = 0;
        } else {
          video.currentTime = (initialProgress / 100) * (duration || video.duration || 0);
        }
        setHasSetInitialProgress(true);
      }
      
      // 自动播放
      if (settings.autoPlay) {
        video.play().catch(() => {});
      }
    };
    const handlePlay = () => {
      setIsPlaying(true);
      // 立即保存一次播放历史
      const progressPercent = (video.currentTime / (duration || 1)) * 100;
      updatePlayHistory(videoId, progressPercent).catch(console.error);
      // 然后每10秒保存一次
      saveProgressIntervalRef.current = setInterval(() => {
        const progressPercent = (video.currentTime / (duration || 1)) * 100;
        updatePlayHistory(videoId, progressPercent).catch(console.error);
      }, 10000);
    };
    const handlePause = () => {
      setIsPlaying(false);
      if (saveProgressIntervalRef.current) {
        clearInterval(saveProgressIntervalRef.current);
        saveProgressIntervalRef.current = null;
      }
      const progressPercent = (video.currentTime / (duration || 1)) * 100;
      updatePlayHistory(videoId, progressPercent).catch(console.error);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      if (saveProgressIntervalRef.current) {
        clearInterval(saveProgressIntervalRef.current);
        saveProgressIntervalRef.current = null;
      }
      const progressPercent = (video.currentTime / (duration || 1)) * 100;
      updatePlayHistory(videoId, progressPercent).catch(console.error);
      
      // 如果有下一个视频，显示倒计时弹窗
      if (hasNext && onEnded) {
        setShowEndCountdown(true);
        setCountdown(5);
        countdownIntervalRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
              }
              setShowEndCountdown(false);
              onEnded();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
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
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      const progressPercent = (video.currentTime / (duration || 1)) * 100;
      updatePlayHistory(videoId, progressPercent).catch(console.error);
    };
  }, [durationSeconds, videoId, initialProgress, startTime, hasSetInitialProgress, hasNext, onEnded, settings.autoPlay]);

  // 检查精灵图是否存在
  useEffect(() => {
    checkSpriteExists(videoId).then(exists => setSpriteAvailable(exists));
  }, [videoId]);

  // 加载字幕状态、内容和已保存的字幕片段
  useEffect(() => {
    const loadSubtitleData = async () => {
      try {
        const status = await getSubtitleStatus(videoId);
        setSubtitleStatus({ exists: status.exists, isGenerating: status.isGenerating });
        
        if (status.exists) {
          const content = await getSubtitleContent(videoId);
          setSubtitles(content);
        }
        
        // 加载已保存的字幕片段
        const segments = await getSubtitleSegments(videoId);
        setSavedSegments(segments);
        console.log(`[字幕] 加载了 ${segments.length} 条已保存的字幕片段`);
      } catch (error) {
        console.error('加载字幕状态失败:', error);
      }
    };
    
    loadSubtitleData();
  }, [videoId]);

  // 加载 Whisper 配置
  useEffect(() => {
    getWhisperConfig().then(setWhisperConfig).catch(console.error);
  }, []);

  // 轮询字幕生成状态
  useEffect(() => {
    if (!subtitleStatus.isGenerating) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const status = await getSubtitleStatus(videoId);
        setSubtitleStatus({ exists: status.exists, isGenerating: status.isGenerating });
        
        if (status.exists && !subtitleStatus.exists) {
          const content = await getSubtitleContent(videoId);
          setSubtitles(content);
          setGeneratingMessage('字幕生成完成！');
          setTimeout(() => setGeneratingMessage(''), 3000);
        }
      } catch (error) {
        console.error('轮询字幕状态失败:', error);
      }
    }, 2000);
    
    return () => clearInterval(pollInterval);
  }, [videoId, subtitleStatus.isGenerating, subtitleStatus.exists]);

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

  // 进度条拖动处理
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingProgress) return;
      const video = videoRef.current;
      const progress = progressRef.current;
      if (!video || !progress || duration <= 0) return;

      const rect = progress.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newTime = percentage * duration;
      video.currentTime = newTime;
      setCurrentTime(newTime);
      setPreviewTime(newTime);
      setPreviewPosition(percentage * 100);
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingProgress(false);
    };

    if (isDraggingProgress) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingProgress, duration]);

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

      // 倒计时期间的特殊处理
      if (showEndCountdown) {
        switch (e.key) {
          case ' ':
            e.preventDefault();
            // 关闭倒计时
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            setShowEndCountdown(false);
            break;
          case 'ArrowLeft':
            e.preventDefault();
            // 快退并关闭倒计时
            video.currentTime = Math.max(0, video.currentTime - 2);
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            setShowEndCountdown(false);
            break;
          case 'ArrowRight':
            e.preventDefault();
            // 右箭头不反应
            break;
        }
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
  }, [duration, showEndCountdown]);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 处理生成字幕
  const handleGenerateSubtitle = useCallback(async () => {
    if (!whisperConfig?.bestEngine) {
      return;
    }
    
    try {
      setGeneratingMessage('正在启动字幕生成...');
      await generateSubtitle(videoId, { 
        model: settings.model || undefined, 
        language: settings.language 
      });
      setSubtitleStatus(prev => ({ ...prev, isGenerating: true }));
      setGeneratingMessage('字幕生成中，请稍候...');
    } catch (error: any) {
      console.error('启动字幕生成失败:', error);
      setGeneratingMessage('');
    }
  }, [videoId, whisperConfig, settings.model, settings.language]);

  // 处理取消生成
  const handleCancelGenerate = async () => {
    try {
      await cancelSubtitleGeneration(videoId);
      setSubtitleStatus(prev => ({ ...prev, isGenerating: false }));
      setGeneratingMessage('');
    } catch (error) {
      console.error('取消生成失败:', error);
    }
  };

  // 启动实时字幕模式
  const handleStartRealtime = useCallback(() => {
    if (!whisperConfig?.bestEngine) {
      return;
    }

    // 获取当前播放时间
    const currentTime = videoRef.current?.currentTime || 0;
    console.log(`[实时字幕] 从 ${currentTime.toFixed(2)} 秒开始生成`);

    setIsRealtimeMode(true);
    setRealtimeSubtitles([]);
    setRealtimeStatus('正在提取音频...');
    setGeneratingMessage('实时字幕模式已启动');

    stopRealtimeRef.current = startRealtimeSubtitle(
      videoId,
      (event: RealtimeSubtitleEvent) => {
        console.log('[实时字幕] 收到事件:', event);
        if (event.type === 'status') {
          setRealtimeStatus(event.message || '');
        } else if (event.type === 'subtitle') {
          console.log('[实时字幕] 添加字幕:', event.start, event.end, event.text);
          const newSubtitle = {
            start: event.start!,
            end: event.end!,
            text: event.text!
          };
          setRealtimeSubtitles(prev => {
            const newSubtitles = [...prev, newSubtitle];
            console.log('[实时字幕] 当前字幕数量:', newSubtitles.length);
            return newSubtitles;
          });
          // 同时更新已保存的字幕片段，让字幕列表实时显示
          setSavedSegments(prev => {
            subtitleIdCounterRef.current += 1;
            const newSegment: SubtitleSegment = {
              id: subtitleIdCounterRef.current,
              startTime: event.start!,
              endTime: event.end!,
              text: event.text!,
              language: 'auto',
              model: 'whisper'
            };
            return [...prev, newSegment].sort((a, b) => a.startTime - b.startTime);
          });
          // 触发自定义事件，通知 VideoDetail 更新字幕列表
          window.dispatchEvent(new CustomEvent('subtitleGenerated', {
            detail: {
              startTime: event.start,
              endTime: event.end,
              text: event.text
            }
          }));
        } else if (event.type === 'complete') {
          setRealtimeStatus(`字幕生成完成，已保存 ${event.savedSegments || 0} 条`);
          setGeneratingMessage('');
          // 重新加载已保存的字幕片段
          getSubtitleSegments(videoId).then(segments => {
            setSavedSegments(segments);
            console.log(`[字幕] 重新加载了 ${segments.length} 条字幕片段`);
          });
          setTimeout(() => {
            setIsRealtimeMode(false);
            setRealtimeStatus('');
            setRealtimeSubtitles([]);
          }, 2000);
        } else if (event.type === 'error') {
          console.error('[实时字幕] 错误:', event.error);
          setIsRealtimeMode(false);
          setGeneratingMessage('');
        }
      },
      (error) => {
        console.error('[实时字幕] 连接错误:', error.message);
        setIsRealtimeMode(false);
        setGeneratingMessage('');
      },
      currentTime,
      { language: settings.language, model: settings.model || undefined }
    );
  }, [videoId, whisperConfig, settings.language, settings.model]);

  // 自动字幕逻辑
  useEffect(() => {
    if (!whisperConfig?.bestEngine || isRealtimeMode || subtitleStatus.isGenerating) return;
    
    // 自动实时字幕
    if (settings.autoRealtimeSubtitle && !subtitleStatus.exists && savedSegments.length === 0) {
      console.log('[自动字幕] 启动实时字幕');
      handleStartRealtime();
    }
    // 自动生成完整字幕
    else if (settings.autoGenerateSubtitle && !subtitleStatus.exists && savedSegments.length === 0) {
      console.log('[自动字幕] 启动完整字幕生成');
      handleGenerateSubtitle();
    }
  }, [videoId, whisperConfig, settings.autoRealtimeSubtitle, settings.autoGenerateSubtitle, subtitleStatus.exists, savedSegments.length, handleStartRealtime, handleGenerateSubtitle]);

  // 停止实时字幕模式
  const handleStopRealtime = () => {
    if (stopRealtimeRef.current) {
      stopRealtimeRef.current();
      stopRealtimeRef.current = null;
    }
    setIsRealtimeMode(false);
    setGeneratingMessage('');
  };

  // 获取当前时间对应的字幕（支持普通模式、实时模式和已保存字幕片段）
  const getCurrentSubtitleText = useCallback(() => {
    if (!subtitleEnabled) return null;

    // 实时模式：优先显示新生成的字幕，然后是已保存的字幕片段
    if (isRealtimeMode) {
      // 先检查新生成的字幕
      if (realtimeSubtitles.length > 0) {
        const currentSub = realtimeSubtitles.find(
          sub => currentTime >= sub.start && currentTime <= sub.end
        );
        if (currentSub) {
          return currentSub.text;
        }
      }
      // 再检查已保存的字幕片段
      if (savedSegments.length > 0) {
        const currentSub = savedSegments.find(
          sub => currentTime >= sub.startTime && currentTime <= sub.endTime
        );
        if (currentSub) {
          return currentSub.text;
        }
      }
      return null;
    }

    // 普通模式：优先使用 SRT 文件，其次使用已保存的字幕片段
    if (subtitles) {
      const currentSub = subtitles.subtitles.find(
        sub => currentTime >= sub.start && currentTime <= sub.end
      );
      if (currentSub) {
        return currentSub.text;
      }
    }
    
    // 如果没有 SRT 文件，使用已保存的字幕片段
    if (savedSegments.length > 0) {
      const currentSub = savedSegments.find(
        sub => currentTime >= sub.startTime && currentTime <= sub.endTime
      );
      if (currentSub) {
        return currentSub.text;
      }
    }

    return null;
  }, [subtitles, subtitleEnabled, currentTime, isRealtimeMode, realtimeSubtitles, savedSegments]);

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
    const newTime = Math.max(0, Math.min(1, percentage)) * duration;
    video.currentTime = newTime;
    
    // 如果实时字幕模式正在运行，重新启动从新位置开始
    if (isRealtimeMode) {
      console.log(`[实时字幕] 检测到进度跳转，从 ${newTime.toFixed(2)} 秒重新开始生成`);
      
      // 先停止旧的连接
      if (stopRealtimeRef.current) {
        stopRealtimeRef.current();
        stopRealtimeRef.current = null;
      }
      
      setRealtimeSubtitles([]);
      setRealtimeStatus('正在提取音频...');
      
      // 等待一小段时间让服务端清理完成
      setTimeout(() => {
        // 重新启动实时字幕
        stopRealtimeRef.current = startRealtimeSubtitle(
          videoId,
          (event: RealtimeSubtitleEvent) => {
            if (event.type === 'status') {
              setRealtimeStatus(event.message || '');
            } else if (event.type === 'subtitle') {
              const newSubtitle = {
                start: event.start!,
                end: event.end!,
                text: event.text!
              };
              setRealtimeSubtitles(prev => [...prev, newSubtitle]);
              setSavedSegments(prev => {
                subtitleIdCounterRef.current += 1;
                const newSegment: SubtitleSegment = {
                  id: subtitleIdCounterRef.current,
                  startTime: event.start!,
                  endTime: event.end!,
                  text: event.text!,
                  language: 'auto',
                  model: 'whisper'
                };
                return [...prev, newSegment].sort((a, b) => a.startTime - b.startTime);
              });
              window.dispatchEvent(new CustomEvent('subtitleGenerated', {
                detail: { startTime: event.start, endTime: event.end, text: event.text }
              }));
            } else if (event.type === 'complete') {
              setRealtimeStatus(`字幕生成完成，已保存 ${event.savedSegments || 0} 条`);
              setGeneratingMessage('');
              getSubtitleSegments(videoId).then(segments => setSavedSegments(segments));
              setTimeout(() => {
                setIsRealtimeMode(false);
                setRealtimeStatus('');
                setRealtimeSubtitles([]);
              }, 2000);
            } else if (event.type === 'error') {
              console.error('[实时字幕] 错误:', event.error);
              // 如果是取消错误，不显示（这是正常的跳转行为）
              if (event.error !== '已取消') {
                setRealtimeStatus(`错误: ${event.error || '实时字幕生成失败'}`);
              }
            }
          },
          (error) => {
            console.error('[实时字幕] 连接错误:', error.message);
            // 忽略取消相关的错误
            if (!error.message.includes('取消')) {
              setRealtimeStatus(`连接错误: ${error.message}`);
            }
          },
          newTime
        );
      }, 500);
    }
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
    if (isPlaying && !showVideoSettings) {
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
        playsInline
        onClick={handlePlayPause}
        onDoubleClick={toggleFullscreen}
      />

      {/* 字幕显示区域 */}
      {subtitleEnabled && getCurrentSubtitleText() && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none z-20">
          <div 
            className="bg-black/70 text-white px-4 py-2 rounded max-w-[80%] text-center"
            style={{ fontSize: isFullscreen ? '1.5rem' : '1rem' }}
          >
            {getCurrentSubtitleText()}
          </div>
        </div>
      )}

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

      {/* 视频结束倒计时弹窗 */}
      {showEndCountdown && (
        <div className="absolute inset-0 flex items-center justify-center z-40">
          <div className="bg-black/80 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-white text-sm">即将播放下一个视频</span>
            <span className="text-primary text-2xl font-bold">{countdown}</span>
            <button
              onClick={() => {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                }
                setShowEndCountdown(false);
              }}
              className="text-white/80 text-xs hover:text-white transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {showControls && (
        <>
          {/* 底部渐变 */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-linear-to-t from-black/30 to-transparent pointer-events-none" />
          
          {/* 全屏时的顶部渐变和标题 */}
          {isFullscreen && (
            <>
              <div className="absolute top-0 left-0 right-0 h-20 bg-linear-to-b from-black/20 to-transparent pointer-events-none" />
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
                className={`relative bg-white/30 rounded-full cursor-pointer transition-all ${isDraggingProgress ? 'h-2' : 'h-1 hover:h-2'}`}
                onClick={handleProgressClick}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDraggingProgress(true);
                  handleProgressClick(e as unknown as MouseEvent<HTMLDivElement>);
                }}
                onMouseMove={handleProgressMouseMove}
                onMouseEnter={handleProgressMouseEnter}
                onMouseLeave={handleProgressMouseLeave}
              >
                <div
                  className="absolute h-full bg-primary rounded-full"
                  style={{ width: `${isDraggingProgress ? previewPosition : progress}%` }}
                />
                <div
                  className={`absolute w-3 h-3 bg-white rounded-full -top-1 shadow-lg transition-opacity ${isDraggingProgress ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
                  style={{ left: `calc(${isDraggingProgress ? previewPosition : progress}% - 6px)` }}
                />

                {(isHoveringProgress || isDraggingProgress) && duration > 0 && (
                  <div
                    className="absolute pointer-events-none z-20"
                    style={{ 
                      left: `${previewPosition < 10 ? 10 : previewPosition > 90 ? 90 : previewPosition}%`,
                      bottom: '1rem',
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div 
                        className="bg-slate-800 rounded-lg overflow-hidden shadow-xl border border-white/10"
                        style={{ 
                          width: isFullscreen ? '240px' : '160px',
                          aspectRatio: '16/9'
                        }}
                      >
                        {spriteAvailable === true ? (
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
            <div className="px-4 py-3 flex items-center justify-between select-none">
              {/* 左侧：上一个、播放/暂停、下一个、时间 */}
              <div className="flex items-center gap-1">
                {hasPrev && (
                  <button
                    onClick={onPrev}
                    className="w-10 h-10 flex items-center justify-center text-white hover:text-primary transition-colors"
                    title="上一个视频"
                  >
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                      <polygon points="6,12 18,4 18,20" />
                      <rect x="4" y="5" width="2" height="14" />
                    </svg>
                  </button>
                )}

                <button
                  onClick={handlePlayPause}
                  className="w-12 h-12 flex items-center justify-center text-white hover:text-primary transition-colors"
                >
                  {isPlaying ? (
                    <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current">
                      <rect x="6" y="5" width="3" height="14" rx="0.5" />
                      <rect x="15" y="5" width="3" height="14" rx="0.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current">
                      <polygon points="8,5 19,12 8,19" />
                    </svg>
                  )}
                </button>

                {hasNext && (
                  <button
                    onClick={onNext}
                    className="w-10 h-10 flex items-center justify-center text-white hover:text-primary transition-colors"
                    title="下一个视频"
                  >
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                      <polygon points="18,12 6,4 6,20" />
                      <rect x="18" y="5" width="2" height="14" />
                    </svg>
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

                {/* 字幕显示开关按钮 */}
                <button
                  onClick={() => setSubtitleEnabled(!subtitleEnabled)}
                  className={`w-10 h-10 flex items-center justify-center transition-colors ${
                    (subtitleStatus.exists || isRealtimeMode || savedSegments.length > 0) && subtitleEnabled ? 'text-primary' : 'text-white hover:text-primary'
                  }`}
                  title={subtitleEnabled ? '关闭字幕' : '开启字幕'}
                >
                  <span className="material-symbols-outlined text-xl">
                    {(subtitleStatus.exists || isRealtimeMode || savedSegments.length > 0) && subtitleEnabled ? 'subtitles' : 'subtitles_off'}
                  </span>
                </button>

                {/* 视频设置按钮 */}
                <div 
                  className="relative"
                  onMouseEnter={() => setShowVideoSettings(true)}
                  onMouseLeave={() => setShowVideoSettings(false)}
                >
                  <div
                    className={`w-10 h-10 flex items-center justify-center transition-colors cursor-default ${
                      isRealtimeMode ? 'text-green-400' : 'text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      settings
                    </span>
                    {isRealtimeMode && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    )}
                  </div>
                  
                  {/* 视频设置面板 */}
                  {showVideoSettings && (
                    <div className="absolute bottom-full right-0 pb-2 w-64">
                      <div className="bg-white rounded-lg p-3 shadow-xl space-y-3">
                        <div className="text-sm font-medium text-slate-700 border-b pb-2">视频设置</div>
                        
                        {/* 语言选择 */}
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">首选语言</label>
                          <select
                            value={settings.language}
                            onChange={(e) => updateSettings({ language: e.target.value })}
                            className="w-full text-sm border rounded px-2 py-1 bg-white"
                          >
                            {WHISPER_LANGUAGES.map(lang => (
                              <option key={lang.code} value={lang.code}>{lang.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* 模型选择 */}
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Whisper 模型</label>
                          <select
                            value={settings.model}
                            onChange={(e) => updateSettings({ model: e.target.value })}
                            className="w-full text-sm border rounded px-2 py-1 bg-white"
                          >
                            <option value="">默认模型</option>
                            {whisperConfig?.models.map(model => (
                              <option key={model.path} value={model.path}>{model.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* 开关选项 */}
                        <div className="space-y-2 pt-2 border-t">
                          <label className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">自动播放</span>
                            <input
                              type="checkbox"
                              checked={settings.autoPlay}
                              onChange={(e) => updateSettings({ autoPlay: e.target.checked })}
                              className="w-4 h-4"
                            />
                          </label>
                          
                          <label className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">显示字幕</span>
                            <input
                              type="checkbox"
                              checked={settings.autoShowSubtitle}
                              onChange={(e) => {
                                updateSettings({ autoShowSubtitle: e.target.checked });
                                setSubtitleEnabled(e.target.checked);
                              }}
                              className="w-4 h-4"
                            />
                          </label>
                          
                          <label className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">自动实时字幕</span>
                            <input
                              type="checkbox"
                              checked={settings.autoRealtimeSubtitle}
                              onChange={(e) => updateSettings({ autoRealtimeSubtitle: e.target.checked })}
                              className="w-4 h-4"
                            />
                          </label>
                          
                          <label className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">自动生成字幕</span>
                            <input
                              type="checkbox"
                              checked={settings.autoGenerateSubtitle}
                              onChange={(e) => updateSettings({ autoGenerateSubtitle: e.target.checked })}
                              className="w-4 h-4"
                            />
                          </label>
                        </div>
                        
                        {/* 实时模式运行中 */}
                        {isRealtimeMode && (
                          <div className="space-y-2 pt-2 border-t">
                            <div className="flex items-center gap-2 text-green-600 text-sm">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              实时字幕运行中
                            </div>
                            <div className="text-slate-500 text-xs">
                              已生成 {realtimeSubtitles.length} 条
                            </div>
                            <button
                              onClick={handleStopRealtime}
                              className="w-full bg-red-50 text-red-500 text-sm py-1.5 rounded hover:bg-red-100 transition-colors"
                            >
                              停止
                            </button>
                          </div>
                        )}
                        
                        {/* 普通模式生成中 */}
                        {subtitleStatus.isGenerating && !isRealtimeMode && (
                          <div className="space-y-2 pt-2 border-t">
                            <div className="text-slate-700 text-sm">正在生成字幕...</div>
                            <div className="w-full bg-slate-200 rounded-full h-1">
                              <div className="bg-primary h-1 rounded-full animate-pulse w-1/2" />
                            </div>
                            <button
                              onClick={handleCancelGenerate}
                              className="text-red-500 text-xs hover:text-red-600"
                            >
                              取消
                            </button>
                          </div>
                        )}
                        
                        {!whisperConfig?.bestEngine && (
                          <div className="text-slate-500 text-xs text-center pt-2 border-t">
                            未找到 Whisper 引擎
                          </div>
                        )}
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
