import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EntryForm } from '../src/components/ledger/EntryForm.jsx';
import { EntryTable } from '../src/components/ledger/EntryTable.jsx';
import Transactions from '../src/pages/Transactions.jsx';
import Settings from '../src/pages/Settings.jsx';
import AuthPage from '../src/pages/AuthPage.jsx';
import Dashboard from '../src/pages/Dashboard.jsx';
import { ThemeProvider } from '../src/context/ThemeContext.jsx';
import { api, ApiError } from '../src/services/api.js';
const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  accept: vi.fn(),
  setUser: vi.fn(),
  logout: vi.fn(),
  user: {
    id: 'user1',
    name: 'Ayesha Khan',
    email: 'ayesha@example.com',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
  },
}));
vi.mock('../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ ...mocks, user: mocks.user }),
}));
vi.mock('../src/components/Toast.jsx', () => ({ useToast: () => mocks.notify }));
vi.mock('../src/context/PwaContext.jsx', () => ({
  usePwa: () => ({ installed: false, install: async () => false }),
}));
vi.mock('../src/services/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  api: vi.fn(),
}));
function mount(component, path = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>{component}</ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const entry = {
  id: '123',
  type: 'in',
  amountMinor: 10025,
  category: 'Sales',
  title: 'Client payment',
  note: 'Paid today',
  occurredOn: '2026-10-01',
  reference: 'CB-ABC123',
  status: 'posted',
  version: 2,
};
beforeEach(() => {
  api.mockReset();
  localStorage.clear();
  document.documentElement.dataset.theme = 'light';
});
describe('cash entry workflows', () => {
  it('submits cash in as a decimal string with an idempotency key', async () => {
    api.mockResolvedValue({ entry });
    mount(<EntryForm type="in" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Amount/), '125.50');
    await user.type(screen.getByLabelText('Description'), 'Client invoice');
    await user.click(screen.getByRole('button', { name: /Record cash in/ }));
    await waitFor(() => expect(api).toHaveBeenCalledOnce());
    expect(api.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: { type: 'in', amount: '125.50', title: 'Client invoice', category: 'Sales' },
    });
    expect(api.mock.calls[0][1].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(screen.getByLabelText(/Amount/)).toHaveValue(''));
  });
  it('offers outgoing categories on the separate cash out form', async () => {
    api.mockResolvedValue({ entry: { ...entry, type: 'out' } });
    mount(<EntryForm type="out" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Amount/), '42.25');
    await user.type(screen.getByLabelText('Description'), 'Office supplies');
    await user.selectOptions(screen.getByLabelText('Category'), 'Supplies');
    await user.click(screen.getByRole('button', { name: /Record cash out/ }));
    await waitFor(() => expect(api).toHaveBeenCalledOnce());
    expect(api.mock.calls[0][1].body.type).toBe('out');
    expect(screen.queryByRole('option', { name: 'Salary' })).not.toBeInTheDocument();
  });
  it('rejects invalid precision before sending a request', async () => {
    mount(<EntryForm />);
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '1.001' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Invoice' } });
    fireEvent.click(screen.getByRole('button', { name: /Record cash in/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('two decimal places');
    expect(api).not.toHaveBeenCalled();
  });
  it('network retry preserves idempotency key and typed fields', async () => {
    api.mockRejectedValueOnce(new ApiError('Connection lost')).mockResolvedValueOnce({ entry });
    mount(<EntryForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Amount/), '12.30');
    await user.type(screen.getByLabelText('Description'), 'Payment');
    await user.click(screen.getByRole('button', { name: /Record cash in/ }));
    await screen.findByText('Connection lost');
    await user.click(screen.getByRole('button', { name: /Record cash in/ }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(api.mock.calls[0][1].headers['Idempotency-Key']).toBe(
      api.mock.calls[1][1].headers['Idempotency-Key'],
    );
  });
  it('editing includes the current version to prevent lost updates', async () => {
    api.mockResolvedValue({ entry: { ...entry, version: 3 } });
    mount(<EntryForm entry={entry} />);
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() => expect(api).toHaveBeenCalledOnce());
    expect(api.mock.calls[0]).toEqual([
      '/entries/123',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.objectContaining({ version: 2, amount: '100.25' }),
      }),
    ]);
  });
  it('voiding requires an explicit reason and confirmation', async () => {
    api.mockImplementation((path) =>
      path.endsWith('/history')
        ? Promise.resolve({ entry, events: [] })
        : Promise.resolve({ entry: { ...entry, status: 'void' } }),
    );
    mount(<EntryTable entries={[entry]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'View Client payment' }));
    await user.click(await screen.findByRole('button', { name: 'Void this entry' }));
    await user.type(screen.getByLabelText('Reason'), 'Duplicate payment');
    await user.click(screen.getByRole('button', { name: 'Void entry' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/entries/123/void', {
        method: 'POST',
        body: { version: 2, reason: 'Duplicate payment' },
      }),
    );
  });
});
describe('account and navigation workflows', () => {
  it('login sends credentials to the backend and accepts the secure session', async () => {
    const result = { user: mocks.user, csrfToken: 'memory-only' };
    api.mockResolvedValue(result);
    mount(<AuthPage />, '/login');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'ayesha@example.com');
    await user.type(screen.getByLabelText('Password'), 'Long safe password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith(result));
    expect(localStorage.getItem('token')).toBeNull();
  });
  it('registration collects name and fixed ledger currency', async () => {
    api.mockResolvedValue({ user: mocks.user, csrfToken: 'abc' });
    mount(<AuthPage register />, '/register');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Full name'), 'Ayesha Khan');
    await user.type(screen.getByLabelText('Email address'), 'ayesha@example.com');
    await user.type(screen.getByLabelText('Password'), 'A secure passphrase');
    await user.selectOptions(screen.getByLabelText('Account currency'), 'AED');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/auth/register',
        expect.objectContaining({
          body: expect.objectContaining({ currency: 'AED', name: 'Ayesha Khan' }),
        }),
      ),
    );
  });
  it('cursor pages advance and changing filters resets to the first page', async () => {
    api.mockImplementation((path) =>
      Promise.resolve({
        items: [entry],
        nextCursor: path.includes('cursor=') ? null : 'signed-cursor',
      }),
    );
    mount(<Transactions />, '/transactions');
    const user = userEvent.setup();
    await screen.findByText('Client payment');
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        expect.stringContaining('cursor=signed-cursor'),
        expect.anything(),
      ),
    );
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cash out' }));
    await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('type=out'));
    expect(api.mock.calls.at(-1)[0]).not.toContain('cursor=');
    expect(screen.getByText('Page 1')).toBeInTheDocument();
  });
  it('empty dashboard shows real zero values and a useful first-entry action', async () => {
    api.mockImplementation((path) =>
      Promise.resolve(
        path.startsWith('/dashboard')
          ? {
              balanceMinor: 0,
              period: { inMinor: 0, outMinor: 0, count: 0 },
              previous: { inMinor: 0, outMinor: 0, count: 0 },
              series: [],
              expenses: [],
            }
          : { items: [] },
      ),
    );
    mount(<Dashboard />);
    expect(await screen.findByText('Your cash story starts here')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add cash in' })).toHaveAttribute('href', '/cash-in');
    expect(screen.queryByText('Unable to load')).not.toBeInTheDocument();
  });
  it('dark mode updates the page and persists only appearance preference', async () => {
    mount(<Settings />);
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('cashbook-theme')).toBe('dark');
    expect(localStorage.length).toBe(1);
  });
  it('password confirmation mismatch does not send an update', async () => {
    mount(<Settings />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Current password'), 'Current password 123');
    await user.type(screen.getByLabelText('New password'), 'New password 123');
    await user.type(screen.getByLabelText('Confirm new password'), 'Different password 123');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(mocks.notify).toHaveBeenCalledWith('Your new passwords do not match.', 'error');
    expect(api).not.toHaveBeenCalled();
  });
  it('password update sends current and new passwords and accepts rotated session', async () => {
    const result = { user: mocks.user, csrfToken: 'new-csrf' };
    api.mockResolvedValue(result);
    mount(<Settings />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Current password'), 'Current password 123');
    await user.type(screen.getByLabelText('New password'), 'New password 123');
    await user.type(screen.getByLabelText('Confirm new password'), 'New password 123');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/auth/password', {
        method: 'POST',
        body: { currentPassword: 'Current password 123', newPassword: 'New password 123' },
      }),
    );
    expect(mocks.accept).toHaveBeenCalledWith(result);
  });
});
