import { useState, useEffect } from 'react';
import { getVideos, getFavoriteVideos, getHistoryVideos, Video } from '../api';
import VideoList from './VideoList';
import { useAppContext } from '../context/AppContext';

export default function Home() {
  const { searchQuery, activeFilter } = useAppContext();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeFilter]);

  const loadVideos = async () => {
    setLoading(true);
    try {
      let data;
      if (activeFilter === 'favorites') {
        data = await getFavoriteVideos({
          search: searchQuery || undefined,
          sort: sortBy,
          order: sortOrder,
          page,
          limit: 20
        });
      } else if (activeFilter === 'history') {
        data = await getHistoryVideos({
          search: searchQuery || undefined,
          sort: sortBy,
          order: sortOrder,
          page,
          limit: 20
        });
      } else {
        data = await getVideos({
          search: searchQuery || undefined,
          sort: sortBy,
          order: sortOrder,
          page,
          limit: 20
        });
      }
      setVideos(data.videos);
      setTotalPages(data.totalPages);
      setTotalVideos(data.total);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, [searchQuery, sortBy, sortOrder, page, activeFilter]);

  const getPageTitle = () => {
    if (activeFilter === 'favorites') return '我的收藏';
    if (activeFilter === 'history') return '观看历史';
    return '全部视频';
  };

  const getEmptyIcon = () => {
    if (activeFilter === 'favorites') return 'bookmark';
    if (activeFilter === 'history') return 'history';
    return 'video_library';
  };

  const getEmptyText = () => {
    if (activeFilter === 'favorites') return '暂无收藏';
    if (activeFilter === 'history') return '暂无观看历史';
    return '暂无视频';
  };

  const getEmptySubtext = () => {
    if (activeFilter === 'favorites') return '快去收藏喜欢的视频吧';
    if (activeFilter === 'history') return '观看过的视频会显示在这里';
    return '请先添加视频路径并扫描';
  };

  return (
    <VideoList
      videos={videos}
      loading={loading}
      title={getPageTitle()}
      titleIcon={getEmptyIcon()}
      emptyIcon={getEmptyIcon()}
      emptyText={getEmptyText()}
      emptySubtext={getEmptySubtext()}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSortByChange={setSortBy}
      onSortOrderChange={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
      totalPages={totalPages}
      page={page}
      onPageChange={setPage}
      showEditMenu={true}
      onVideosUpdate={loadVideos}
      totalVideos={activeFilter === 'all' ? totalVideos : videos.length}
    />
  );
}
