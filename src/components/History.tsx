import { Link, useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { getHistoryVideos, Video, clearHistory } from '../api';
import VideoPreview from './VideoPreview';

export default function History() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('random');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadVideos = () => {
    setLoading(true);
    getHistoryVideos({
      sort: sortBy,
      order: sortOrder,
      page,
      limit: 20
    })
      .then(data => {
        setVideos(data.videos);
        setTotalPages(data.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVideos();
  }, [sortBy, sortOrder, page]);

  const handleClearHistory = async () => {
    if (confirm('确定要清空所有观看历史吗？')) {
      try {
        await clearHistory();
        loadVideos();
      } catch (error) {
        console.error('清空历史记录失败:', error);
        alert('清空历史记录失败');
      }
    }
  };

  return (
    <main className="flex-1 flex flex-col w-full max-w-400 mx-auto">
      <div className="flex items-center justify-between px-4 mb-4 pt-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">观看历史</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearHistory}
            className="h-9 px-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-1 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            清空历史
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm border-none outline-none"
          >
            <option value="random">随机</option>
            <option value="created_at">修改时间</option>
            <option value="views">播放量</option>
            <option value="duration">时长</option>
            <option value="size">大小</option>
            <option value="author">作者</option>
            <option value="category">类别</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">
              {sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
            </span>
            {sortOrder === 'desc' ? '降序' : '升序'}
          </button>
        </div>
        <span className="text-sm text-slate-500">共 {videos.length} 个视频</span>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-500">加载中...</div>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <span className="material-symbols-outlined text-6xl text-slate-300">history</span>
          <div className="text-slate-500">暂无观看历史</div>
          <div className="text-sm text-slate-400">观看过的视频会显示在这里</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 p-4">
            {videos.map((video) => (
              <div
                onClick={() => navigate(`/video/${video.id}`)}
                key={video.id}
                className="group flex flex-col gap-3 cursor-pointer"
              >
                <div className="relative overflow-hidden rounded-xl aspect-video bg-slate-200 dark:bg-slate-700">
                  <VideoPreview
                    videoId={video.id}
                    duration={video.durationSeconds}
                    title={video.title}
                    views={video.views}
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-slate-900 dark:text-slate-100 text-sm font-bold leading-tight line-clamp-2 hover:text-primary transition-colors">
                    {video.title}
                  </h3>
                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-1 flex items-center gap-1 flex-wrap">
                    <Link
                      onClick={(e) => e.stopPropagation()}
                      to={`/author/${video.author}`}
                      className="hover:text-primary transition-colors"
                    >
                      {video.author}
                    </Link>
                    <span>·</span>
                    <span>{video.time}</span>
                    <span>·</span>
                    <span>#{video.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 py-6">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-primary/10 text-primary disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <span className="text-sm text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-primary/10 text-primary disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
