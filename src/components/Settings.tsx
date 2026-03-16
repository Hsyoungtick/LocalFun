import { useState, useEffect, useRef } from 'react';
import { getVideoPaths, addVideoPath, deleteVideoPath, clearVideoPath, scanVideos, getStats, getScanProgress, VideoPath, stopScan, updateVideoPath, generatePreviews } from '../api';

interface PathProgress {
  status: string;
  current: number;
  total: number;
  phase: string;
  videoCount: number;
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
  const [importResult, setImportResult] = useState<{ added: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 每个路径的进度状态
  const [pathProgress, setPathProgress] = useState<Record<number, PathProgress>>({});
  // 每个路径是否暂停
  const [pausedPaths, setPausedPaths] = useState<Set<number>>(new Set());
  // 预览图生成是否暂停
  const [previewPausedPaths, setPreviewPausedPaths] = useState<Set<number>>(new Set());
  
  const progressIntervals = useRef<Map<number, NodeJS.Timeout>>(new Map());
  
  // 判断是否有任何路径正在导入（不包括暂停的）
  const isAnyPathImporting = Object.values(pathProgress).some(
    (p: PathProgress) => p.status === 'scanning' || p.status === 'generating_previews'
  ) && pausedPaths.size === 0;
  
  // 判断是否有任何路径正在扫描（不包括暂停的）
  const isAnyPathScanning = Object.values(pathProgress).some(
    (p: PathProgress) => p.status === 'scanning' || p.status === 'generating_previews'
  );

  useEffect(() => {
    loadPaths();
    loadStats();
  }, []);
  
  // 在paths加载完成后加载进度
  useEffect(() => {
    if (paths.length === 0) return;
    
    // 加载所有路径的初始进度
    const loadInitialProgress = async () => {
      const initialProgress: Record<number, PathProgress> = {};
      
      for (const pathItem of paths) {
        try {
          const p = await getScanProgress(pathItem.id);
          if (p.status !== 'idle') {
            initialProgress[pathItem.id] = {
              status: p.status,
              current: p.current,
              total: p.total,
              phase: p.phase,
              videoCount: p.videoCount
            };
          }
        } catch (e) {
          // 忽略错误
        }
      }
      
      setPathProgress(initialProgress);
      
      // 检查是否有未完成的进度，如果有则开始轮询
      checkAndStartPolling();
    };
    
    loadInitialProgress();
  }, [paths]);
  
  // 检查并开始轮询进度
  const checkAndStartPolling = async () => {
    try {
      // 检查每个路径的进度
      for (const pathItem of paths) {
        try {
          const pathP = await getScanProgress(pathItem.id);
          // 先更新进度状态（包括completed状态）
          setPathProgress(prev => ({
            ...prev,
            [pathItem.id]: {
              status: pathP.status,
              current: pathP.current,
              total: pathP.total,
              phase: pathP.phase,
              videoCount: pathP.videoCount
            }
          }));
          // 只有在正在处理时才启动轮询
          if (pathP.status !== 'idle' && pathP.status !== 'completed' && pathP.status !== 'error') {
            startProgressPolling(pathItem.id);
          }
        } catch (e) {
          // 忽略错误
        }
      }
    } catch (e) {
      // 忽略错误
    }
  };

  // 开始轮询进度
  const startProgressPolling = (pathId?: number, isGlobal?: boolean) => {
    // 如果是全局操作，不再需要特殊处理
    if (pathId === undefined) return;
    
    // 如果该路径已经在轮询，先清除
    const existingInterval = progressIntervals.current.get(pathId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    // 启动新的轮询
    const interval = setInterval(async () => {
      try {
        const p = await getScanProgress(pathId);
        
        // 更新该路径的进度
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
        
        if (p.status === 'completed' || p.status === 'error') {
          // 确保最后一次状态更新完成后再停止轮询
          setTimeout(() => {
            const interval = progressIntervals.current.get(pathId);
            if (interval) {
              clearInterval(interval);
              progressIntervals.current.delete(pathId);
            }
          }, 100);
        }
      } catch (e) {
        console.error(e);
      }
    }, 500);
    
    progressIntervals.current.set(pathId, interval);
  };

  // 停止轮询进度
  const stopProgressPolling = (pathId?: number) => {
    if (pathId !== undefined) {
      const interval = progressIntervals.current.get(pathId);
      if (interval) {
        clearInterval(interval);
        progressIntervals.current.delete(pathId);
      }
    } else {
      // 停止所有轮询
      progressIntervals.current.forEach((interval) => {
        clearInterval(interval);
      });
      progressIntervals.current.clear();
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
      const result = await addVideoPath(newPath.trim());
      setNewPath('');
      loadPaths();
      
      // 显示结果
      if (result.added.length > 0 && result.existing.length > 0) {
        setSuccess(`添加了 ${result.added.length} 个路径，${result.existing.length} 个路径已存在`);
      } else if (result.added.length > 0) {
        setSuccess(`添加了 ${result.added.length} 个路径`);
      } else if (result.existing.length > 0) {
        setSuccess(`${result.existing.length} 个路径已存在`);
      }
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

  // 切换预览图生成
  const handleTogglePreviews = async (pathId: number, enabled: boolean) => {
    try {
      await updateVideoPath(pathId, { generate_previews: enabled });
      loadPaths();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 导入（只添加新视频）
  const handleImport = async (pathId: number, path: string) => {
    // 如果该路径已暂停，则继续
    if (pausedPaths.has(pathId)) {
      setPausedPaths(prev => {
        const newSet = new Set(prev);
        newSet.delete(pathId);
        return newSet;
      });
      startProgressPolling(pathId);
      setSuccess('继续扫描');
      
      // 重新开始扫描
      try {
        const result = await scanVideos(path, pathId);
        setImportResult(result);
        loadStats();
      } catch (e: any) {
        setError(e.message);
        stopProgressPolling();
      }
      return;
    }
    
    // 如果该路径正在扫描，则暂停
    if (pathProgress[pathId]?.status === 'scanning' || pathProgress[pathId]?.status === 'generating_previews') {
      try {
        await stopScan(pathId);
        stopProgressPolling(pathId);
        setPausedPaths(prev => new Set(prev).add(pathId));
        setSuccess('扫描已暂停');
      } catch (e: any) {
        setError(e.message);
      }
      return;
    }
    
    // 否则开始新的扫描
    setImportResult(null);
    setError(null);
    setSuccess(null);
    
    startProgressPolling(pathId);
    
    try {
      const result = await scanVideos(path, pathId);
      setImportResult(result);
      loadStats();
    } catch (e: any) {
      setError(e.message);
      stopProgressPolling();
    }
  };

  // 生成预览图
  const handleGeneratePreviews = async (pathId: number, path: string) => {
    // 如果该路径预览图生成已暂停，则继续
    if (previewPausedPaths.has(pathId)) {
      setPreviewPausedPaths(prev => {
        const newSet = new Set(prev);
        newSet.delete(pathId);
        return newSet;
      });
      
      startProgressPolling(pathId);
      
      try {
        await generatePreviews(pathId);
        loadStats();
      } catch (e: any) {
        setError(e.message);
        stopProgressPolling(pathId);
      }
      return;
    }
    
    // 如果该路径正在生成预览图，则暂停
    if (pathProgress[pathId]?.status === 'generating_previews') {
      try {
        await stopScan(pathId);
        stopProgressPolling(pathId);
        setPreviewPausedPaths(prev => new Set(prev).add(pathId));
        setSuccess('预览图生成已暂停');
      } catch (e: any) {
        setError(e.message);
      }
      return;
    }
    
    // 否则开始新的预览图生成
    setImportResult(null);
    setError(null);
    setSuccess(null);
    
    startProgressPolling(pathId);
    
    try {
      await generatePreviews(pathId);
      loadStats();
    } catch (e: any) {
      setError(e.message);
      stopProgressPolling(pathId);
    }
  };

  // 清除路径数据（不删除路径配置）
  const handleClearPath = async (id: number) => {
    try {
      // 清除该路径的进度状态
      setPathProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[id];
        return newProgress;
      });
      
      // 清除暂停状态
      setPausedPaths(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      
      await clearVideoPath(id);
      loadStats();
      setSuccess('路径数据已清除');
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 一键导入（每个路径分别进行扫描、生图操作）
  const handleBatchImport = async () => {
    // 如果有任何路径已暂停，则继续所有
    if (pausedPaths.size > 0) {
      for (const pathId of pausedPaths) {
        setPausedPaths(prev => {
          const newSet = new Set(prev);
          newSet.delete(pathId);
          return newSet;
        });
        startProgressPolling(pathId);
        
        // 重新开始扫描该路径
        const pathItem = paths.find(p => p.id === pathId);
        if (pathItem) {
          try {
            const result = await scanVideos(pathItem.path, pathId);
            setImportResult(result);
            loadStats();
          } catch (e: any) {
            setError(e.message);
            stopProgressPolling(pathId);
          }
        }
      }
      setSuccess('继续所有扫描');
      return;
    }
    
    // 如果有任何路径正在扫描，则暂停所有
    const hasActiveScan = paths.some(p => 
      pathProgress[p.id]?.status === 'scanning' || pathProgress[p.id]?.status === 'generating_previews'
    );
    
    if (hasActiveScan) {
      // 收集需要暂停的路径ID
      const pathsToPause = paths.filter(pathItem => 
        pathProgress[pathItem.id]?.status === 'scanning' || pathProgress[pathItem.id]?.status === 'generating_previews'
      );
      
      // 并行停止所有正在扫描的路径
      const stopPromises = pathsToPause.map(async (pathItem) => {
        try {
          await stopScan(pathItem.id);
          stopProgressPolling(pathItem.id);
        } catch (e) {
          // 忽略错误
        }
      });
      
      // 同时停止批量扫描（设置全局标志）
      stopPromises.push(stopScan(undefined).catch(() => {}));
      
      await Promise.all(stopPromises);
      
      // 一次性更新暂停状态
      setPausedPaths(prev => {
        const newSet = new Set(prev);
        pathsToPause.forEach(p => newSet.add(p.id));
        return newSet;
      });
      
      setSuccess('所有扫描已暂停');
      return;
    }
    
    // 否则开始新的批量扫描
    setImportResult(null);
    setError(null);
    setSuccess(null);
    
    // 为每个路径启动独立的轮询
    for (const pathItem of paths) {
      startProgressPolling(pathItem.id);
    }
    
    // 逐个处理每个路径
    for (let i = 0; i < paths.length; i++) {
      const pathItem = paths[i];
      
      // 设置其他路径为"排队中"
      for (let j = i + 1; j < paths.length; j++) {
        const progress = { status: 'scanning', current: 0, total: 0, phase: '排队中...', videoCount: 0 };
        setPathProgress(prev => ({
          ...prev,
          [paths[j].id]: progress
        }));
      }
      
      try {
        const result = await scanVideos(pathItem.path, pathItem.id);
        setImportResult(result);
        loadStats();
      } catch (e: any) {
        setError(e.message);
      }
    }
  };

  // 一键清除数据（每个路径分别清除数据）
  const handleBatchClear = async () => {
    setImportResult(null);
    setError(null);
    setSuccess(null);
    
    for (const pathItem of paths) {
      try {
        await handleClearPath(pathItem.id);
      } catch (e: any) {
        setError(e.message);
      }
    }
    
    setSuccess('所有路径数据已清除');
  };

  // 一键删除（每个路径分别删除）
  const handleBatchDelete = async () => {
    setImportResult(null);
    setError(null);
    setSuccess(null);
    
    // 逐个处理每个路径
    for (const pathItem of paths) {
      try {
        await handleDeletePath(pathItem.id);
      } catch (e: any) {
        setError(e.message);
      }
    }
    
    setSuccess('所有路径已删除');
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newPath.trim()) {
                handleAddPath();
              }
            }}
            placeholder="输入视频文件夹路径，如: D:\Videos"
            className="flex-1 h-10 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 border-none outline-none text-sm"
          />
          <button
            onClick={handleAddPath}
            className="h-10 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
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
                  
                  {/* 路径状态 */}
                  <div className="flex-1 mx-4">
                    {(progress.status !== 'idle' || pausedPaths.has(p.id)) && (
                      <span className={`text-xs whitespace-nowrap ${
                        pausedPaths.has(p.id)
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : progress.status === 'completed' 
                            ? 'text-green-600 dark:text-green-400' 
                            : progress.status === 'error' 
                              ? 'text-red-600 dark:text-red-400' 
                              : 'text-pink-600 dark:text-pink-400'
                      }`}>
                        {progress.phase || (
                          progress.status === 'scanning' 
                            ? `扫描视频文件(${progress.current}/${progress.total})...` 
                            : progress.status === 'generating_previews' 
                              ? `生成预览图(${progress.current}/${progress.total})...` 
                              : progress.status === 'completed' 
                                ? `已完成(${progress.videoCount}个视频)` 
                                : progress.status === 'error' 
                                  ? '失败' 
                                  : ''
                        )}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleImport(p.id, p.path)}
                      disabled={isAnyPathScanning && !pausedPaths.has(p.id) && pathProgress[p.id]?.status !== 'scanning' && pathProgress[p.id]?.status !== 'generating_previews'}
                      className={`h-8 px-3 rounded text-xs font-medium transition-colors ${
                        pausedPaths.has(p.id)
                          ? 'bg-green-100 text-green-600 hover:bg-green-200 cursor-pointer'
                          : (pathProgress[p.id]?.status === 'scanning' || pathProgress[p.id]?.status === 'generating_previews')
                            ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200 cursor-pointer'
                            : isAnyPathScanning
                              ? 'bg-primary/10 text-primary opacity-50 cursor-not-allowed'
                              : 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
                      }`}
                      title={
                        pausedPaths.has(p.id)
                          ? '继续导入'
                          : (pathProgress[p.id]?.status === 'scanning' || pathProgress[p.id]?.status === 'generating_previews')
                            ? '暂停导入'
                            : '导入数据和封面'
                      }
                    >
                      {pausedPaths.has(p.id)
                        ? '继续'
                        : (pathProgress[p.id]?.status === 'scanning' || pathProgress[p.id]?.status === 'generating_previews')
                          ? '暂停'
                          : '导入'
                      }
                    </button>
                    <button
                      onClick={() => handleGeneratePreviews(p.id, p.path)}
                      disabled={isAnyPathScanning && !previewPausedPaths.has(p.id) && pathProgress[p.id]?.status !== 'generating_previews'}
                      className={`h-8 px-3 rounded text-xs font-medium transition-colors ${
                        previewPausedPaths.has(p.id)
                          ? 'bg-green-100 text-green-600 hover:bg-green-200 cursor-pointer'
                          : pathProgress[p.id]?.status === 'generating_previews'
                            ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200 cursor-pointer'
                            : isAnyPathScanning
                              ? 'bg-purple-100 text-purple-600 opacity-50 cursor-not-allowed'
                              : 'bg-purple-100 text-purple-600 hover:bg-purple-200 cursor-pointer'
                      }`}
                      title={
                        previewPausedPaths.has(p.id)
                          ? '继续生成预览图'
                          : pathProgress[p.id]?.status === 'generating_previews'
                            ? '暂停生成预览图'
                            : '生成预览图'
                      }
                    >
                      {previewPausedPaths.has(p.id)
                        ? '继续'
                        : pathProgress[p.id]?.status === 'generating_previews'
                          ? '暂停'
                          : '预览图'
                      }
                    </button>
                    <button
                      onClick={() => handleClearPath(p.id)}
                      disabled={isAnyPathImporting}
                      className={`h-8 px-3 rounded text-xs font-medium transition-colors ${
                        isAnyPathImporting
                          ? 'bg-orange-100 text-orange-600 opacity-50 cursor-not-allowed'
                          : 'bg-orange-100 text-orange-600 hover:bg-orange-200 cursor-pointer'
                      }`}
                      title="清除该路径的数据，不删除路径配置"
                    >
                      清除数据
                    </button>
                    <button
                      onClick={() => handleDeletePath(p.id)}
                      disabled={isAnyPathImporting}
                      className={`h-8 px-3 rounded text-xs font-medium transition-colors ${
                        isAnyPathImporting
                          ? 'bg-red-100 text-red-600 opacity-50 cursor-not-allowed'
                          : 'bg-red-100 text-red-600 hover:bg-red-200 cursor-pointer'
                      }`}
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

        {/* 一键操作按钮 */}
        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleBatchImport}
            disabled={paths.length === 0}
            className={`h-10 px-6 rounded-lg text-sm font-medium transition-colors ${
              pausedPaths.size > 0
                ? 'bg-green-500 text-white hover:bg-green-600 cursor-pointer'
                : isAnyPathScanning
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600 cursor-pointer'
                  : paths.length === 0
                    ? 'bg-primary text-white opacity-50 cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary/90 cursor-pointer'
            }`}
            title={
              pausedPaths.size > 0
                ? '继续所有扫描'
                : isAnyPathScanning
                  ? '暂停所有扫描'
                  : '一键导入所有路径，只添加新视频'
            }
          >
            {pausedPaths.size > 0
              ? '一键继续'
              : isAnyPathScanning
                ? '一键暂停'
                : '一键导入'
            }
          </button>
          <button
            onClick={handleBatchClear}
            disabled={paths.length === 0 || isAnyPathScanning}
            className={`h-10 px-6 rounded-lg text-sm font-medium transition-colors ${
              paths.length === 0 || isAnyPathScanning
                ? 'bg-orange-500 text-white opacity-50 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600 cursor-pointer'
            }`}
            title="一键清除所有路径的数据，不删除路径配置"
          >
            一键清除数据
          </button>
          <button
            onClick={handleBatchDelete}
            disabled={paths.length === 0 || isAnyPathScanning}
            className={`h-10 px-6 rounded-lg text-sm font-medium transition-colors ${
              paths.length === 0 || isAnyPathScanning
                ? 'bg-red-500 text-white opacity-50 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600 cursor-pointer'
            }`}
            title="一键删除所有路径"
          >
            一键删除
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
