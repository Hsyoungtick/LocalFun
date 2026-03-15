import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { getCategories, Category } from '../api';
import PageLayout from './PageLayout';

export default function Categories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout
      title="全部分类"
      titleIcon="category"
      loading={loading}
      emptyIcon="category"
      emptyText="暂无分类"
    >
      {categories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow"
          >
            <span className="material-symbols-outlined text-2xl text-primary">video_library</span>
            <div className="font-medium text-slate-900 dark:text-slate-100">全部视频</div>
          </div>
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => navigate('/')}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow"
            >
              <span className="material-symbols-outlined text-2xl text-primary">folder</span>
              <div className="font-medium text-slate-900 dark:text-slate-100">{cat.name}</div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
