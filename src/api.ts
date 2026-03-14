const API_BASE = 'http://localhost:3001/api';

// 视频数据类型
export interface Video {
  id: number;
  title: string;
  duration: string;
  durationSeconds: number;
  thumbnail: string | null;
  author: string;
  authorAvatar?: string;
  views: string;
  viewsCount: number;
  time: string;
  fileSize: string;
  category: string;
  width?: number;
  height?: number;
}

export interface VideoDetail {
  id: number;
  title: string;
  description?: string;
  duration: string;
  durationSeconds: number;
  thumbnail: string | null;
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
    avatar?: string;
    description?: string;
  };
  relatedVideos: {
    id: number;
    title: string;
    duration: string;
    thumbnail: string | null;
    views: string;
  }[];
}

export interface Author {
  id: number;
  name: string;
  avatar?: string;
  description?: string;
  videoCount?: number;
  totalVideos?: number;
  totalViews?: string;
  videos?: {
    id: number;
    title: string;
    duration: string;
    thumbnail: string | null;
    views: string;
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
export async function addVideoPath(path: string): Promise<VideoPath> {
  const response = await fetch(`${API_BASE}/paths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 删除视频路径
export async function deleteVideoPath(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/paths/${id}`, { method: 'DELETE' });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}

// 扫描视频
export async function scanVideos(path?: string): Promise<{ added: number; total: number }> {
  const response = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 重新扫描指定路径（清除缓存后重新扫描）
export async function rescanVideos(path: string): Promise<{ added: number; total: number }> {
  const response = await fetch(`${API_BASE}/rescan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
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

// 获取封面URL
export function getThumbnailUrl(thumbnail: string | null): string {
  if (!thumbnail) return '';
  if (thumbnail.startsWith('http')) return thumbnail;
  return `http://localhost:3001${thumbnail}`;
}

// 清除缓存
export async function clearCache(): Promise<void> {
  const response = await fetch(`${API_BASE}/clear-cache`, {
    method: 'POST'
  });
  const data = await response.json();
  
  if (!data.success) throw new Error(data.error);
}
