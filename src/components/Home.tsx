import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import React, { useState, useEffect, FormEvent } from 'react';
import { getVideos, getCategories, Video, Category, renameVideo } from '../api';
import VideoPreview from './VideoPreview';
import ContextMenu from './ContextMenu';
import EditDialog from './EditDialog';

export default function Home() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('random');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // 右键菜单和编辑对话框状态
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

  // 加载分类
  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  // 加载视频
  useEffect(() => {
    setLoading(true);
    getVideos({
      category: selectedCategory,
      search: searchQuery || undefined,
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
  }, [selectedCategory, searchQuery, sortBy, sortOrder, page]);

  // 处理分类选择
  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setPage(1);
  };

  // 处理搜索
  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
  };

  // 右键菜单处理
  const handleTitleContextMenu = (e: React.MouseEvent, video: Video) => {
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
      // 重新加载视频
      setLoading(true);
      const data = await getVideos({
        category: selectedCategory,
        search: searchQuery || undefined,
        sort: sortBy,
        order: sortOrder,
        page,
        limit: 20
      });
      setVideos(data.videos);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('修改失败:', error);
      alert('修改失败');
    } finally {
      setLoading(false);
      setEditDialog(null);
    }
  };

  return (
    <main className="flex-1 flex flex-col w-full max-w-400 mx-auto">
      {/* 分类标签 */}
      <div className="flex items-center gap-3 p-4 overflow-x-auto no-scrollbar scroll-smooth">
        <div
          onClick={() => handleCategoryClick('全部')}
          className={`flex h-9 shrink-0 items-center justify-center rounded-full px-5 cursor-pointer transition-colors ${
            selectedCategory === '全部'
              ? 'bg-primary text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary'
          }`}
        >
          <span className="text-sm font-medium">全部</span>
        </div>
        {categories.map((cat) => (
          <div
            key={cat.id}
            onClick={() => handleCategoryClick(cat.name)}
            className={`flex h-9 shrink-0 items-center justify-center rounded-full px-5 cursor-pointer transition-colors ${
              selectedCategory === cat.name
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary'
            }`}
          >
            <span className="text-sm font-medium">{cat.name}</span>
          </div>
        ))}
      </div>

      {/* 排序和筛选 */}
      <div className="flex items-center justify-between px-4 mb-4">
        <div className="flex items-center gap-2">
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

      {/* 视频网格 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-500">加载中...</div>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <span className="material-symbols-outlined text-6xl text-slate-300">video_library</span>
          <div className="text-slate-500">暂无视频</div>
          <div className="text-sm text-slate-400">请先添加视频路径并扫描</div>
        </div>
      ) : (
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
                <h3 
                  className="text-slate-900 dark:text-slate-100 text-sm font-bold leading-tight line-clamp-2 hover:text-primary transition-colors cursor-context-menu"
                  onContextMenu={(e) => handleTitleContextMenu(e, video)}
                >
                  {video.title}
                </h3>
                <div className="text-slate-500 dark:text-slate-400 text-xs mt-1 flex items-center gap-1 flex-wrap">
                  <Link
                    onClick={(e) => e.stopPropagation()}
                    to={`/author/${video.author}`}
                    className="hover:text-primary transition-colors cursor-context-menu"
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
      )}

      {/* 分页 */}
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
      
      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onEdit={handleEdit}
          label={contextMenu.type === 'title' ? '标题' : '作者名'}
        />
      )}
      
      {/* 编辑对话框 */}
      {editDialog && (
        <EditDialog
          isOpen={editDialog.isOpen}
          onClose={() => setEditDialog(null)}
          onSave={handleSaveEdit}
          initialValue={editDialog.type === 'title' ? editDialog.video.title : editDialog.video.author}
          label={editDialog.type === 'title' ? '标题' : '作者名'}
        />
      )}
    </main>
  );
}
