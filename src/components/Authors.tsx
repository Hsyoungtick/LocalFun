import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { getAuthors, Author } from '../api';
import PageLayout from './PageLayout';

export default function Authors() {
  const navigate = useNavigate();
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuthors()
      .then(setAuthors)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAuthorClick = (authorName: string) => {
    navigate(`/authors/${encodeURIComponent(authorName)}`);
  };

  return (
    <PageLayout
      title="作者"
      titleIcon="person"
      loading={loading}
      emptyIcon="person"
      emptyText="暂无作者"
    >
      {authors.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {authors.map((author) => (
            <div
              key={author.id}
              onClick={() => handleAuthorClick(author.name)}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow"
            >
              <span className="material-symbols-outlined text-2xl text-primary">person</span>
              <div className="font-medium text-slate-900 dark:text-slate-100">{author.name}</div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
