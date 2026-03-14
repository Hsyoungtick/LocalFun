import { Link, useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { getVideoDetail, getVideoStreamUrl, getThumbnailUrl, VideoDetail as VideoDetailType } from '../api';

export default function VideoDetail() {
  const { id } = useParams();
  const [video, setVideo] = useState<VideoDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  return (
    <main className="flex-1 flex flex-col lg:flex-row gap-6 px-4 lg:px-20 py-6 max-w-[1600px] mx-auto w-full">
      <div className="flex-1 flex flex-col gap-4">
        {/* 视频播放器 */}
        <div className="relative group rounded-xl overflow-hidden bg-black aspect-video shadow-2xl">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            controls
            autoPlay
            poster={video.thumbnail ? getThumbnailUrl(video.thumbnail) : undefined}
          >
            <source src={getVideoStreamUrl(video.id)} type="video/mp4" />
            您的浏览器不支持视频播放
          </video>
        </div>

        {/* 视频信息 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">{video.title}</h1>
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm mb-4">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">visibility</span> {video.views}次观看
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">calendar_today</span> {video.time}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">movie</span> #{video.category}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">schedule</span> {video.duration}
            </span>
          </div>
          
          {/* 作者信息 */}
          {video.author && (
            <div className="flex items-center justify-between py-4 border-y border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Link 
                  to={`/author/${video.author.name}`} 
                  className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-primary/20 flex items-center justify-center overflow-hidden"
                >
                  {video.author.avatar ? (
                    <img src={video.author.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-slate-400">person</span>
                  )}
                </Link>
                <div>
                  <Link 
                    to={`/author/${video.author.name}`} 
                    className="font-bold text-slate-900 dark:text-slate-100 hover:text-primary transition-colors"
                  >
                    {video.author.name}
                  </Link>
                  {video.author.description && (
                    <p className="text-xs text-slate-500 line-clamp-1">{video.author.description}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* 视频描述 */}
          {video.description && (
            <div className="mt-4">
              <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{video.description}</p>
            </div>
          )}

          {/* 文件信息 */}
          <div className="mt-4 text-xs text-slate-400">
            <span>文件大小: {video.fileSize}</span>
            {video.width && video.height && (
              <span className="ml-4">分辨率: {video.width}x{video.height}</span>
            )}
          </div>
        </div>
      </div>

      {/* 侧边栏 - 相关视频 */}
      <aside className="w-full lg:w-[400px] flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">auto_awesome</span> 相关视频
          </h3>
          <div className="space-y-4">
            {video.relatedVideos.map((relatedVideo) => (
              <Link to={`/video/${relatedVideo.id}`} key={relatedVideo.id} className="flex gap-3 group cursor-pointer">
                <div className="relative w-40 h-24 shrink-0 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700">
                  {relatedVideo.thumbnail ? (
                    <img 
                      alt={relatedVideo.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                      src={getThumbnailUrl(relatedVideo.thumbnail)} 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-400">video_file</span>
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">
                    {relatedVideo.duration}
                  </span>
                </div>
                <div className="flex-1">
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
      </aside>
    </main>
  );
}
