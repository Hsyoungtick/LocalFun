import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getVideoDetail, 
  getVideoStreamUrl, 
  getThumbnailUrl, 
  VideoDetail as VideoDetailType, 
  getSameCategoryVideos, 
  Video,
  addFavoriteFrame,
  updateFavoriteFrameNote,
  deleteFavoriteFrame,
  resetVideoData,
  likeVideo,
  toggleFavorite,
  getCategories,
  Category
} from '../api';
import CustomVideoPlayer, { CustomVideoPlayerRef } from './CustomVideoPlayer';
import VideoCard from './VideoCard';

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoDetailType | null>(null);
  const [sameCategoryVideos, setSameCategoryVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('created_at');
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'playlist' | 'subtitles' | 'frames'>('playlist');
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showAddFrameDialog, setShowAddFrameDialog] = useState(false);
  const [tempTimeSeconds, setTempTimeSeconds] = useState(0);
  const [frameNote, setFrameNote] = useState('');
  const [editingFrameId, setEditingFrameId] = useState<number | null>(null);
  const videoPlayerRef = useRef<CustomVideoPlayerRef>(null);
  const playlistContainerRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    Promise.all([
      getVideoDetail(parseInt(id)),
      getCategories()
    ]).then(([videoData, categoriesData]) => {
      setVideo(videoData);
      setCategories(categoriesData);
      setSelectedCategory(videoData.category);
    })
    .catch((err) => {
      setError(err.message);
    })
    .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    
    getSameCategoryVideos(parseInt(id), { sort: sortBy, order: sortOrder, limit: 20 })
      .then(setSameCategoryVideos)
      .catch(console.error);
  }, [id, sortBy, sortOrder]);

  // 定期刷新播放列表以更新上次播放时间
  useEffect(() => {
    if (!id) return;
    
    const interval = setInterval(() => {
      getSameCategoryVideos(parseInt(id), { sort: sortBy, order: sortOrder, limit: 20 })
        .then(setSameCategoryVideos)
        .catch(console.error);
    }, 10000); // 每10秒刷新一次

    // 页面可见性变化时刷新
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        getSameCategoryVideos(parseInt(id), { sort: sortBy, order: sortOrder, limit: 20 })
          .then(setSameCategoryVideos)
          .catch(console.error);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [id, sortBy, sortOrder]);

  // 自动滚动到当前播放的视频
  useEffect(() => {
    if (!video || activeTab !== 'playlist') return;
    
    const timer = setTimeout(() => {
      const container = playlistContainerRef.current;
      const activeElement = container?.querySelector('.bg-primary\\/10') as HTMLElement;
      if (container && activeElement) {
        // 只滚动播放列表容器，不影响整个页面
        container.scrollTop = activeElement.offsetTop - container.offsetTop;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [video?.id, activeTab]);

  const handleAddFavoriteFrame = useCallback((timeSeconds: number) => {
    if (!id || !video) return;
    
    addFavoriteFrame(parseInt(id), timeSeconds)
      .then(() => getVideoDetail(parseInt(id)))
      .then(setVideo)
      .then(() => showToast('已添加喜欢的帧', 'success'))
      .catch(console.error);
  }, [id, video]);

  const handleSaveFavoriteFrame = useCallback(() => {
    if (!id || !video) return;
    
    if (editingFrameId) {
      updateFavoriteFrameNote(parseInt(id), editingFrameId, frameNote || undefined)
        .then(() => getVideoDetail(parseInt(id)))
        .then(setVideo)
        .then(() => setShowAddFrameDialog(false))
        .catch(console.error);
    } else {
      addFavoriteFrame(parseInt(id), tempTimeSeconds, frameNote || undefined)
        .then(() => getVideoDetail(parseInt(id)))
        .then(setVideo)
        .then(() => setShowAddFrameDialog(false))
        .catch(console.error);
    }
  }, [id, video, tempTimeSeconds, frameNote, editingFrameId]);

  const handleEditFrameNote = useCallback((frame: any) => {
    setEditingFrameId(frame.id);
    setFrameNote(frame.note || '');
    setTempTimeSeconds(frame.timeSeconds);
    setShowAddFrameDialog(true);
  }, []);

  const handleDeleteFavoriteFrame = useCallback((frameId: number) => {
    if (!id) return;
    
    deleteFavoriteFrame(parseInt(id), frameId)
      .then(() => {
        return getVideoDetail(parseInt(id));
      })
      .then(setVideo)
      .catch(console.error);
  }, [id]);

  const handleLike = useCallback(() => {
    if (!id || !video) return;
    
    likeVideo(parseInt(id))
      .then(({ likeCount }) => {
        setVideo(prev => prev ? { ...prev, likeCount } : null);
        showToast('已点赞', 'success');
      })
      .catch(console.error);
  }, [id, video]);

  const handleToggleFavorite = useCallback(() => {
    if (!id || !video) return;
    
    const newFavorite = !video.isFavorite;
    console.log('切换收藏状态:', { id, newFavorite });
    toggleFavorite(parseInt(id), newFavorite)
      .then(() => {
        console.log('收藏状态更新成功');
        setVideo(prev => prev ? { ...prev, isFavorite: newFavorite } : null);
        showToast(newFavorite ? '已收藏' : '已取消收藏', 'success');
      })
      .catch((error) => {
        console.error('收藏状态更新失败:', error);
      });
  }, [id, video]);

  const handleResetVideoData = useCallback(() => {
    if (!id) return;
    
    resetVideoData(parseInt(id))
      .then(() => getVideoDetail(parseInt(id)))
      .then(setVideo)
      .then(() => showToast('已重置视频数据', 'info'))
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    const updatePlayerHeight = () => {
      if (playerContainerRef.current) {
        if (window.innerWidth >= 768) {
          playerContainerRef.current.style.height = 'calc((66.67vw - 1rem) * 9 / 16)';
        } else {
          playerContainerRef.current.style.height = 'calc((100vw - 1rem) * 9 / 16)';
        }
      }
    };
    
    updatePlayerHeight();
    window.addEventListener('resize', updatePlayerHeight);
    
    return () => {
      window.removeEventListener('resize', updatePlayerHeight);
    };
  }, []);

  const currentIndex = sameCategoryVideos.findIndex(v => v.id === video?.id) ?? -1;
  
  const prevVideo = sameCategoryVideos.length && currentIndex > 0 
    ? sameCategoryVideos[currentIndex - 1]
    : null;
  
  const nextVideo = sameCategoryVideos.length 
    ? sameCategoryVideos[(currentIndex + 1) % sameCategoryVideos.length]
    : null;

  const handlePrev = useCallback(() => {
    if (prevVideo) {
      const wasFullscreen = videoPlayerRef.current?.isFullscreen() || false;
      navigate(`/video/${prevVideo.id}`);
      if (wasFullscreen) {
        setTimeout(() => videoPlayerRef.current?.enterFullscreen(), 100);
      }
    }
  }, [prevVideo, navigate]);

  const handleNext = useCallback(() => {
    if (nextVideo) {
      const wasFullscreen = videoPlayerRef.current?.isFullscreen() || false;
      navigate(`/video/${nextVideo.id}`);
      if (wasFullscreen) {
        setTimeout(() => videoPlayerRef.current?.enterFullscreen(), 100);
      }
    }
  }, [nextVideo, navigate]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </main>
    );
  }

  if (error || !video) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined text-6xl text-slate-300">error</span>
        <div className="text-slate-500">{error || '视频不存在'}</div>
        <Link to="/" className="text-primary hover:underline">返回首页</Link>
      </main>
    );
  }

  const authorName = video.author?.name || '未知作者';
  const authorDescription = video.author?.description;

  return (
    <main className="flex-1 flex flex-col gap-4 px-4 md:px-20 py-6 max-w-400 mx-auto w-full">
      {/* 第一行：视频信息（左）+ 作者信息（右） */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* 左侧：视频信息 */}
        <div className="w-full md:w-2/3 flex flex-col gap-1">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{video.title}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">visibility</span> {video.views}次观看
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">calendar_today</span> {video.time}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">movie</span> #{video.category}
            </span>
            <span>文件大小: {video.fileSize}</span>
          </div>
        </div>

        {/* 右侧：作者信息 */}
        <div className="w-full md:w-1/3">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm h-full flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-primary">person</span>
            <div className="flex-1 min-w-0">
              <Link 
                to={video.author ? `/author/${video.author.name}` : '#'} 
                className="font-bold text-slate-900 dark:text-slate-100 hover:text-primary transition-colors block truncate"
              >
                {authorName}
              </Link>
              {authorDescription && (
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{authorDescription}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 第二行：播放器（左）+ 标签页（右） */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* 左侧：播放器 */}
        <div className="w-full md:w-2/3 flex flex-col justify-between">
          <div 
            ref={playerContainerRef}
            className="relative group rounded-xl overflow-hidden bg-black"
          >
            <CustomVideoPlayer
              ref={videoPlayerRef}
              src={getVideoStreamUrl(video.id)}
              poster={getThumbnailUrl(video.id)}
              durationSeconds={video.durationSeconds}
              videoId={video.id}
              title={video.title}
              author={authorName}
              initialProgress={video.playProgress || 0}
              onPrev={handlePrev}
              onNext={handleNext}
              onEnded={handleNext}
              hasPrev={!!prevVideo}
              hasNext={!!nextVideo}
            />
          </div>
          
          {/* 操作按钮 */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const currentTime = videoPlayerRef.current?.getCurrentTime() || 0;
                  console.log('Adding favorite frame at time:', currentTime);
                  handleAddFavoriteFrame(currentTime);
                }}
                className="flex items-center justify-center w-21 h-15 rounded-lg transition-all group"
              >
                <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 transition-colors group-hover:text-pink-500" style={{ fontVariationSettings: "'FILL' 1", fontSize: '1.875rem' }}>thumb_up</span>
                {video.favoriteFramesCount > 0 && (
                  <span className="text-base font-bold text-slate-600 dark:text-slate-400 group-hover:text-pink-500 ml-1">
                    {video.favoriteFramesCount}
                  </span>
                )}
              </button>

              <button
                onClick={handleLike}
                className="flex items-center justify-center w-21 h-15 rounded-lg transition-all group"
              >
                <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 transition-colors group-hover:text-pink-500" style={{ fontVariationSettings: "'FILL' 1", fontSize: '1.875rem' }}>favorite</span>
                {video.likeCount > 0 && (
                  <span className="text-base font-bold text-slate-600 dark:text-slate-400 group-hover:text-pink-500 ml-1">
                    {video.likeCount}
                  </span>
                )}
              </button>

              <button
                onClick={handleToggleFavorite}
                className={`flex items-center justify-center w-21 h-15 rounded-lg transition-all ${
                  video.isFavorite 
                    ? '' 
                    : 'group'
                }`}
              >
                <span 
                  className={`material-symbols-outlined transition-colors ${video.isFavorite ? 'text-pink-500' : 'text-slate-600 dark:text-slate-400 group-hover:text-pink-500'}`}
                  style={{ fontVariationSettings: "'FILL' 1", fontSize: '1.875rem' }}
                >
                  star
                </span>
              </button>

              <button
                onClick={() => setShowMoveDialog(true)}
                className="flex items-center justify-center w-21 h-15 rounded-lg transition-all group"
              >
                <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 transition-colors group-hover:text-pink-500" style={{ fontVariationSettings: "'FILL' 1", fontSize: '1.875rem' }}>drive_file_move</span>
              </button>
            </div>

            <button
              onClick={() => {
                if (window.confirm('确定要重置该视频的所有数据吗？这将清除播放量、喜欢的帧、喜欢数和收藏状态。')) {
                  handleResetVideoData();
                }
              }}
              className="flex items-center justify-center w-21 h-15 rounded-lg transition-all group"
            >
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 transition-colors group-hover:text-red-500" style={{ fontVariationSettings: "'FILL' 1", fontSize: '1.875rem' }}>restart_alt</span>
            </button>
          </div>
        </div>

        {/* 右侧：标签页 */}
        <div className="w-full md:w-1/3 flex flex-col min-w-0">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm flex flex-col overflow-hidden w-full min-w-0 max-h-[calc((100vw-1rem)*9/16)] md:max-h-[calc((66.67vw-1rem)*9/16)]">
            {/* 标签导航 */}
            <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0">
              <button
                onClick={() => setActiveTab('playlist')}
                className={`flex-1 px-2 py-2 rounded-md transition-all flex items-center justify-center w-10 ${
                  activeTab === 'playlist'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="播放列表"
              >
                <span className="material-symbols-outlined text-xl">list</span>
              </button>
              <button
                onClick={() => setActiveTab('subtitles')}
                className={`flex-1 px-2 py-2 rounded-md transition-all flex items-center justify-center w-10 ${
                  activeTab === 'subtitles'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="字幕"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <rect x="5" y="14" width="6" height="2" rx="0.5" />
                  <rect x="13" y="14" width="6" height="2" rx="0.5" />
                  <rect x="5" y="10" width="4" height="2" rx="0.5" />
                  <rect x="11" y="10" width="8" height="2" rx="0.5" />
                </svg>
              </button>
              <button
                onClick={() => setActiveTab('frames')}
                className={`flex-1 px-2 py-2 rounded-md transition-all flex items-center justify-center w-10 ${
                  activeTab === 'frames'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="喜欢的帧"
              >
                <span className="material-symbols-outlined text-xl">thumb_up</span>
              </button>
            </div>

            {/* 标签内容 */}
            <div ref={playlistContainerRef} className="flex-1 overflow-y-auto no-scrollbar min-w-0">
              {activeTab === 'playlist' ? (
                <div className="space-y-2 w-full min-w-0">
                  {sameCategoryVideos.length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-4">
                      暂无相关视频
                    </div>
                  ) : (
                    sameCategoryVideos.map((v) => (
                      <VideoCard
                        key={v.id}
                        video={v}
                        variant="playlist"
                        isActive={v.id === video.id}
                      />
                    ))
                  )}
                </div>
              ) : activeTab === 'subtitles' ? (
                <div className="text-sm text-slate-400 text-center py-4 flex items-center justify-center h-full w-full">
                  暂无字幕
                </div>
              ) : (
                <div className="space-y-3 w-full">
                  {video.favoriteFrames.length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-4">
                      暂无喜欢的帧
                    </div>
                  ) : (
                    video.favoriteFrames.map((frame) => (
                      <div key={frame.id} className="group">
                        <div 
                          className="relative rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-pink-500 transition-all"
                          onClick={() => {
                            const event = new CustomEvent('seekTo', { detail: frame.timeSeconds });
                            window.dispatchEvent(event);
                          }}
                        >
                          <video
                            src={getVideoStreamUrl(video.id)}
                            className="aspect-video w-full object-cover"
                            style={{ display: 'none' }}
                            ref={(el) => {
                              if (el) {
                                el.currentTime = frame.timeSeconds;
                                el.preload = 'auto';
                                el.addEventListener('loadeddata', () => {
                                  el.style.display = 'block';
                                }, { once: true });
                              }
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-2">
                            <span className="text-xs text-white font-medium">
                              {Math.floor(frame.timeSeconds / 60)}:{Math.floor(frame.timeSeconds % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditFrameNote(frame);
                              }}
                              className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-white text-sm">edit</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFavoriteFrame(frame.id);
                              }}
                              className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-white text-sm">delete</span>
                            </button>
                          </div>
                        </div>
                        {frame.note && (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                            {frame.note}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 移动视频对话框 */}
      {showMoveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              移动视频
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                选择新分类
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm border-none outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMoveDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  // TODO: 实现移动逻辑
                  setShowMoveDialog(false);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                确认移动
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加喜欢帧对话框 */}
      {showAddFrameDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              {editingFrameId ? '编辑喜欢的帧' : '添加喜欢的帧'}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                时间
              </label>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {Math.floor(tempTimeSeconds / 60)}:{Math.floor(tempTimeSeconds % 60).toString().padStart(2, '0')}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                注释（可选）
              </label>
              <textarea
                value={frameNote}
                onChange={(e) => setFrameNote(e.target.value)}
                className="w-full h-24 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm border-none outline-none resize-none"
                placeholder="添加注释..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddFrameDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveFavoriteFrame}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className={`px-4 py-2 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-pink-500' : 'bg-slate-700'} text-white text-sm`}>
            {toast.message}
          </div>
        </div>
      )}
    </main>
  );
}