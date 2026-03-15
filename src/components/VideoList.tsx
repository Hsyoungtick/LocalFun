import { Link, useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { Video } from '../api';
import VideoPreview from './VideoPreview';
import ContextMenu from './ContextMenu';
import EditDialog from './EditDialog';
import { renameVideo } from '../api';
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
  onVideosUpdate
}: VideoListProps) {
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'title' | 'author';
    video: Video;
  } | null>(null);
  const [editDialog, setEditDialog] = useState<{
    isOpen: boolean;
    type: 'title' | 'author';
    video: Video;
  } | null>(null);

  const handleTitleContextMenu = (e: React.MouseEvent, video: Video) => {
    if (!showEditMenu) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'title',
      video
    });
  };

  const handleAuthorContextMenu = (e: React.MouseEvent, video: Video) => {
    if (!showEditMenu) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'author',
      video
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleEdit = () => {
    if (contextMenu) {
      setEditDialog({
        isOpen: true,
        type: contextMenu.type,
        video: contextMenu.video
      });
    }
  };

  const handleSaveEdit = async (newValue: string) => {
    if (!editDialog) return;
    
    try {
      if (editDialog.type === 'title') {
        await renameVideo(editDialog.video.id, { newTitle: newValue });
      } else {
        await renameVideo(editDialog.video.id, { newAuthor: newValue });
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
            className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm border-none outline-none"
          >
            <option value="random">随机</option>
            <option value="last_played">上次观看</option>
            <option value="created_at">修改时间</option>
            <option value="views">播放量</option>
            <option value="duration">时长</option>
            <option value="size">大小</option>
            <option value="author">作者</option>
            <option value="category">类别</option>
          </select>
          {sortOrder !== undefined && onSortOrderChange && (
            <button
              onClick={onSortOrderChange}
              className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm flex items-center"
            >
              <span className="material-symbols-outlined text-sm">
                {sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'}
              </span>
            </button>
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
    >
      {videos.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
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
                  <h3 
                    className={`text-slate-900 dark:text-slate-100 text-sm font-bold leading-tight line-clamp-2 hover:text-primary transition-colors ${showEditMenu ? 'cursor-context-menu' : ''}`}
                    onContextMenu={(e) => handleTitleContextMenu(e, video)}
                  >
                    {video.title}
                  </h3>
                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-1 flex items-center gap-1 flex-wrap">
                    <Link
                      onClick={(e) => e.stopPropagation()}
                      to={`/author/${video.author}`}
                      className={`hover:text-primary transition-colors ${showEditMenu ? 'cursor-context-menu' : ''}`}
                      onContextMenu={(e) => handleAuthorContextMenu(e, video)}
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
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onEdit={handleEdit}
          label={contextMenu.type === 'title' ? '标题' : '作者名'}
        />
      )}
      
      {editDialog && (
        <EditDialog
          isOpen={editDialog.isOpen}
          onClose={() => setEditDialog(null)}
          onSave={handleSaveEdit}
          initialValue={editDialog.type === 'title' ? editDialog.video.title : editDialog.video.author}
          label={editDialog.type === 'title' ? '标题' : '作者名'}
        />
      )}
    </PageLayout>
  );
}