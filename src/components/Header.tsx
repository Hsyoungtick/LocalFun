import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Header() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check initial preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md px-4 md:px-10 py-3">
      <div className="flex items-center gap-8 shrink-0">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined text-3xl">play_circle</span>
          <h2 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-tight">LocalFun</h2>
        </Link>
        <nav className="hidden lg:flex items-center gap-6">
          <Link to="/" className="text-primary text-sm font-bold leading-normal border-b-2 border-primary pb-1">首页</Link>
          <a href="#" className="text-slate-600 dark:text-slate-400 hover:text-primary transition-colors text-sm font-medium leading-normal">收藏</a>
          <a href="#" className="text-slate-600 dark:text-slate-400 hover:text-primary transition-colors text-sm font-medium leading-normal">历史</a>
        </nav>
      </div>
      <div className="flex flex-1 justify-center max-w-xl px-4">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input className="w-full h-10 pl-10 pr-4 rounded-lg bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none" placeholder="搜索您的本地收藏..." type="text" />
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <button 
          onClick={toggleDarkMode}
          className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Toggle Dark Mode"
        >
          <span className="material-symbols-outlined">
            {isDarkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        <button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <Link to="/settings" className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <span className="material-symbols-outlined">settings</span>
        </Link>
      </div>
    </header>
  );
}
