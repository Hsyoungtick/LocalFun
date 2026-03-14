import { useState, useEffect, useRef } from 'react';
import { getVideoPaths, addVideoPath, deleteVideoPath, scanVideos, getStats, getScanProgress, rescanVideos, rescanAll, deleteAll, VideoPath } from '../api';

interface PathProgress {
  status: string;
  current: number;
  total: number;
  phase: string;
  videoCount: number;
}

interface GlobalProgress {
  status: string;
  current: number;
  total: number;
  phase: string;
  videoCount: number;
  importingPath: string | null;
}

// localStorage 键名
const STORAGE_KEY_GLOBAL = 'import_global_progress';
const STORAGE_KEY_PATHS = 'import_path_progress';

// 保存全局进度到 localStorage
function saveGlobalProgress(progress: GlobalProgress) {
  try {
    localStorage.setItem(STORAGE_KEY_GLOBAL, JSON.stringify(progress));
  } catch (e) {
    console.error('保存进度失败:', e);
  }
}

// 从 localStorage 加载全局进度
function loadGlobalProgress(): GlobalProgress | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GLOBAL);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('加载进度失败:', e);
  }
  return null;
}

// 清除全局进度
function clearGlobalProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY_GLOBAL);
  } catch (e) {
    console.error('清除进度失败:', e);
  }
}

// 保存路径进度到 localStorage
function savePathProgress(progress: Record<number, PathProgress>) {
  try {
    localStorage.setItem(STORAGE_KEY_PATHS, JSON.stringify(progress));
  } catch (e) {
    console.error('保存路径进度失败:', e);
  }
}

// 从 localStorage 加载路径进度
function loadPathProgress(): Record<number, PathProgress> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PATHS);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('加载路径进度失败:', e);
  }
  return {};
}

// 清除路径进度
function clearPathProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY_PATHS);
  } catch (e) {
    console.error('清除路径进度失败:', e);
  }
}

