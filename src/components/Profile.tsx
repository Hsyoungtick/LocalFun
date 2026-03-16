import { Link, useNavigate, useParams } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { getAuthorDetail, Author, renameVideo, renameAuthor } from '../api';
import VideoPreview from './VideoPreview';
import ContextMenu from './ContextMenu';
import EditDialog from './EditDialog';

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [author, setAuthor] = useState<Author | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 右键菜单和编辑对话框状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'title' | 'authorName';
    video?: any;
  } | null>(null);
  const [editDialog, setEditDialog] = useState<{
    isOpen: boolean;
    type: 'title' | 'authorName';
    video?: any;
  } | null>(null);

  useEffect(() => {
    if (!username) return;
    
    setLoading(true);
    setError(null);
    
    getAuthorDetail(username)
      .then(setAuthor)
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </main>
    );
  }

  // 右键菜单处理
  const handleTitleContextMenu = (e: React.MouseEvent, video: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'title',
      video
    });
  };

  const handleAuthorNameContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'authorName'
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
    if (!editDialog || !author) return;
    
    try {
      if (editDialog.type === 'title' && editDialog.video) {
        await renameVideo(editDialog.video.id, { newTitle: newValue });
      } else if (editDialog.type === 'authorName') {
        const message = await renameAuthor(author.id, newValue);
        alert(message);
      }
      // 重新加载作者信息
      if (username) {
        setLoading(true);
        const data = await getAuthorDetail(editDialog.type === 'authorName' ? newValue : username);
        setAuthor(data);
      }
    } catch (error) {
      console.error('修改失败:', error);
      alert('修改失败');
    } finally {
      setLoading(false);
      setEditDialog(null);
    }
  };

  if (error || !author) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined text-6xl text-slate-300">person_off</span>
        <div className="text-slate-500">{error || '作者不存在'}</div>
        <Link to="/" className="text-primary hover:underline">返回首页</Link>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-7xl mx-auto w-full px-0 lg:px-4">
      {/* 作者头部 */}
      <div className="bg-white dark:bg-slate-900 p-4 lg:rounded-xl shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 
                className="text-2xl font-bold tracking-tight cursor-context-menu hover:text-primary transition-colors"
                onContextMenu={handleAuthorNameContextMenu}
              >
                {author.name}
              </h1>
            </div>
            {author.description && (
              <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                {author.description}
              </p>
            )}
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-slate-900 dark:text-slate-100 font-medium">
                {author.totalVideos || 0} <span className="text-slate-500 font-normal">个视频</span>
              </span>
              <span className="text-slate-900 dark:text-slate-100 font-medium">
                {author.totalViews || '0'} <span className="text-slate-500 font-normal">次观看</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 视频列表 */}
      <div className="py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold">全部视频</h3>
            <span className="text-sm text-slate-500">{author.totalVideos || 0} 个作品</span>
          </div>
        </div>

        {author.videos && author.videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 p-4">
            {author.videos.map((video) => (
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
                    className="text-slate-900 dark:text-slate-100 text-sm font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors cursor-context-menu"
                    onContextMenu={(e) => handleTitleContextMenu(e, video)}
                  >
                    {video.title}
                  </h3>
                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-1 flex items-center gap-1 flex-wrap">
                    <span>{video.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            该作者暂无视频
          </div>
        )}
      </div>
      
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
          initialValue={editDialog.type === 'title' ? (editDialog.video?.title || '') : (author?.name || '')}
          label={editDialog.type === 'title' ? '标题' : '作者名'}
        />
      )}
    </main>
  );
}
