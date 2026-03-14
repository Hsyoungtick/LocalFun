/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './components/Home';
import Profile from './components/Profile';
import VideoDetail from './components/VideoDetail';
import Settings from './components/Settings';

export default function App() {
  return (
    <Router>
      <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/author/:username" element={<Profile />} />
          <Route path="/video/:id" element={<VideoDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

