import React from 'react';

interface PageLayoutProps {
  title: string;
  titleIcon?: string;
  loading?: boolean;
  emptyIcon?: string;
  emptyText?: string;
  emptySubtext?: string;
  extraButtons?: React.ReactNode;
  children?: React.ReactNode;
  showTitleEdit?: boolean;
  onTitleEdit?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
  mainRef?: React.RefObject<HTMLDivElement | null>;
}

export default function PageLayout({
  title,
  titleIcon,
  loading = false,
  emptyIcon,
  emptyText,
  emptySubtext,
  extraButtons,
  children,
  showTitleEdit,
  onTitleEdit,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  mainRef
}: PageLayoutProps) {
  const hasContent = children && !React.Children.toArray(children).every(child => !child);
  
  return (
    <main 
      ref={mainRef}
      className="flex-1 flex flex-col w-full max-w-400 mx-auto px-4 md:px-10 py-6 select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {titleIcon && (
            <span className="material-symbols-outlined text-2xl text-primary">
              {titleIcon}
            </span>
          )}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          {showTitleEdit && (
            <button
              onClick={onTitleEdit}
              className="flex items-center"
            >
              <span className="material-symbols-outlined text-xl text-slate-500 hover:text-primary">
                edit
              </span>
            </button>
          )}
        </div>
        {extraButtons && (
          <div className="flex items-center gap-2">
            {extraButtons}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-500">加载中...</div>
        </div>
      ) : !hasContent && emptyIcon && emptyText ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <span className="material-symbols-outlined text-6xl text-slate-300">
            {emptyIcon}
          </span>
          <div className="text-slate-500">{emptyText}</div>
          {emptySubtext && (
            <div className="text-sm text-slate-400">{emptySubtext}</div>
          )}
        </div>
      ) : (
        children
      )}
    </main>
  );
}
