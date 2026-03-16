import React from 'react';
import { getThumbnailUrl, formatSmartTime, Video } from '../api';

export interface VideoCardProps {
  video: Video;
  onClick?: () => void;
  variant?: 'dropdown' | 'playlist';
  isActive?: boolean;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, variant = 'dropdown', isActive = false }) => {
  const viewsDisplay = video.viewsCount || video.views;
  const lastPlayedText = video.lastPlayedAt 
    ? `上次播放: ${formatSmartTime(video.lastPlayedAt)}` 
    : video.time;

  if (variant === 'playlist') {
    return (
      <a
        href={`/video/${video.id}`}
        onClick={(e) => {
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        className={`flex gap-2 p-2 rounded-lg transition-all hover:bg-slate-100 dark:hover:bg-slate-800 w-full max-w-full ${isActive ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
      >
        <div className="relative w-24 shrink-0 aspect-video rounded overflow-hidden">
          <img
            src={getThumbnailUrl(video.id)}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">{video.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{video.author || '未知作者'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{lastPlayedText}</p>
        </div>
      </a>
    );
  }

  return (
    <div
      onClick={onClick}
      className="px-3 py-2 cursor-pointer transition-colors text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex gap-3"
    >
      <div className="w-24 h-14 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0 overflow-hidden">
        <img 
          src={getThumbnailUrl(video.id)}
          alt={video.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="text-sm font-medium line-clamp-2">{video.title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{video.author || '未知作者'}</div>
        <div className="text-xs text-slate-400 mt-0.5">{lastPlayedText}</div>
      </div>
    </div>
  );
};

export default VideoCard;
