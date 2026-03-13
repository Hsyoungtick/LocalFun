export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark p-8">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-2xl">play_circle</span>
            <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold">LocalFun</h2>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs">发现并管理本地视频的社区。</p>
        </div>
        <div className="flex gap-8 text-sm text-slate-600 dark:text-slate-400">
          <a href="#" className="hover:text-primary">关于我们</a>
          <a href="#" className="hover:text-primary">隐私政策</a>
          <a href="#" className="hover:text-primary">服务协议</a>
          <a href="#" className="hover:text-primary">帮助中心</a>
        </div>
        <div className="flex gap-4">
          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-primary/20 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-lg">share</span>
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-primary/20 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-lg">chat</span>
          </button>
        </div>
      </div>
      <p className="text-center text-slate-400 dark:text-slate-500 text-[10px] mt-8">© 2024 LocalFun. 保留所有权利。</p>
    </footer>
  );
}
