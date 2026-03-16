import { useEffect, useRef, useState, useCallback } from 'react';
import { Author, Category } from '../api';

interface ContextMenuProps {
  x: number;
  y: number;
  videoId: number;
  videoTitle: string;
  videoAuthor?: string;
  videoCategory?: string;
  authors: Author[];
  categories: Category[];
  onClose: () => void;
  onEditTitle: () => void;
  onChangeAuthor: (authorName: string) => void;
  onMoveToCategory: (categoryName: string) => void;
  onOpenFile: () => void;
}

export default function ContextMenu({
  x,
  y,
  videoTitle,
  videoAuthor,
  videoCategory,
  authors,
  categories,
  onClose,
  onEditTitle,
  onChangeAuthor,
  onMoveToCategory,
  onOpenFile
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showAuthorList, setShowAuthorList] = useState(false);
  const [showCategoryList, setShowCategoryList] = useState(false);
  const [newAuthorName, setNewAuthorName] = useState('');
  const justOpenedRef = useRef(false);

  // 关闭菜单的函数
  const closeMenu = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // 如果刚刚打开子菜单，忽略这次点击
      if (justOpenedRef.current) {
        justOpenedRef.current = false;
        return;
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    // 立即添加监听器，但使用 justOpenedRef 来防止误关闭
    document.addEventListener('mousedown', handleMouseDown);

    const handleScroll = () => closeMenu();
    const handleResize = () => closeMenu();

    document.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [closeMenu]);

  const handleEditTitle = () => {
    onEditTitle();
    closeMenu();
  };

  const handleOpenFile = () => {
    onOpenFile();
    closeMenu();
  };

  const handleSelectAuthor = (authorName: string) => {
    onChangeAuthor(authorName);
    closeMenu();
  };

  const handleNewAuthor = () => {
    if (newAuthorName.trim()) {
      onChangeAuthor(newAuthorName.trim());
      closeMenu();
    }
  };

  const handleSelectCategory = (categoryName: string) => {
    onMoveToCategory(categoryName);
    closeMenu();
  };

  const handleShowAuthorList = () => {
    justOpenedRef.current = true;
    setShowAuthorList(true);
  };

  const handleShowCategoryList = () => {
    justOpenedRef.current = true;
    setShowCategoryList(true);
  };

  if (showAuthorList) {
    return (
      <div
        ref={menuRef}
        className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[200px] max-h-[300px] overflow-y-auto"
        style={{ left: x, top: y }}
      >
        <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
          选择作者
        </div>
        <div className="p-2 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="新建作者..."
              value={newAuthorName}
              onChange={(e) => setNewAuthorName(e.target.value)}
              className="flex-1 px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 rounded border-none outline-none"
              autoFocus
            />
            <button
              onClick={handleNewAuthor}
              disabled={!newAuthorName.trim()}
              className="px-2 py-1 text-sm bg-primary text-white rounded disabled:opacity-50"
            >
              确定
            </button>
          </div>
        </div>
        {authors.length === 0 && (
          <div className="px-4 py-2 text-sm text-slate-500">暂无作者</div>
        )}
        {authors.map((author) => (
          <button
            key={author.id}
            onClick={() => handleSelectAuthor(author.name)}
            className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
              author.name === videoAuthor ? 'text-primary font-medium' : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {author.name}
          </button>
        ))}
        <button
          onClick={() => setShowAuthorList(false)}
          className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-t border-slate-200 dark:border-slate-700"
        >
          ← 返回
        </button>
      </div>
    );
  }

  if (showCategoryList) {
    return (
      <div
        ref={menuRef}
        className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[200px] max-h-[300px] overflow-y-auto"
        style={{ left: x, top: y }}
      >
        <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
          移动到分类
        </div>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleSelectCategory(category.name)}
            className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
              category.name === videoCategory ? 'text-primary font-medium' : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {category.name}
          </button>
        ))}
        <button
          onClick={() => setShowCategoryList(false)}
          className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-t border-slate-200 dark:border-slate-700"
        >
          ← 返回
        </button>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[150px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={handleEditTitle}
        className="w-full px-4 py-2 text-left text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-base">edit</span>
        修改标题
      </button>
      <button
        onClick={handleShowAuthorList}
        className="w-full px-4 py-2 text-left text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-base">person</span>
        修改作者
      </button>
      <button
        onClick={handleShowCategoryList}
        className="w-full px-4 py-2 text-left text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-base">folder</span>
        移动
      </button>
      <button
        onClick={handleOpenFile}
        className="w-full px-4 py-2 text-left text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-base">open_in_new</span>
        打开源文件
      </button>
    </div>
  );
}
