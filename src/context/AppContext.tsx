import { createContext, useContext, useState, ReactNode } from 'react';

interface AppContextType {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilter: 'all' | 'favorites' | 'history';
  setActiveFilter: (filter: 'all' | 'favorites' | 'history') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'history'>('all');

  return (
    <AppContext.Provider value={{ selectedCategory, setSelectedCategory, searchQuery, setSearchQuery, activeFilter, setActiveFilter }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
