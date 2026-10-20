import { createContext, useContext, useEffect, useState } from 'react';
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('cashbook-theme') || 'system';
    } catch {
      return 'system';
    }
  });
  const [resolved, setResolved] = useState(document.documentElement.dataset.theme || 'light');
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const mode = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = mode;
      setResolved(mode);
      try {
        localStorage.setItem('cashbook-theme', theme);
      } catch {}
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        resolved,
        toggle: () => setTheme(resolved === 'dark' ? 'light' : 'dark'),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