export default function Settings() {
  const [paths, setPaths] = useState<VideoPath[]>([]);
  const [stats, setStats] = useState({
    videoCount: 0,
    authorCount: 0,
    totalViews: 0,
    totalSize: '0'
  });
  const [newPath, setNewPath] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 全局进度状态 - 从 localStorage 恢复
  const [globalProgress, setGlobalProgress] = useState<GlobalProgress>(() => {
    const saved = loadGlobalProgress();
    return saved || { status: 'idle', current: 0, total: 0, phase: '', videoCount: 0, importingPath: null };
  });
  
  // 每个路径的进度状态 - 从 localStorage 恢复
  const [pathProgress, setPathProgress] = useState<Record<number, PathProgress>>(() => loadPathProgress());
  
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPaths();
    loadStats();
    
    // 如果有未完成的进度，继续轮询
    if (globalProgress.status !== 'idle' && globalProgress.status !== 'completed' && globalProgress.status !== 'error') {
      startProgressPolling();
    }
    
    // 检查路径进度是否有未完成的
    Object.entries(pathProgress).forEach(([pathId, progress]: [string, PathProgress]) => {
      if (progress.status !== 'idle' && progress.status !== 'completed' && progress.status !== 'error') {
        startProgressPolling(parseInt(pathId));
      }
    });
  }, []);

  // 保存全局进度到 localStorage
  useEffect(() => {
    if (globalProgress.status !== 'idle') {
      saveGlobalProgress(globalProgress);
      if (globalProgress.status === 'completed' || globalProgress.status === 'error') {
        // 完成或错误后延迟清除，保留状态显示
        setTimeout(() => {
          if (globalProgress.status === 'completed') {
            clearGlobalProgress();
          }
        }, 5000);
      }
    }
  }, [globalProgress]);

  // 保存路径进度到 localStorage
  useEffect(() => {
    if (Object.keys(pathProgress).length > 0) {
      savePathProgress(pathProgress);
      // 清除已完成或错误的路径进度
      const hasActiveProgress = Object.values(pathProgress).some(
        (p: PathProgress) => p.status !== 'idle' && p.status !== 'completed' && p.status !== 'error'
      );
      if (!hasActiveProgress) {
        setTimeout(() => {
          clearPathProgress();
        }, 5000);
      }
    }
  }, [pathProgress]);

  // 开始轮询进度
  const startProgressPolling = (pathId?: number, isGlobal?: boolean) => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    progressInterval.current = setInterval(async () => {
      try {
        const p = await getScanProgress();
        
        if (isGlobal) {
          // 全局操作：更新所有路径的进度
          const allProgress: Record<number, PathProgress> = {};
          paths.forEach(pathItem => {
            allProgress[pathItem.id] = {
              status: p.status,
              current: p.current,
              total: p.total,
              phase: p.phase,
              videoCount: p.videoCount
            };
          });
          setPathProgress(allProgress);
        } else if (pathId !== undefined) {
          // 单路径进度
          setPathProgress(prev => ({
            ...prev,
            [pathId]: {
              status: p.status,
              current: p.current,
              total: p.total,
              phase: p.phase,
              videoCount: p.videoCount
            }
          }));
        }
        
        if (p.status === 'completed' || p.status === 'error') {
          if (progressInterval.current) {
            clearInterval(progressInterval.current);
            progressInterval.current = null;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 500);
  };

  // 停止轮询进度
  const stopProgressPolling = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  };

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
      const result = await deleteVideoPath(id) as any;
      loadPaths();
      loadStats();
      // 清除该路径的进度
      setPathProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[id];
        return newProgress;
      });
      if (result?.deletedVideos) {
        setSuccess(`已删除路径及 ${result.deletedVideos} 个视频数据`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 导入（只添加新视频）
  const handleImport = async (pathId: number, path: string) => {
    setImportResult(null);
    setError(null);
    setSuccess(null);
    
    // 初始化路径进度
    setPathProgress(prev => ({
      ...prev,
      [pathId]: { status: 'scanning', current: 0, total: 0, phase: '扫描视频文件...', videoCount: 0 }
    }));
    
    startProgressPolling(pathId);
    
    try {
      const result = await scanVideos(path);
      setImportResult(result);
      loadStats();
      
      // 更新最终状态
      setPathProgress(prev => ({
        ...prev,
        [pathId]: { status: 'completed', current: result.added, total: result.added, phase: `已完成（${result.added} 个视频）`, videoCount: result.added }
      }));
    } catch (e: any) {
      setError(e.message);
      setPathProgress(prev => ({
        ...prev,
        [pathId]: { status: 'error', current: 0, total: 0, phase: '导入失败', videoCount: 0 }
      }));
    } finally {
      stopProgressPolling();
    }
  };

  // 重新导入指定路径
  const handleReimport = async (pathId: number, path: string) => {
    setImportResult(null);
    setError(null);
    setSuccess(null);
    
    // 初始化路径进度
    setPathProgress(prev => ({
      ...prev,
      [pathId]: { status: 'scanning', current: 0, total: 0, phase: '扫描视频文件...', videoCount: 0 }
    }));
    
    startProgressPolling(pathId);
    
    try {
      const result = await rescanVideos(path);
      setImportResult(result);
      loadStats();
      
      // 更新最终状态
      setPathProgress(prev => ({
        ...prev,
        [pathId]: { status: 'completed', current: result.added, total: result.added, phase: `已完成（${result.added} 个视频）`, videoCount: result.added }
      }));
    } catch (e: any) {
      setError(e.message);
      setPathProgress(prev => ({
        ...prev,
        [pathId]: { status: 'error', current: 0, total: 0, phase: '导入失败', videoCount: 0 }
      }));
    } finally {
      stopProgressPolling();
    }
  };

  // 全部导入（全局增量导入）
  const handleImportAll = async () => {
    setImporting(true);
    setImportResult(null);
    setError(null);
    setSuccess(null);
    
    // 初始化所有路径的进度
    const initialProgress: Record<number, PathProgress> = {};
    paths.forEach(p => {
      initialProgress[p.id] = { status: 'scanning', current: 0, total: 0, phase: '扫描视频文件...', videoCount: 0 };
    });
    setPathProgress(initialProgress);
    
    startProgressPolling(undefined, true);
    
    try {
      const result = await scanVideos();
      setImportResult(result);
      loadStats();
      
      // 更新所有路径的最终状态
      const finalProgress: Record<number, PathProgress> = {};
      paths.forEach(p => {
        finalProgress[p.id] = { 
          status: 'completed', 
          current: result.added, 
          total: result.added, 
          phase: `已完成（${result.added} 个视频）`, 
          videoCount: result.added 
        };
      });
      setPathProgress(finalProgress);
    } catch (e: any) {
      setError(e.message);
      // 更新所有路径的错误状态
      const errorProgress: Record<number, PathProgress> = {};
      paths.forEach(p => {
        errorProgress[p.id] = { status: 'error', current: 0, total: 0, phase: '导入失败', videoCount: 0 };
      });
      setPathProgress(errorProgress);
    } finally {
      setImporting(false);
      stopProgressPolling();
    }
  };

  // 全部重新导入（删除数据库并重新生成，保留路径配置，然后导入）
  const handleReimportAll = async () => {
    setImporting(true);
    setImportResult(null);
    setError(null);
    setSuccess(null);
    
    // 初始化所有路径的进度
    const initialProgress: Record<number, PathProgress> = {};
    paths.forEach(p => {
      initialProgress[p.id] = { status: 'scanning', current: 0, total: 0, phase: '扫描视频文件...', videoCount: 0 };
    });
    setPathProgress(initialProgress);
    
    startProgressPolling(undefined, true);
    
    try {
      const result = await rescanAll();
      setImportResult(result);
      loadStats();
      loadPaths();
      
      // 更新所有路径的最终状态
      const finalProgress: Record<number, PathProgress> = {};
      paths.forEach(p => {
        finalProgress[p.id] = { 
          status: 'completed', 
          current: result.added, 
          total: result.added, 
          phase: `已完成（${result.added} 个视频）`, 
          videoCount: result.added 
        };
      });
      setPathProgress(finalProgress);
    } catch (e: any) {
      setError(e.message);
      // 更新所有路径的错误状态
      const errorProgress: Record<number, PathProgress> = {};
      paths.forEach(p => {
        errorProgress[p.id] = { status: 'error', current: 0, total: 0, phase: '导入失败', videoCount: 0 };
      });
      setPathProgress(errorProgress);
    } finally {
      setImporting(false);
      stopProgressPolling();
    }
  };

  // 全部删除（删除数据库和所有数据，包括路径配置）
  const handleDeleteAll = async () => {
    setImporting(true);
    setImportResult(null);
    setError(null);
    setSuccess(null);
    setPathProgress({}); // 清除所有路径进度
    clearPathProgress();
    
    try {
      await deleteAll();
      loadStats();
      loadPaths();
      setSuccess('所有数据已删除，数据库已重新生成');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  // 检查是否有任何路径正在导入
  const isAnyPathImporting = Object.values(pathProgress).some((p: PathProgress) => p.status !== 'idle' && p.status !== 'completed' && p.status !== 'error');

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
            {paths.map((p) => {
              const progress = pathProgress[p.id] || { status: 'idle', current: 0, total: 0, phase: '', videoCount: 0 };
              const isThisImporting = progress.status !== 'idle' && progress.status !== 'completed' && progress.status !== 'error';
              
              return (
                <div key={p.id} className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.path}</div>
                    <div className="text-xs text-slate-500">{p.enabled ? '已启用' : '已禁用'}</div>
                  </div>
                  
                  {/* 路径进度条 */}
                  <div className="flex-1 mx-4">
                    {progress.status !== 'idle' && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          {progress.status !== 'completed' && (
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <span className={`text-xs whitespace-nowrap ${progress.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}`}>
                          {progress.phase}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleImport(p.id, p.path)}
                      disabled={importing || isAnyPathImporting || isThisImporting}
                      className="h-8 px-3 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                      title="只导入新视频"
                    >
                      导入
                    </button>
                    <button
                      onClick={() => handleReimport(p.id, p.path)}
                      disabled={importing || isAnyPathImporting || isThisImporting}
                      className="h-8 px-3 bg-orange-100 text-orange-600 rounded text-xs font-medium hover:bg-orange-20 transition-colors disabled:opacity-50"
                      title="删除该目录数据并重新导入"
                    >
                      重新导入
                    </button>
                    <button
                      onClick={() => handleDeletePath(p.id)}
                      disabled={isThisImporting}
                      className="h-8 px-3 bg-red-100 text-red-600 rounded text-xs font-medium hover:bg-red-20 transition-colors disabled:opacity-50"
                      title="删除路径及该路径下的所有视频数据"
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            暂无视频路径，请添加一个视频文件夹路径
          </div>
        )}

        {/* 全部操作按钮 */}
        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleImportAll}
            disabled={importing || isAnyPathImporting || paths.length === 0}
            className="h-10 px-6 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            title="全局增量导入，只添加新视频"
          >
            {importing ? '导入中...' : '全部导入'}
          </button>
          <button
            onClick={handleReimportAll}
            disabled={importing || isAnyPathImporting}
            className="h-10 px-6 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            title="全局重新导入，删除数据库并重新生成，保留路径配置"
          >
            {importing ? '导入中...' : '全部重新导入'}
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={importing || isAnyPathImporting}
            className="h-10 px-6 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            title="删除数据库和所有数据，包括路径配置"
          >
            {importing ? '处理中...' : '全部删除'}
          </button>
        </div>

        {/* 导入结果 */}
        {importResult && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-sm text-green-700 dark:text-green-400">
              导入完成！新增 {importResult.added} 个视频，共 {importResult.total} 个视频
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
          <p>2. 点击"导入"按钮导入视频文件</p>
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
