import { Link, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getAuthorDetail, getThumbnailUrl, Author } from '../api';

export default function Profile() {
  const { username } = useParams();
  const [author, setAuthor] = useState<Author | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    
    setLoading(true);
    setError(null);
    
    getAuthorDetail(username)
      .then(setAuthor)
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </main>
    );
  }

  if (error || !author) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined text-6xl text-slate-300">person_off</span>
        <div className="text-slate-500">{error || '作者不存在'}</div>
        <Link to="/" className="text-primary hover:underline">返回首页</Link>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-[1280px] mx-auto w-full px-0 lg:px-4">
      {/* 作者头部 */}
      <div className="bg-white dark:bg-slate-900 p-4 lg:rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="bg-white dark:bg-slate-900 p-1 rounded-full shrink-0">
            <div 
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-24 md:size-32 border-4 border-white dark:border-slate-900 flex items-center justify-center bg-slate-200 dark:bg-slate-700" 
              style={author.avatar ? { backgroundImage: `url(${author.avatar})` } : {}}
            >
              {!author.avatar && (
                <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
              )}
            </div>
          </div>
          <div className="flex-1 pb-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{author.name}</h1>
                </div>
                {author.description && (
                  <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                    {author.description}
                  </p>
                )}
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-slate-900 dark:text-slate-100 font-medium">
                    {author.totalVideos || 0} <span className="text-slate-500 font-normal">个视频</span>
                  </span>
                  <span className="text-slate-900 dark:text-slate-100 font-medium">
                    {author.totalViews || '0'} <span className="text-slate-500 font-normal">次观看</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 视频列表 */}
      <div className="py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold">全部视频</h3>
            <span className="text-sm text-slate-500">{author.totalVideos || 0} 个作品</span>
          </div>
        </div>

        {author.videos && author.videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {author.videos.map((video) => (
              <Link to={`/video/${video.id}`} key={video.id} className="group flex flex-col gap-3 cursor-pointer">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700">
                  {video.thumbnail ? (
                    <div 
                      className="w-full h-full bg-center bg-no-repeat bg-cover group-hover:scale-110 transition-transform duration-300" 
                      style={{ backgroundImage: `url(${getThumbnailUrl(video.thumbnail)})` }}
                    ></div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-slate-400">video_file</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                    {video.duration}
                  </div>
                  <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-5xl">play_arrow</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">{video.title}</h4>
                  <div className="flex items-center gap-2 mt-2 text-slate-500 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">play_circle</span> {video.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">schedule</span> {video.time}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            该作者暂无视频
          </div>
        )}
      </div>
    </main>
  );
}
