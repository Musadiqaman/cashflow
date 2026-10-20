import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './routes/AppRoutes.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { PwaProvider } from './context/PwaContext.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import './styles/app.css';
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000,
      retry: (count, error) => (error.status >= 400 && error.status < 500 ? false : count < 1),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <ToastProvider>
            <PwaProvider>
              <BrowserRouter>
                <AuthProvider>
                  <App />
                </AuthProvider>
              </BrowserRouter>
            </PwaProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
