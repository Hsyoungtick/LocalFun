import { Link, useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
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
    video?: Video;
    selectedVideos?: Video[];
  } | null>(null);
  const [editDialog, setEditDialog] = useState<{
    isOpen: boolean;
    type: 'title';
    video?: Video;
    selectedVideos?: Video[];
  } | null>(null);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // 框选相关状态
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<number>>(new Set());
  const [selectingVideoIds, setSelectingVideoIds] = useState<Set<number>>(new Set());
  const mainRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isSelectingRef = useRef(false);
  const lastClickedIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (showEditMenu) {
      getAuthors().then(data => {
        setAuthors(data);
      }).catch(err => {
        console.error('加载作者失败:', err);
      });
      getCategories().then(data => {
        setCategories(data);
      }).catch(err => {
        console.error('加载分类失败:', err);
      });
    }
  }, [showEditMenu]);

  // 计算框选区域内的视频
  const getVideosInSelectionBox = useCallback((box: SelectionBox) => {
    const left = Math.min(box.startX, box.endX);
    const right = Math.max(box.startX, box.endX);
    const top = Math.min(box.startY, box.endY);
    const bottom = Math.max(box.startY, box.endY);
    
    const ids = new Set<number>();
    videoRefs.current.forEach((el, videoId) => {
      const rect = el.getBoundingClientRect();
      if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) {
        ids.add(videoId);
      }
    });
    return ids;
  }, []);

  // 开始框选
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!showEditMenu) return;
    
    // 检查是否点击在视频卡片或交互元素上
    const target = e.target as HTMLElement;
    if (target.closest('[data-video-card]')) return;
    if (target.closest('button')) return;
    if (target.closest('input')) return;
    if (target.closest('select')) return;
    if (target.closest('a')) return;
    
    e.preventDefault();
    isSelectingRef.current = true;
    const newBox = {
      startX: e.clientX,
      startY: e.clientY,
      endX: e.clientX,
      endY: e.clientY
    };
    setSelectionBox(newBox);
    setSelectingVideoIds(getVideosInSelectionBox(newBox));
  }, [showEditMenu, getVideosInSelectionBox]);

  // 框选中
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelectingRef.current) return;
    
    setSelectionBox(prev => {
      if (!prev) return null;
      const newBox = { ...prev, endX: e.clientX, endY: e.clientY };
      setSelectingVideoIds(getVideosInSelectionBox(newBox));
      return newBox;
    });
  }, [getVideosInSelectionBox]);

  // 结束框选
  const handleMouseUp = useCallback(() => {
    if (!isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }
    
    isSelectingRef.current = false;
    
    // 如果没有框选任何视频，取消之前选中的视频
    if (selectingVideoIds.size === 0) {
      setSelectedVideoIds(new Set());
    } else {
      setSelectedVideoIds(prev => new Set([...prev, ...selectingVideoIds]));
    }
    setSelectingVideoIds(new Set());
    setSelectionBox(null);
  }, [selectingVideoIds]);

  // 注册视频卡片ref
  const registerVideoRef = useCallback((videoId: number, el: HTMLDivElement | null) => {
    if (el) {
      videoRefs.current.set(videoId, el);
    } else {
      videoRefs.current.delete(videoId);
    }
  }, []);

  // 视频卡片点击处理（支持 Ctrl 和 Shift）
  const handleVideoClick = useCallback((e: React.MouseEvent, video: Video, index: number) => {
    if (!showEditMenu) {
      navigate(`/video/${video.id}`);
      return;
    }

    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      // Ctrl + 单击：切换选中状态
      setSelectedVideoIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(video.id)) {
          newSet.delete(video.id);
        } else {
          newSet.add(video.id);
        }
        return newSet;
      });
      lastClickedIndexRef.current = index;
    } else if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      // Shift + 单击：范围选择
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      const idsToSelect = videos.slice(start, end + 1).map(v => v.id);
      setSelectedVideoIds(prev => new Set([...prev, ...idsToSelect]));
    } else {
      // 普通单击
      if (selectedVideoIds.size === 0) {
        navigate(`/video/${video.id}`);
      } else if (selectedVideoIds.size === 1 && selectedVideoIds.has(video.id)) {
        // 如果只选中了当前视频，取消选中
        setSelectedVideoIds(new Set());
      } else {
        // 选中当前视频
        setSelectedVideoIds(new Set([video.id]));
        lastClickedIndexRef.current = index;
      }
    }
  }, [showEditMenu, navigate, selectedVideoIds, videos]);

  const handleContextMenu = (e: React.MouseEvent, video: Video) => {
    if (!showEditMenu) return;
    e.preventDefault();
    e.stopPropagation();
    
    // 如果右键的视频已经被选中，则批量操作
    if (selectedVideoIds.has(video.id)) {
      const selectedVideos = videos.filter(v => selectedVideoIds.has(v.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        selectedVideos
      });
    } else {
      // 单个视频操作
      setSelectedVideoIds(new Set());
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        video
      });
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleEditTitle = () => {
    if (contextMenu?.selectedVideos && contextMenu.selectedVideos.length > 1) {
      setEditDialog({
        isOpen: true,
        type: 'title',
        selectedVideos: contextMenu.selectedVideos
      });
    } else if (contextMenu?.video) {
      setEditDialog({
        isOpen: true,
        type: 'title',
        video: contextMenu.video
      });
    }
  };

  const handleChangeAuthor = async (authorName: string) => {
    if (!contextMenu) return;
    
    const videosToModify = contextMenu.selectedVideos || (contextMenu.video ? [contextMenu.video] : []);
    if (videosToModify.length === 0) return;
    
    try {
      await Promise.all(videosToModify.map(v => renameVideo(v.id, { newAuthor: authorName })));
      onVideosUpdate?.();
      setSelectedVideoIds(new Set());
    } catch (error) {
      console.error('修改作者失败:', error);
      alert('修改作者失败');
    }
  };

  const handleMoveToCategory = async (categoryName: string) => {
    if (!contextMenu) return;
    
    const videosToModify = contextMenu.selectedVideos || (contextMenu.video ? [contextMenu.video] : []);
    if (videosToModify.length === 0) return;
    
    try {
      await Promise.all(videosToModify.map(v => moveVideo(v.id, categoryName)));
      onVideosUpdate?.();
      setSelectedVideoIds(new Set());
    } catch (error) {
      console.error('移动失败:', error);
      alert('移动失败');
    }
  };

  const handleOpenFile = async () => {
    if (!contextMenu?.video) return;
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
      if (editDialog.selectedVideos && editDialog.selectedVideos.length > 1) {
        await Promise.all(editDialog.selectedVideos.map(v => renameVideo(v.id, { newTitle: newValue })));
        setSelectedVideoIds(new Set());
      } else if (editDialog.video) {
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

  // 计算框选框的样式
  const getSelectionBoxStyle = () => {
    if (!selectionBox) return null;
    
    const left = Math.min(selectionBox.startX, selectionBox.endX);
    const top = Math.min(selectionBox.startY, selectionBox.endY);
    const width = Math.abs(selectionBox.endX - selectionBox.startX);
    const height = Math.abs(selectionBox.endY - selectionBox.startY);
    
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`
    };
  };

  // 合并已选中和正在选中的视频
  const highlightedVideoIds = useMemo(() => {
    return new Set([...selectedVideoIds, ...selectingVideoIds]);
  }, [selectedVideoIds, selectingVideoIds]);

  const allExtraButtons = (
    <>
      {highlightedVideoIds.size > 0 && (
        <span className="text-sm text-primary font-medium">
          已选择 {highlightedVideoIds.size} 个视频
        </span>
      )}
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      mainRef={mainRef}
    >
      {videos.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {videos.map((video, index) => (
              <div
                ref={(el) => registerVideoRef(video.id, el)}
                onClick={(e) => handleVideoClick(e, video, index)}
                onContextMenu={(e) => handleContextMenu(e, video)}
                key={video.id}
                data-video-card
                className={`group flex flex-col gap-3 cursor-pointer rounded-lg p-1 -m-1 transition-colors ${
                  highlightedVideoIds.has(video.id) ? 'bg-primary/10 ring-2 ring-primary' : ''
                }`}
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
      
      {/* 框选框 */}
      {selectionBox && (
        <div
          data-selection-box
          className="fixed bg-primary/20 border-2 border-primary pointer-events-none z-40"
          style={getSelectionBoxStyle() || undefined}
        />
      )}
      
      {contextMenu && (
        <VideoContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          videoId={contextMenu.video?.id || 0}
          videoTitle={contextMenu.video?.title || ''}
          videoAuthor={contextMenu.video?.author}
          videoCategory={contextMenu.video?.category}
          authors={authors}
          categories={categories}
          selectedCount={contextMenu.selectedVideos?.length}
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
          initialValue={editDialog.video?.title || ''}
          label={editDialog.selectedVideos && editDialog.selectedVideos.length > 1 ? `标题（${editDialog.selectedVideos.length}个视频）` : '标题'}
        />
      )}
    </PageLayout>
  );
}
