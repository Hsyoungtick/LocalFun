import { useState, useEffect } from 'react';

export interface VideoSettings {
  // 字幕设置
  language: string;
  model: string;
  autoRealtimeSubtitle: boolean;
  autoGenerateSubtitle: boolean;
  autoShowSubtitle: boolean;
  // 视频设置
  autoPlay: boolean;
}

const STORAGE_KEY = 'video-settings';

const defaultSettings: VideoSettings = {
  language: 'auto',
  model: '',
  autoRealtimeSubtitle: false,
  autoGenerateSubtitle: false,
  autoShowSubtitle: true,
  autoPlay: false,
};

export function useVideoSettings() {
  const [settings, setSettings] = useState<VideoSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultSettings, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load video settings:', e);
    }
    return defaultSettings;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save video settings:', e);
    }
  }, [settings]);

  const updateSettings = (updates: Partial<VideoSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}

// Whisper 支持的语言列表
export const WHISPER_LANGUAGES = [
  { code: 'auto', name: '自动检测' },
  { code: 'zh', name: '中文' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
  { code: 'es', name: '西班牙语' },
  { code: 'ru', name: '俄语' },
  { code: 'pt', name: '葡萄牙语' },
  { code: 'it', name: '意大利语' },
  { code: 'ar', name: '阿拉伯语' },
  { code: 'th', name: '泰语' },
  { code: 'vi', name: '越南语' },
];
