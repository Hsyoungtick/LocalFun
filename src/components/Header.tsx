import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { getCategories, Category } from '../api';

export default function Header() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { selectedCategory, setSelectedCategory, searchQuery, setSearchQuery } = useAppContext();

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleFavorite = () => {
    alert('收藏功能');
  };

  const handleHistory = () => {
    alert('历史功能');
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setShowCategoryDropdown(false);
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
        <div className="relative" ref={dropdownRef}>
          <div 
            className="relative"
            onMouseEnter={() => setShowCategoryDropdown(true)}
            onMouseLeave={() => setShowCategoryDropdown(false)}
          >
            <div className="absolute -top-4 left-0 right-0 h-4"></div>
            <button 
              className={`p-2 rounded-lg transition-colors flex items-center justify-center ${showCategoryDropdown ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}`}
              title="分类"
            >
              <span className="material-symbols-outlined hover:text-pink-500 transition-colors">category</span>
            </button>
          </div>
          {showCategoryDropdown && (
            <div 
              className="absolute top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50"
              style={{ left: '50%', transform: 'translateX(-50%)' }}
              onMouseEnter={() => setShowCategoryDropdown(true)}
              onMouseLeave={() => setShowCategoryDropdown(false)}
            >
              <div
                onClick={() => handleCategoryClick('全部')}
                className={`px-4 py-2 cursor-pointer transition-colors ${
                  selectedCategory === '全部'
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                全部
              </div>
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.name)}
                  className={`px-4 py-2 cursor-pointer transition-colors ${
                    selectedCategory === cat.name
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <button 
          onClick={handleFavorite}
          className="p-2 text-slate-600 dark:text-slate-400 rounded-lg flex items-center justify-center"
          title="收藏"
        >
          <span className="material-symbols-outlined hover:text-pink-500 transition-colors">bookmark</span>
        </button>
        <button 
          onClick={handleHistory}
          className="p-2 text-slate-600 dark:text-slate-400 rounded-lg flex items-center justify-center"
          title="历史"
        >
          <span className="material-symbols-outlined hover:text-pink-500 transition-colors">history</span>
        </button>
        <button 
          onClick={toggleDarkMode}
          className="p-2 text-slate-600 dark:text-slate-400 rounded-lg flex items-center justify-center"
          title="Toggle Dark Mode"
        >
          <span className="material-symbols-outlined hover:text-pink-500 transition-colors">
            {isDarkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        <Link to="/settings" className="p-2 text-slate-600 dark:text-slate-400 rounded-lg flex items-center justify-center" title="设置">
          <span className="material-symbols-outlined hover:text-pink-500 transition-colors">settings</span>
        </Link>
      </div>
    </header>
  );
}
