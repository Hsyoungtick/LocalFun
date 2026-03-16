import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { getCategories, getFavoriteVideos, getHistoryVideos, getAuthors, Category, Video, Author } from '../api';
import VideoCard from './VideoCard';

export default function Header() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [showFavoritesDropdown, setShowFavoritesDropdown] = useState(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [favoritesVideos, setFavoritesVideos] = useState<Video[]>([]);
  const [historyVideos, setHistoryVideos] = useState<Video[]>([]);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const authorDropdownRef = useRef<HTMLDivElement>(null);
  const favoritesDropdownRef = useRef<HTMLDivElement>(null);
  const historyDropdownRef = useRef<HTMLDivElement>(null);
  const { searchQuery, setSearchQuery } = useAppContext();

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const loadFavorites = () => {
    getFavoriteVideos({ limit: 10 }).then(data => setFavoritesVideos(data.videos)).catch(console.error);
  };

  const loadHistory = () => {
    getHistoryVideos({ limit: 10 }).then(data => setHistoryVideos(data.videos)).catch(console.error);
  };

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
    getAuthors().then(setAuthors).catch(console.error);
    loadFavorites();
    loadHistory();
  }, []);

  useEffect(() => {
    if (showFavoritesDropdown) {
      loadFavorites();
    }
  }, [showFavoritesDropdown]);

  useEffect(() => {
    if (showHistoryDropdown) {
      loadHistory();
    }
  }, [showHistoryDropdown]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsHidden(true);
      } else if (currentScrollY < lastScrollY) {
        setIsHidden(false);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleCategoryClick = (category: string) => {
    navigate(`/categories/${encodeURIComponent(category)}`);
    setShowCategoryDropdown(false);
  };

  const handleCategoryButtonClick = () => {
    navigate('/categories');
  };

  const handleAuthorClick = (author: string) => {
    navigate(`/authors/${encodeURIComponent(author)}`);
    setShowAuthorDropdown(false);
  };

  const handleAuthorButtonClick = () => {
    navigate('/authors');
  };

  const handleFavoritesButtonClick = () => {
    navigate('/favorites');
  };

  const handleHistoryButtonClick = () => {
    navigate('/history');
  };

  return (
    <header 
      className={`sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md px-4 md:px-10 py-3 transition-transform duration-300 ${isHidden ? '-translate-y-full' : 'translate-y-0'}`}
    >
      <div className="flex items-center gap-8 shrink-0">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined text-3xl">play_circle</span>
          <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-tight">LocalFun</h2>
        </Link>
      </div>
      <div className="flex flex-1 justify-center max-w-xl px-4">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input 
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none" 
            placeholder="搜索" 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="relative" ref={categoryDropdownRef}>
          <div>
            <button 
              className="rounded-lg transition-colors flex items-center justify-center cursor-pointer text-slate-600 dark:text-slate-400"
              title="分类"
              onClick={handleCategoryButtonClick}
              onMouseEnter={() => setShowCategoryDropdown(true)}
              onMouseLeave={() => setShowCategoryDropdown(false)}
            >
              <span className="material-symbols-outlined hover:text-pink-500">folder</span>
            </button>
          </div>
          {showCategoryDropdown && (
            <div 
              onMouseEnter={() => setShowCategoryDropdown(true)}
              onMouseLeave={() => setShowCategoryDropdown(false)}
            >
              <div className="absolute top-full left-0 right-0 h-2"></div>
              <div 
                className="absolute top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50 max-h-[calc(100vh-200px)] overflow-y-auto"
                style={{ right: 'auto', left: '50%', transform: 'translateX(-45%)' }}
              >
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.name)}
                    className="px-4 py-2 cursor-pointer transition-colors text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {cat.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative" ref={authorDropdownRef}>
          <div>
            <button 
              className="rounded-lg transition-colors flex items-center justify-center cursor-pointer text-slate-600 dark:text-slate-400"
              title="作者"
              onClick={handleAuthorButtonClick}
              onMouseEnter={() => setShowAuthorDropdown(true)}
              onMouseLeave={() => setShowAuthorDropdown(false)}
            >
              <span className="material-symbols-outlined hover:text-pink-500">person</span>
            </button>
          </div>
          {showAuthorDropdown && (
            <div 
              onMouseEnter={() => setShowAuthorDropdown(true)}
              onMouseLeave={() => setShowAuthorDropdown(false)}
            >
              <div className="absolute top-full left-0 right-0 h-2"></div>
              <div 
                className="absolute top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50 max-h-[calc(100vh-200px)] overflow-y-auto"
                style={{ right: 'auto', left: '50%', transform: 'translateX(-45%)' }}
              >
                {authors.map((author) => (
                  <div
                    key={author.id}
                    onClick={() => handleAuthorClick(author.name)}
                    className="px-4 py-2 cursor-pointer transition-colors text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {author.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative" ref={favoritesDropdownRef}>
          <div>
            <button 
              className="rounded-lg transition-colors flex items-center justify-center cursor-pointer text-slate-600 dark:text-slate-400"
              title="收藏"
              onClick={handleFavoritesButtonClick}
              onMouseEnter={() => setShowFavoritesDropdown(true)}
              onMouseLeave={() => setShowFavoritesDropdown(false)}
            >
              <span className="material-symbols-outlined hover:text-pink-500">bookmark</span>
            </button>
          </div>
          {showFavoritesDropdown && (
            <div 
              onMouseEnter={() => setShowFavoritesDropdown(true)}
              onMouseLeave={() => setShowFavoritesDropdown(false)}
            >
              <div className="absolute top-full left-0 right-0 h-2"></div>
              <div 
                className="absolute top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50 max-h-[calc(100vh-200px)] overflow-y-auto"
                style={{ right: 'auto', left: '50%', transform: 'translateX(-60%)' }}
              >
                {favoritesVideos.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-500">
                    <span className="material-symbols-outlined text-4xl mb-2">bookmark_border</span>
                    <div className="text-sm">暂无收藏</div>
                  </div>
                ) : (
                  favoritesVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      variant="dropdown"
                      onClick={() => navigate(`/video/${video.id}`)}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="relative" ref={historyDropdownRef}>
          <div>
            <button 
              className="rounded-lg transition-colors flex items-center justify-center cursor-pointer text-slate-600 dark:text-slate-400"
              title="历史"
              onClick={handleHistoryButtonClick}
              onMouseEnter={() => setShowHistoryDropdown(true)}
              onMouseLeave={() => setShowHistoryDropdown(false)}
            >
              <span className="material-symbols-outlined hover:text-pink-500">history</span>
            </button>
          </div>
          {showHistoryDropdown && (
            <div 
              onMouseEnter={() => setShowHistoryDropdown(true)}
              onMouseLeave={() => setShowHistoryDropdown(false)}
            >
              <div className="absolute top-full left-0 right-0 h-2"></div>
              <div 
                className="absolute top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50 max-h-[calc(100vh-200px)] overflow-y-auto"
                style={{ right: 'auto', left: '50%', transform: 'translateX(-60%)' }}
              >
                {historyVideos.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-500">
                    <span className="material-symbols-outlined text-4xl mb-2">history</span>
                    <div className="text-sm">暂无观看历史</div>
                  </div>
                ) : (
                  historyVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      variant="dropdown"
                      onClick={() => navigate(`/video/${video.id}`)}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <button 
          onClick={toggleDarkMode}
          className="text-slate-600 dark:text-slate-400 rounded-lg flex items-center justify-center cursor-pointer"
          title="Toggle Dark Mode"
        >
          <span className="material-symbols-outlined hover:text-pink-500">
            {isDarkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        <Link to="/settings" className="text-slate-600 dark:text-slate-400 rounded-lg flex items-center justify-center cursor-pointer" title="设置">
          <span className="material-symbols-outlined hover:text-pink-500">settings</span>
        </Link>
      </div>
    </header>
  );
}
