import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { getVideoDetail, getVideoStreamUrl, getThumbnailUrl, VideoDetail as VideoDetailType } from '../api';
import CustomVideoPlayer from './CustomVideoPlayer';

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    getVideoDetail(parseInt(id))
      .then(setVideo)
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const currentIndex = video?.relatedVideos.findIndex(v => v.id === video.id) ?? -1;
  
  const prevVideo = video?.relatedVideos.length 
    ? video.relatedVideos[currentIndex > 0 ? currentIndex - 1 : video.relatedVideos.length - 1]
    : null;
  
  const nextVideo = video?.relatedVideos.length 
    ? video.relatedVideos[(currentIndex + 1) % video.relatedVideos.length]
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
  const authorAvatar = video.author?.avatar;
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
              <span className="material-symbols-outlined text-base">schedule</span> {video.duration}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">person</span> {authorName}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">movie</span> #{video.category}
            </span>
          </div>
        </div>

        {/* 右侧：作者信息（无背景，高度与左侧相等） */}
        <div className="w-full md:w-1/4 flex items-center gap-3">
          <Link 
            to={video.author ? `/author/${video.author.name}` : '#'} 
            className="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-primary/20 flex items-center justify-center overflow-hidden shrink-0"
          >
            {authorAvatar ? (
              <img src={authorAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-slate-400 text-2xl">person</span>
            )}
          </Link>
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

      {/* 第二行：播放器（左）+ 字幕+相关视频（右，顶端对齐） */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* 左侧：播放器 */}
        <div className="w-full md:w-3/4">
          <div className="relative group rounded-xl overflow-hidden bg-black aspect-video shadow-2xl">
            <CustomVideoPlayer
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
        </div>

        {/* 右侧：字幕 + 相关视频（顶端对齐） */}
        <div className="w-full md:w-1/4 flex flex-col gap-4">
          {/* 字幕 */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">subtitles</span> 字幕
            </h3>
            <div className="text-sm text-slate-400 text-center py-4">
              暂无字幕
            </div>
          </div>

          {/* 相关视频 */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">auto_awesome</span> 相关视频
            </h3>
            <div className="space-y-4">
              {video.relatedVideos.map((relatedVideo) => (
                <Link to={`/video/${relatedVideo.id}`} key={relatedVideo.id} className="flex gap-3 group cursor-pointer">
                  <div className="relative w-40 h-24 shrink-0 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700">
                    <img 
                      alt={relatedVideo.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                      src={getThumbnailUrl(relatedVideo.id)} 
                    />
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">
                      {relatedVideo.duration}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {relatedVideo.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">{relatedVideo.views}次观看</p>
                  </div>
                </Link>
              ))}
            </div>
            
            {video.relatedVideos.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-8">
                暂无相关视频
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 第三行：描述 */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        <div className="w-full md:w-3/4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm">
            {video.description && (
              <div className="mb-4">
                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{video.description}</p>
              </div>
            )}
            <div className="text-xs text-slate-400">
              <span>文件大小: {video.fileSize}</span>
              {video.width && video.height && (
                <span className="ml-4">分辨率: {video.width}x{video.height}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
