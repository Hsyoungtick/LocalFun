import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getVideos, renameAuthor, getAuthors, Video, Author } from '../api';
import VideoList from './VideoList';
import EditDialog from './EditDialog';

export default function AuthorDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(name || '');
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    getAuthors().then(setAuthors).catch(console.error);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [decodedName]);

  const loadVideos = async () => {
    if (!decodedName) return;
    
    setLoading(true);
    try {
      const data = await getVideos({
        author: decodedName,
        sort: sortBy,
        order: sortOrder,
        page,
        limit: 20
      });
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
  }, [decodedName, sortBy, sortOrder, page]);

  const handleAuthorEdit = () => {
    setShowEditDialog(true);
  };

  const handleSaveAuthorName = async (newName: string) => {
    if (!decodedName) return;
    const author = authors.find(a => a.name === decodedName);
    if (!author) return;
    
    try {
      await renameAuthor(author.id, newName);
      setShowEditDialog(false);
      navigate(`/authors/${encodeURIComponent(newName)}`);
      await getAuthors().then(setAuthors);
    } catch (error) {
      console.error('修改作者名失败:', error);
    }
  };

  return (
    <>
      <VideoList
        videos={videos}
        loading={loading}
        title={decodedName}
        titleIcon="person"
        emptyIcon="person"
        emptyText="该作者暂无视频"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortByChange={setSortBy}
        onSortOrderChange={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
        totalPages={totalPages}
        page={page}
        onPageChange={setPage}
        showEditMenu={true}
        onVideosUpdate={loadVideos}
        totalVideos={totalVideos}
        showTitleEdit={true}
        onTitleEdit={handleAuthorEdit}
      />
      
      {showEditDialog && (
        <EditDialog
          isOpen={true}
          onClose={() => setShowEditDialog(false)}
          onSave={handleSaveAuthorName}
          initialValue={decodedName}
          label="作者名"
        />
      )}
    </>
  );
}
