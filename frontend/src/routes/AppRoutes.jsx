import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Layout } from '../components/Layout.jsx';
import { Spinner, ErrorState } from '../components/UI.jsx';
const AuthPage = lazy(() => import('../pages/AuthPage.jsx'));
const Dashboard = lazy(() => import('../pages/Dashboard.jsx'));
const CashPage = lazy(() => import('../pages/CashPage.jsx'));
const Transactions = lazy(() => import('../pages/Transactions.jsx'));
const Settings = lazy(() => import('../pages/Settings.jsx'));
function Protected() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
function Guest() {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : <Outlet />;
}
export function App() {
  const { loading, error, refresh } = useAuth(),
    location = useLocation();
  useEffect(() => {
    const titles = {
      '/': 'Overview',
      '/cash-in': 'Cash in',
      '/cash-out': 'Cash out',
      '/transactions': 'Transactions',
      '/settings': 'Settings',
      '/login': 'Sign in',
      '/register': 'Create an account',
    };
    document.title = `${titles[location.pathname] || 'Your money, clearly'} · Cashbook`;
    window.scrollTo(0, 0);
  }, [location.pathname]);
  if (loading) return <Spinner />;
  if (error)
    return (
      <div className="connection-screen">
        <ErrorState error={error} retry={refresh} />
      </div>
    );
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Guest />}>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage register />} />
        </Route>
        <Route element={<Protected />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="cash-in" element={<CashPage type="in" key="in" />} />
            <Route path="cash-out" element={<CashPage type="out" key="out" />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
