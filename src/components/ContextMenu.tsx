import { useEffect, useRef, useState } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
  label: string;
}

export default function ContextMenu({ x, y, onClose, onEdit, label }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => onClose();
    const handleResize = () => onClose();

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [onClose]);

  const handleEdit = () => {
    onEdit();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[150px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={handleEdit}
        className="w-full px-4 py-2 text-left text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        修改{label}
      </button>
    </div>
  );
}
