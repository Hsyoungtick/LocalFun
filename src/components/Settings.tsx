import { useState, useEffect } from 'react';
import { getVideoPaths, addVideoPath, deleteVideoPath, scanVideos, getStats, clearCache, VideoPath } from '../api';

export default function Settings() {
  const [paths, setPaths] = useState<VideoPath[]>([]);
  const [stats, setStats] = useState({
    videoCount: 0,
    authorCount: 0,
    totalViews: 0,
    totalSize: '0'
  });
  const [newPath, setNewPath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ added: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPaths();
    loadStats();
  }, []);

  const loadPaths = async () => {
    try {
      const data = await getVideoPaths();
      setPaths(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddPath = async () => {
    if (!newPath.trim()) return;
    
    setError(null);
    try {
      await addVideoPath(newPath.trim());
      setNewPath('');
      loadPaths();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeletePath = async (id: number) => {
    try {
      await deleteVideoPath(id);
      loadPaths();
    } catch (e) {
      console.error(e);
    }
  };

  const handleScan = async (path?: string) => {
    setScanning(true);
    setScanResult(null);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await scanVideos(path);
      setScanResult(result);
      loadStats();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  // 清空并重新扫描所有路径
  const handleClearAndRescan = async () => {
    if (!confirm('确定要清空所有数据并重新扫描吗？\n这将删除所有视频记录、封面和预览图，然后重新扫描所有路径。')) {
      return;
    }

    setScanning(true);
    setScanResult(null);
    setError(null);
    setSuccess(null);
    
    try {
      // 先清除缓存
      await clearCache();
      // 再扫描所有路径
      const result = await scanVideos();
      setScanResult(result);
      loadStats();
      loadPaths();
      setSuccess(`重新扫描完成！新增 ${result.added} 个视频`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <main className="flex-1 max-w-200 mx-auto w-full px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      {/* 统计信息 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold mb-4">统计信息</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-primary">{stats.videoCount}</div>
            <div className="text-sm text-slate-500">视频数量</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-primary">{stats.authorCount}</div>
            <div className="text-sm text-slate-500">作者数量</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-primary">{stats.totalViews}</div>
            <div className="text-sm text-slate-500">总观看次数</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-primary">{stats.totalSize}</div>
            <div className="text-sm text-slate-500">总大小</div>
          </div>
        </div>
      </div>

      {/* 视频路径管理 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold mb-4">视频路径</h2>
        
        {/* 添加路径 */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="输入视频文件夹路径，如: D:\Videos"
            className="flex-1 h-10 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 border-none outline-none text-sm"
          />
          <button
            onClick={handleAddPath}
            className="h-10 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            添加路径
          </button>
        </div>

        {/* 路径列表 */}
        {paths.length > 0 ? (
          <div className="space-y-2">
            {paths.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.path}</div>
                  <div className="text-xs text-slate-500">{p.enabled ? '已启用' : '已禁用'}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleScan(p.path)}
                    disabled={scanning}
                    className="h-8 px-3 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    扫描
                  </button>
                  <button
                    onClick={() => handleDeletePath(p.id)}
                    className="h-8 px-3 bg-red-100 text-red-600 rounded text-xs font-medium hover:bg-red-200 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            暂无视频路径，请添加一个视频文件夹路径
          </div>
        )}
      </div>

      {/* 扫描操作 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">扫描视频</h2>
        <p className="text-sm text-slate-500 mb-4">
          清空所有数据并重新扫描所有已配置路径中的视频文件
        </p>
        <button
          onClick={handleClearAndRescan}
          disabled={scanning || paths.length === 0}
          className="h-10 px-6 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {scanning ? '扫描中...' : '清空并重新扫描'}
        </button>

        {/* 扫描结果 */}
        {scanResult && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-sm text-green-700 dark:text-green-400">
              扫描完成！新增 {scanResult.added} 个视频，共 {scanResult.total} 个视频
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
          </div>
        )}

        {/* 成功提示 */}
        {success && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-sm text-green-700 dark:text-green-400">{success}</div>
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm mt-6">
        <h2 className="text-lg font-bold mb-4">使用说明</h2>
        <div className="text-sm text-slate-500 space-y-2">
          <p>1. 添加视频所在的文件夹路径</p>
          <p>2. 点击"扫描"按钮扫描视频文件</p>
          <p>3. 系统会自动生成视频封面缩略图</p>
          <p>4. 在首页浏览、分类、排序视频</p>
          <p>5. 点击视频封面可以播放视频</p>
          <p className="text-xs text-slate-400 mt-4">
            注意：需要安装 ffmpeg 才能生成视频封面。请确保 ffmpeg 已添加到系统环境变量中。
          </p>
        </div>
      </div>
    </main>
  );
}
