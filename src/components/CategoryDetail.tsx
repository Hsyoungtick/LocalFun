import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getVideos, getCategories, renameCategory, Video, Category } from '../api';
import VideoList from './VideoList';
import EditDialog from './EditDialog';

export default function CategoryDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(name || '');
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [decodedName]);

  const loadVideos = async () => {
    if (!decodedName) return;
    
    setLoading(true);
    try {
      const data = await getVideos({
        category: decodedName,
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

  const handleCategoryEdit = () => {
    setShowEditDialog(true);
  };

  const handleSaveCategoryName = async (newName: string) => {
    if (!decodedName) return;
    const category = categories.find(c => c.name === decodedName);
    if (!category) return;
    
    try {
      await renameCategory(category.id, newName);
      setShowEditDialog(false);
      navigate(`/categories/${encodeURIComponent(newName)}`);
      await getCategories().then(setCategories);
    } catch (error) {
      console.error('修改分类名失败:', error);
    }
  };

  return (
    <>
      <VideoList
        videos={videos}
        loading={loading}
        title={decodedName}
        titleIcon="folder"
        emptyIcon="folder"
        emptyText="该分类暂无视频"
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
        onTitleEdit={handleCategoryEdit}
      />
      
      {showEditDialog && (
        <EditDialog
          isOpen={true}
          onClose={() => setShowEditDialog(false)}
          onSave={handleSaveCategoryName}
          initialValue={decodedName}
          label="分类名"
        />
      )}
    </>
  );
}
