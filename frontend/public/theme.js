try {
  const theme = localStorage.getItem('cashbook-theme') || 'system';
  document.documentElement.dataset.theme =
    theme === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
} catch {
  document.documentElement.dataset.theme = 'light';
}
