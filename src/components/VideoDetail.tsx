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
import VideoPreview from './VideoPreview';

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
  const [activeTab, setActiveTab] = useState<'subtitles' | 'frames'>('subtitles');
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showAddFrameDialog, setShowAddFrameDialog] = useState(false);
  const [tempTimeSeconds, setTempTimeSeconds] = useState(0);
  const [frameNote, setFrameNote] = useState('');
  const [editingFrameId, setEditingFrameId] = useState<number | null>(null);
  const videoPlayerRef = useRef<CustomVideoPlayerRef>(null);

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

  const handleAddFavoriteFrame = useCallback((timeSeconds: number) => {
    if (!id || !video) return;
    
    addFavoriteFrame(parseInt(id), timeSeconds)
      .then(() => getVideoDetail(parseInt(id)))
      .then(setVideo)
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
      })
      .catch(console.error);
  }, [id, video]);

  const handleToggleFavorite = useCallback(() => {
    if (!id || !video) return;
    
    const newFavorite = !video.isFavorite;
    toggleFavorite(parseInt(id), newFavorite)
      .then(() => {
        setVideo(prev => prev ? { ...prev, isFavorite: newFavorite } : null);
      })
      .catch(console.error);
  }, [id, video]);

  const handleResetVideoData = useCallback(() => {
    if (!id) return;
    
    resetVideoData(parseInt(id))
      .then(() => getVideoDetail(parseInt(id)))
      .then(setVideo)
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    const updatePlayerHeight = () => {
      if (playerContainerRef.current) {
        if (window.innerWidth >= 768) {
          playerContainerRef.current.style.height = 'calc((75vw - 1rem) * 9 / 16)';
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
      navigate(`/video/${prevVideo.id}`);
    }
  }, [prevVideo, navigate]);

  const handleNext = useCallback(() => {
    if (nextVideo) {
      navigate(`/video/${nextVideo.id}`);
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
    <main className="flex-1 flex flex-col gap-4 px-4 md:px-20 py-6 max-w-[1600px] mx-auto w-full">
      {/* 第一行：视频信息（左）+ 作者信息（右） */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* 左侧：视频信息 */}
        <div className="w-full md:w-3/4 flex flex-col gap-1">
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
        <div className="w-full md:w-1/4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm h-full flex items-center gap-3">
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
        <div className="w-full md:w-3/4 flex flex-col justify-between">
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
              onPrev={handlePrev}
              onNext={handleNext}
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
                className="flex items-center justify-center w-[84px] h-[60px] rounded-lg transition-all group"
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
                className="flex items-center justify-center w-[84px] h-[60px] rounded-lg transition-all group"
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
                className={`flex items-center justify-center w-[84px] h-[60px] rounded-lg transition-all ${
                  video.isFavorite 
                    ? '' 
                    : 'group'
                }`}
              >
                <span 
                  className={`material-symbols-outlined transition-colors ${video.isFavorite ? 'text-yellow-500' : 'text-slate-600 dark:text-slate-400 group-hover:text-pink-500'}`}
                  style={{ fontVariationSettings: "'FILL' 1", fontSize: '1.875rem' }}
                >
                  star
                </span>
              </button>

              <button
                onClick={() => setShowMoveDialog(true)}
                className="flex items-center justify-center w-[84px] h-[60px] rounded-lg transition-all group"
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
              className="flex items-center justify-center w-[84px] h-[60px] rounded-lg transition-all group"
            >
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 transition-colors group-hover:text-red-500" style={{ fontVariationSettings: "'FILL' 1", fontSize: '1.875rem' }}>restart_alt</span>
            </button>
          </div>
        </div>

        {/* 右侧：标签页 */}
        <div className="w-full md:w-1/4 flex flex-col">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm flex flex-col overflow-hidden max-h-[calc((100vw-1rem)*9/16)] md:max-h-[calc((75vw-1rem)*9/16)]">
            {/* 标签导航 */}
            <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex-shrink-0">
              <button
                onClick={() => setActiveTab('frames')}
                className={`flex-1 px-2 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
                  activeTab === 'frames'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                喜欢的帧
              </button>
              <button
                onClick={() => setActiveTab('subtitles')}
                className={`flex-1 px-2 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
                  activeTab === 'subtitles'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                字幕
              </button>
            </div>

            {/* 标签内容 */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {activeTab === 'subtitles' ? (
                <div className="text-sm text-slate-400 text-center py-4 flex items-center justify-center h-full">
                  暂无字幕
                </div>
              ) : (
                <div className="space-y-3">
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
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
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

      {/* 第三行：相关视频 */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        <div className="w-full">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">auto_awesome</span> 相关视频
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-8 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs border-none outline-none"
                >
                  <option value="random">随机</option>
                  <option value="created_at">修改时间</option>
                  <option value="views">播放量</option>
                  <option value="duration">时长</option>
                  <option value="size">大小</option>
                  <option value="author">作者</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="h-8 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">
                    {sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                  </span>
                  {sortOrder === 'desc' ? '降序' : '升序'}
                </button>
                <span className="text-xs text-slate-500">共 {sameCategoryVideos.length} 个视频</span>
              </div>
            </div>
            
            {sameCategoryVideos.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-8">
                暂无相关视频
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {sameCategoryVideos.map((relatedVideo) => (
                  <div
                    onClick={() => navigate(`/video/${relatedVideo.id}`)}
                    key={relatedVideo.id}
                    className="group flex flex-col gap-2 cursor-pointer"
                  >
                    <div className="relative overflow-hidden rounded-xl aspect-video bg-slate-200 dark:bg-slate-700">
                      <VideoPreview
                        videoId={relatedVideo.id}
                        duration={relatedVideo.durationSeconds}
                        title={relatedVideo.title}
                        views={relatedVideo.views}
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h4 className="text-slate-900 dark:text-slate-100 text-sm font-bold leading-tight line-clamp-2 hover:text-primary transition-colors">
                        {relatedVideo.title}
                      </h4>
                      <div className="text-slate-500 dark:text-slate-400 text-xs mt-1 flex items-center gap-1 flex-wrap">
                        <Link
                          onClick={(e) => e.stopPropagation()}
                          to={`/author/${relatedVideo.author}`}
                          className="hover:text-primary transition-colors"
                        >
                          {relatedVideo.author}
                        </Link>
                        <span>·</span>
                        <span>{relatedVideo.time}</span>
                        <span>·</span>
                        <span>#{relatedVideo.category}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}