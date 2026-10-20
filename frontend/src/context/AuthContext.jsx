import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setCsrf } from '../services/api.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null);
  const client = useQueryClient(),
    channel = useRef(null),
    generation = useRef(0),
    pending = useRef(null);
  const clear = useCallback(() => {
    generation.current++;
    pending.current?.abort();
    client.cancelQueries();
    client.clear();
    setCsrf(null);
    setUser(null);
    setError(null);
    setLoading(false);
  }, [client]);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setError(null);
    try {
      const result = await api('/auth/me', { signal: controller.signal });
      if (current === generation.current) {
        setUser(result.user);
        setCsrf(result.csrfToken);
      }
    } catch (err) {
      if (current === generation.current && !controller.signal.aborted) {
        if (err.status === 401) clear();
        else setError(err);
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [clear]);
  useEffect(() => {
    refresh();
    const expired = () => clear();
    window.addEventListener('cashbook:unauthenticated', expired);
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('cashbook-auth');
      channel.current.onmessage = (e) => {
        clear();
        if (e.data !== 'logout') {
          setLoading(true);
          refresh();
        }
      };
    }
    return () => {
      pending.current?.abort();
      window.removeEventListener('cashbook:unauthenticated', expired);
      channel.current?.close();
    };
  }, [refresh, clear]);
  const accept = (result) => {
    clear();
    setUser(result.user);
    setCsrf(result.csrfToken);
    channel.current?.postMessage('refresh');
  };
  const logout = async (all = false) => {
    await api(all ? '/auth/logout-all' : '/auth/logout', { method: 'POST' });
    clear();
    channel.current?.postMessage('logout');
  };
  return (
    <AuthContext.Provider value={{ user, loading, error, refresh, accept, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
