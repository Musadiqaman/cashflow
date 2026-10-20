import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/context/AuthContext.jsx';
import { api } from '../src/services/api.js';
vi.mock('../src/services/api.js', () => ({ api: vi.fn(), setCsrf: vi.fn() }));
function Probe() {
  const { user, loading } = useAuth();
  return <p>{loading ? 'Loading' : user ? user.name : 'Signed out'}</p>;
}
it('a stale bootstrap response cannot restore a signed-out account', async () => {
  let finish;
  api.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  expect(screen.getByText('Loading')).toBeInTheDocument();
  act(() => window.dispatchEvent(new Event('cashbook:unauthenticated')));
  expect(screen.getByText('Signed out')).toBeInTheDocument();
  await act(async () => finish({ user: { id: '1', name: 'Old account' }, csrfToken: 'old' }));
  expect(screen.getByText('Signed out')).toBeInTheDocument();
  expect(screen.queryByText('Old account')).not.toBeInTheDocument();
});
