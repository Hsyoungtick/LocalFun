const API_BASE = 'http://localhost:3001/api';

// 智能格式化时间显示
export function formatSmartTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const oneDay = 24 * 60 * 60 * 1000;
  const twoDays = 2 * oneDay;
  const threeDays = 3 * oneDay;
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  
  if (diff < oneDay && date.getDate() === now.getDate()) {
    return `今天 ${timeStr}`;
  } else if (diff < twoDays) {
    return `昨天 ${timeStr}`;
  } else if (diff < threeDays) {
    return `前天 ${timeStr}`;
  } else {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${timeStr}`;
  }
}

// 视频数据类型
export interface Video {
  id: number;
  title: string;
  duration: string;
  durationSeconds: number;
  author: string;
  views: string;
  viewsCount: number;
  time: string;
  fileSize: string;
  category: string;
  width?: number;
  height?: number;
  lastPlayedAt?: string;
  playProgress?: number;
}

export interface VideoDetail {
  id: number;
  title: string;
  description?: string;
  duration: string;
  durationSeconds: number;
  filePath: string;
  fileSize: string;
  width?: number;
  height?: number;
  views: string;
  viewsCount: number;
  time: string;
  category: string;
  author?: {
    name: string;
    description?: string;
  };
  likeCount: number;
  isFavorite: boolean;
  favoriteFramesCount: number;
  favoriteFrames: {
    id: number;
    timeSeconds: number;
    note?: string;
  }[];
  relatedVideos: {
    id: number;
    title: string;
    duration: string;
    views: string;
  }[];
  playProgress?: number;
}

export interface Author {
  id: number;
  name: string;
  description?: string;
  videoCount?: number;
  totalVideos?: number;
  totalViews?: string;
  videos?: {
    id: number;
    title: string;
    duration: string;
    durationSeconds: number;
    views: string;
    viewsCount: number;
    time: string;
  }[];
}

export interface Category {
  id: number;
  name: string;
}

export interface VideoPath {
  id: number;
  path: string;
  enabled: boolean;
  generate_previews: boolean;
  createdAt: string;
}

// 获取视频列表
export async function getVideos(params?: {
  category?: string;
  author?: string;
  sort?: string;
  order?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ videos: Video[]; total: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.author) searchParams.set('author', params.author);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}/videos?${searchParams}`);
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 获取视频详情
export async function getVideoDetail(id: number): Promise<VideoDetail> {
  const response = await fetch(`${API_BASE}/videos/${id}`);
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 更新视频信息
export async function updateVideo(id: number, updates: {
  title?: string;
  description?: string;
  author_id?: number;
  category_id?: number;
}): Promise<void> {
  const response = await fetch(`${API_BASE}/videos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 删除视频
export async function deleteVideo(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/videos/${id}`, { method: 'DELETE' });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 获取分类列表
export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${API_BASE}/categories`);
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 获取作者列表
export async function getAuthors(): Promise<Author[]> {
  const response = await fetch(`${API_BASE}/authors`);
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 获取作者详情
export async function getAuthorDetail(name: string): Promise<Author> {
  const response = await fetch(`${API_BASE}/authors/${encodeURIComponent(name)}`);
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 创建作者
export async function createAuthor(author: { name: string; avatar?: string; description?: string }): Promise<Author> {
  const response = await fetch(`${API_BASE}/authors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(author)
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 更新作者
export async function updateAuthor(id: number, updates: { name?: string; avatar?: string; description?: string }): Promise<void> {
  const response = await fetch(`${API_BASE}/authors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 获取视频路径列表
export async function getVideoPaths(): Promise<VideoPath[]> {
  const response = await fetch(`${API_BASE}/paths`);
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 添加视频路径
export async function addVideoPath(path: string): Promise<{ added: VideoPath[]; existing: string[]; total: number }> {
  const response = await fetch(`${API_BASE}/paths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 清除路径数据（不删除路径配置）
export async function clearVideoPath(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/paths/${id}/clear`, { method: 'POST' });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 删除视频路径
export async function deleteVideoPath(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/paths/${id}`, { method: 'DELETE' });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 更新视频路径
export async function updateVideoPath(id: number, updates: { enabled?: boolean; generate_previews?: boolean }): Promise<VideoPath> {
  const response = await fetch(`${API_BASE}/paths/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 扫描视频
export async function scanVideos(path?: string, pathId?: number): Promise<{ added: number; total: number }> {
  const response = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, pathId })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 生成预览图
export async function generatePreviews(pathId: number): Promise<{ added: number; total: number }> {
  const response = await fetch(`${API_BASE}/generate-previews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pathId })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 重新扫描指定路径（清除缓存后重新扫描）
export async function rescanVideos(path: string, pathId?: number): Promise<{ added: number; total: number }> {
  const response = await fetch(`${API_BASE}/rescan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, pathId })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 获取统计信息
export async function getStats(): Promise<{
  videoCount: number;
  authorCount: number;
  totalViews: number;
  totalSize: string;
}> {
  const response = await fetch(`${API_BASE}/stats`);
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 获取视频流URL
export function getVideoStreamUrl(id: number): string {
  return `${API_BASE}/stream/${id}`;
}

// 获取封面URL（根据videoId生成）
export function getThumbnailUrl(videoId: number | null): string {
  if (!videoId) return '';
  return `http://localhost:3001/covers/${videoId}.jpg`;
}

// 清除缓存（保留路径配置）
export async function clearCache(): Promise<void> {
  const response = await fetch(`${API_BASE}/clear-cache`, {
    method: 'POST'
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 全部重新扫描（删除数据库并重新生成，保留路径配置，然后扫描）
export async function rescanAll(): Promise<{ added: number; total: number }> {
  const response = await fetch(`${API_BASE}/rescan-all`, {
    method: 'POST'
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 全部删除（删除数据库和所有数据，包括路径配置）
export async function deleteAll(): Promise<void> {
  const response = await fetch(`${API_BASE}/delete-all`, {
    method: 'POST'
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 获取扫描进度
export async function getScanProgress(pathId?: number): Promise<{
  status: 'idle' | 'scanning' | 'generating_covers' | 'generating_previews' | 'completed' | 'error';
  current: number;
  total: number;
  currentFile: string;
  message: string;
  startTime: number;
  phase: string;
  videoCount: number;
}> {
  const url = pathId ? `${API_BASE}/scan-progress?pathId=${pathId}` : `${API_BASE}/scan-progress`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 修改视频标题
export async function renameVideo(
  id: number, 
  options: { newTitle?: string; newAuthor?: string }
): Promise<void> {
  const response = await fetch(`${API_BASE}/videos/${id}/rename`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 停止扫描
export async function stopScan(pathId?: number): Promise<void> {
  const response = await fetch(`${API_BASE}/stop-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pathId })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 批量修改作者名
export async function renameAuthor(id: number, newName: string): Promise<string> {
  const response = await fetch(`${API_BASE}/authors/${id}/rename`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.message;
}

// 获取同类别视频
export async function getSameCategoryVideos(
  id: number, 
  params?: { sort?: string; order?: string; limit?: number }
): Promise<Video[]> {
  const searchParams = new URLSearchParams();
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}/videos/${id}/same-category?${searchParams}`);
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 添加喜欢帧
export async function addFavoriteFrame(id: number, timeSeconds: number, note?: string): Promise<{ id: number }> {
  const response = await fetch(`${API_BASE}/videos/${id}/favorite-frames`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeSeconds, note })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 更新喜欢帧注释
export async function updateFavoriteFrameNote(id: number, frameId: number, note?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/videos/${id}/favorite-frames/${frameId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 删除喜欢帧
export async function deleteFavoriteFrame(id: number, frameId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/videos/${id}/favorite-frames/${frameId}`, {
    method: 'DELETE'
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 重置视频数据
export async function resetVideoData(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/videos/${id}/reset`, {
    method: 'POST'
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 点赞
export async function likeVideo(id: number): Promise<{ likeCount: number }> {
  const response = await fetch(`${API_BASE}/videos/${id}/like`, {
    method: 'POST'
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 切换收藏
export async function toggleFavorite(id: number, isFavorite: boolean): Promise<void> {
  const response = await fetch(`${API_BASE}/videos/${id}/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isFavorite })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 获取收藏的视频列表
export async function getFavoriteVideos(params?: {
  sort?: string;
  order?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ videos: Video[]; total: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}/favorites?${searchParams}`);
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 获取历史记录
export async function getHistoryVideos(params?: {
  sort?: string;
  order?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ videos: Video[]; total: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}/history?${searchParams}`);
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 清空历史记录
export async function clearHistory(): Promise<void> {
  const response = await fetch(`${API_BASE}/history`, {
    method: 'DELETE'
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 记录观看历史和播放进度
export async function updatePlayHistory(
  id: number, 
  progress: number
): Promise<void> {
  const response = await fetch(`${API_BASE}/videos/${id}/play-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}
