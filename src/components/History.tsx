import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getHistoryVideos, Video, clearHistory } from '../api';
import VideoPreview from './VideoPreview';
import PageLayout from './PageLayout';

export default function History() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('last_played');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  const loadVideos = async () => {
    setLoading(true);
    try {
      const data = await getHistoryVideos({
        sort: sortBy,
        order: sortOrder,
        page,
        limit: 20
      });
      setVideos(data.videos);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
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

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const videoDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (videoDate.getTime() === today.getTime()) {
      return '今天';
    } else if (videoDate.getTime() === yesterday.getTime()) {
      return '昨天';
    } else {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${month}-${day}`;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const groupedVideos = useMemo(() => {
    const groups: { [key: string]: Video[] } = {};
    videos.forEach(video => {
      if (!video.lastPlayedAt) return;
      const dateKey = new Date(video.lastPlayedAt).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(video);
    });
    return groups;
  }, [videos]);

  const extraButtons = (
    <button
      onClick={handleClearHistory}
      className="h-9 px-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-1 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
    >
      <span className="material-symbols-outlined text-sm">delete</span>
      清空历史
    </button>
  );

  const allExtraButtons = (
    <>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        className="h-9 px-3 rounded-lg bg-white dark:bg-slate-800 text-sm border border-slate-200 dark:border-slate-700 outline-none"
      >
        <option value="last_played">上次观看</option>
        <option value="created_at">修改时间</option>
        <option value="random">随机</option>
        <option value="views">播放量</option>
        <option value="duration">时长</option>
        <option value="size">大小</option>
        <option value="author">作者</option>
        <option value="category">类别</option>
      </select>
      <button
        onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
        className="h-9 px-3 rounded-lg bg-white dark:bg-slate-800 text-sm border border-slate-200 dark:border-slate-700 flex items-center"
      >
        <span className="material-symbols-outlined text-sm">
          {sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
        </span>
      </button>
      {extraButtons}
    </>
  );

  return (
    <PageLayout
      title="观看历史"
      titleIcon="history"
      loading={loading}
      emptyIcon="history"
      emptyText="暂无观看历史"
      emptySubtext="观看过的视频会显示在这里"
      extraButtons={allExtraButtons}
    >
      {Object.keys(groupedVideos).length > 0 && (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
          
          {Object.keys(groupedVideos).map((dateKey) => {
            const dateVideos = groupedVideos[dateKey];
            const firstVideo = dateVideos[0];
            const dateLabel = firstVideo.lastPlayedAt ? formatDateLabel(firstVideo.lastPlayedAt) : '';
            
            return (
              <div key={dateKey} className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-14 flex-shrink-0 flex justify-center">
                    <div className="w-3 h-3 rounded-full bg-primary border-2 border-white dark:border-slate-900 z-10" />
                  </div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {dateLabel}
                  </div>
                </div>
                
                {dateVideos.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-start gap-4 mb-6 cursor-pointer group"
                    onClick={() => navigate(`/video/${video.id}`)}
                  >
                    <div className="w-14 flex-shrink-0 flex justify-center pt-1">
                      <div className="text-xs text-slate-400">
                        {video.lastPlayedAt ? formatTime(video.lastPlayedAt) : ''}
                      </div>
                    </div>
                    
                    <div className="flex gap-4 flex-1 min-w-0">
                      <div className="w-48 flex-shrink-0 rounded-xl overflow-hidden aspect-video bg-slate-200 dark:bg-slate-700">
                        <VideoPreview
                          videoId={video.id}
                          duration={video.durationSeconds}
                          title={video.title}
                          views={video.views}
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0 pt-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-primary transition-colors">
                          {video.title}
                        </h3>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 flex-wrap">
                          {video.author && (
                            <>
                              <Link
                                onClick={(e) => e.stopPropagation()}
                                to={`/authors/${video.author}`}
                                className="hover:text-primary transition-colors"
                              >
                                {video.author}
                              </Link>
                              <span>·</span>
                            </>
                          )}
                          <span>{video.time}</span>
                          {video.category && (
                            <>
                              <span>·</span>
                              <Link
                                onClick={(e) => e.stopPropagation()}
                                to={`/categories/${video.category}`}
                                className="hover:text-primary transition-colors cursor-pointer"
                              >
                                #{video.category}
                              </Link>
                            </>
                          )}
                        </div>
                        {video.playProgress !== undefined && video.playProgress > 0 && (
                          <div className="mt-2">
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${Math.min(video.playProgress, 100)}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              已观看 {Math.round(Math.min(video.playProgress, 100))}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
