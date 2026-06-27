'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Theme } from '@/lib/types';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
});

// 根据时间判断应该是亮色还是暗色
// 6:00-18:00 亮色，18:00-6:00 暗色
function getTimeBasedTheme(): 'light' | 'dark' {
  const hour = new Date().getHours();
  return (hour >= 6 && hour < 18) ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) {
      setThemeState(stored);
    }
  }, []);

  const applyTheme = useCallback((resolved: 'light' | 'dark') => {
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setResolvedTheme(resolved);
  }, []);

  useEffect(() => {
    if (theme === 'system') {
      // 系统模式：根据时间自动切换
      const applyTimeTheme = () => {
        applyTheme(getTimeBasedTheme());
      };
      
      applyTimeTheme();
      
      // 每分钟检查一次时间变化
      const interval = setInterval(applyTimeTheme, 60000);
      
      return () => clearInterval(interval);
    } else if (theme === 'light' || theme === 'dark') {
      applyTheme(theme);
    }
  }, [theme, applyTheme]);

  function handleSetTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem('theme', t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
