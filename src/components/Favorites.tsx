import { useState, useEffect } from 'react';
import { getFavoriteVideos, Video } from '../api';
import VideoList from './VideoList';

export default function Favorites() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('random');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const data = await getFavoriteVideos({
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

  return (
    <VideoList
      videos={videos}
      loading={loading}
      title="我的收藏"
      titleIcon="bookmark"
      emptyIcon="bookmark"
      emptyText="暂无收藏"
      emptySubtext="快去收藏喜欢的视频吧"
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSortByChange={setSortBy}
      onSortOrderChange={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
      totalPages={totalPages}
      page={page}
      onPageChange={setPage}
      showEditMenu={false}
      onVideosUpdate={loadVideos}
    />
  );
}
