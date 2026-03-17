import { useState, useEffect } from 'react';
import { getHistoryVideos, Video, clearHistory } from '../api';
import VideoList from './VideoList';

export default function History() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('last_played');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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

  const extraButtons = (
    <button
      onClick={handleClearHistory}
      className="h-9 px-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-1 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
    >
      <span className="material-symbols-outlined text-sm">delete</span>
      清空历史
    </button>
  );

  return (
    <VideoList
      videos={videos}
      loading={loading}
      title="观看历史"
      titleIcon="history"
      emptyIcon="history"
      emptyText="暂无观看历史"
      emptySubtext="观看过的视频会显示在这里"
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSortByChange={setSortBy}
      onSortOrderChange={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
      totalPages={totalPages}
      page={page}
      onPageChange={setPage}
      extraButtons={extraButtons}
      groupByDate={true}
      dateField="lastPlayedAt"
    />
  );
}
