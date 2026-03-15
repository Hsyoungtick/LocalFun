import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './components/Home';
import Profile from './components/Profile';
import VideoDetail from './components/VideoDetail';
import Settings from './components/Settings';
import Categories from './components/Categories';
import Favorites from './components/Favorites';
import History from './components/History';
import { AppProvider } from './context/AppContext';

export default function App() {
  return (
    <AppProvider>
      <Router>
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/author/:username" element={<Profile />} />
            <Route path="/video/:id" element={<VideoDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/history" element={<History />} />
          </Routes>
          <Footer />
        </div>
      </Router>
    </AppProvider>
  );
}

