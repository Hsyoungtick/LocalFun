import { Link, useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { Video, getAuthors, getCategories, renameVideo, moveVideo, openVideoFile, Author, Category } from '../api';
import VideoPreview from './VideoPreview';
import VideoContextMenu from './VideoContextMenu';
import EditDialog from './EditDialog';
import PageLayout from './PageLayout';

interface VideoListProps {
  videos: Video[];
  loading: boolean;
  title: string;
  titleIcon?: string;
  emptyIcon: string;
  emptyText: string;
  emptySubtext?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortByChange?: (value: string) => void;
  onSortOrderChange?: () => void;
  totalPages?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  extraButtons?: React.ReactNode;
  showEditMenu?: boolean;
  onVideosUpdate?: () => void;
  totalVideos?: number;
  showTitleEdit?: boolean;
  onTitleEdit?: () => void;
}

export default function VideoList({
  videos,
  loading,
  title,
  titleIcon,
  emptyIcon,
  emptyText,
  emptySubtext = '',
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
  totalPages,
  page,
  onPageChange,
  extraButtons,
  showEditMenu = false,
  onVideosUpdate,
  totalVideos,
  showTitleEdit,
  onTitleEdit
}: VideoListProps) {
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    video: Video;
  } | null>(null);
  const [editDialog, setEditDialog] = useState<{
    isOpen: boolean;
    type: 'title';
    video: Video;
  } | null>(null);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (showEditMenu) {
      getAuthors().then(data => {
        console.log('加载作者列表:', data);
        setAuthors(data);
      }).catch(err => {
        console.error('加载作者失败:', err);
      });
      getCategories().then(data => {
        console.log('加载分类列表:', data);
        setCategories(data);
      }).catch(err => {
        console.error('加载分类失败:', err);
      });
    }
  }, [showEditMenu]);

  const handleContextMenu = (e: React.MouseEvent, video: Video) => {
    if (!showEditMenu) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      video
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleEditTitle = () => {
    if (contextMenu) {
      setEditDialog({
        isOpen: true,
        type: 'title',
        video: contextMenu.video
      });
    }
  };

  const handleChangeAuthor = async (authorName: string) => {
    if (!contextMenu) return;
    console.log(`修改作者: videoId=${contextMenu.video.id}, authorName=${authorName}`);
    try {
      await renameVideo(contextMenu.video.id, { newAuthor: authorName });
      console.log('修改作者成功');
      onVideosUpdate?.();
    } catch (error) {
      console.error('修改作者失败:', error);
      alert('修改作者失败');
    }
  };

  const handleMoveToCategory = async (categoryName: string) => {
    if (!contextMenu) return;
    try {
      await moveVideo(contextMenu.video.id, categoryName);
      onVideosUpdate?.();
    } catch (error) {
      console.error('移动失败:', error);
      alert('移动失败');
    }
  };

  const handleOpenFile = async () => {
    if (!contextMenu) return;
    try {
      await openVideoFile(contextMenu.video.id);
    } catch (error) {
      console.error('打开文件失败:', error);
      alert('打开文件失败');
    }
  };

  const handleSaveEdit = async (newValue: string) => {
    if (!editDialog) return;
    
    try {
      if (editDialog.type === 'title') {
        await renameVideo(editDialog.video.id, { newTitle: newValue });
      }
      onVideosUpdate?.();
    } catch (error) {
      console.error('修改失败:', error);
      alert('修改失败');
    } finally {
      setEditDialog(null);
    }
  };

  const allExtraButtons = (
    <>
      {sortBy !== undefined && onSortByChange && (
        <>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="h-9 px-3 rounded-lg bg-white dark:bg-slate-800 text-sm border border-slate-200 dark:border-slate-700 outline-none"
          >
            <option value="created_at">修改时间</option>
            <option value="random">随机</option>
            <option value="last_played">上次观看</option>
            <option value="views">播放量</option>
            <option value="duration">时长</option>
            <option value="size">大小</option>
            <option value="author">作者</option>
            <option value="category">类别</option>
          </select>
          {sortOrder !== undefined && onSortOrderChange && (
            <>
              <button
                onClick={onSortOrderChange}
                className="h-9 px-3 rounded-lg bg-white dark:bg-slate-800 text-sm border border-slate-200 dark:border-slate-700 flex items-center"
              >
                <span className="material-symbols-outlined text-sm">
                  {sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                </span>
              </button>
              {totalVideos !== undefined && (
                <span className="text-sm text-slate-500 ml-2">共 {totalVideos} 个视频</span>
              )}
            </>
          )}
        </>
      )}
      {extraButtons}
    </>
  );

  return (
    <PageLayout
      title={title}
      titleIcon={titleIcon}
      loading={loading}
      emptyIcon={emptyIcon}
      emptyText={emptyText}
      emptySubtext={emptySubtext}
      extraButtons={allExtraButtons}
      showTitleEdit={showTitleEdit}
      onTitleEdit={onTitleEdit}
    >
      {videos.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {videos.map((video) => (
              <div
                onClick={() => navigate(`/video/${video.id}`)}
                onContextMenu={(e) => handleContextMenu(e, video)}
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
                        <span>#{video.category}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {totalPages !== undefined && page !== undefined && onPageChange && totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 py-6">
              <button
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-primary/10 text-primary disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <span className="text-sm text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-primary/10 text-primary disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          )}
        </>
      )}
      
      {contextMenu && (
        <VideoContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          videoId={contextMenu.video.id}
          videoTitle={contextMenu.video.title}
          videoAuthor={contextMenu.video.author}
          videoCategory={contextMenu.video.category}
          authors={authors}
          categories={categories}
          onClose={handleCloseContextMenu}
          onEditTitle={handleEditTitle}
          onChangeAuthor={handleChangeAuthor}
          onMoveToCategory={handleMoveToCategory}
          onOpenFile={handleOpenFile}
        />
      )}
      
      {editDialog && (
        <EditDialog
          isOpen={editDialog.isOpen}
          onClose={() => setEditDialog(null)}
          onSave={handleSaveEdit}
          initialValue={editDialog.video.title}
          label="标题"
        />
      )}
    </PageLayout>
  );
}
