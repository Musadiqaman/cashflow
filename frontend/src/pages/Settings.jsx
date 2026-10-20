import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  UserRound,
  LockKeyhole,
  Sun,
  Moon,
  Monitor,
  Download,
  Check,
  Smartphone,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { usePwa } from '../context/PwaContext.jsx';
import { useOnline } from '../hooks/useOnline.js';
import { api } from '../services/api.js';
import { initials } from '../utils/format.js';
import { Button, Field, FormError, Dialog } from '../components/UI.jsx';
import { useToast } from '../components/Toast.jsx';
export default function Settings() {
  const { user, setUser, accept, logout } = useAuth(),
    { theme, setTheme } = useTheme(),
    pwa = usePwa(),
    online = useOnline(),
    notify = useToast();
  const [profile, setProfile] = useState({ name: user.name, timezone: user.timezone }),
    [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' }),
    [confirmation, setConfirmation] = useState(null),
    [signingOut, setSigningOut] = useState(false),
    [showInstall, setShowInstall] = useState(false);
  const profileMutation = useMutation({
    mutationFn: (data) => api('/auth/profile', { method: 'PATCH', body: data }),
    onSuccess: (result) => {
      setUser(result.user);
      notify('Your profile has been updated.');
    },
  });
  const passwordMutation = useMutation({
    mutationFn: (data) => api('/auth/password', { method: 'POST', body: data }),
    onSuccess: (result) => {
      accept(result);
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      notify('Password updated. All other sessions were signed out.');
    },
  });
  const updatePassword = (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirm) {
      notify('Your new passwords do not match.', 'error');
      return;
    }
    passwordMutation.mutate({
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    });
  };
  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout(confirmation === 'all');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSigningOut(false);
      setConfirmation(null);
    }
  };
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h1>Settings</h1>
          <p>A few things to make Cashbook feel more like you.</p>
        </div>
        <span className="settings-user-avatar">{initials(user.name)}</span>
      </div>
      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="setting-section-heading">
            <span className="setting-icon">
              <UserRound size={21} />
            </span>
            <div>
              <h2>Personal details</h2>
              <p>Your name, your account, your time.</p>
            </div>
          </div>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              profileMutation.mutate(profile);
            }}
          >
            <FormError error={profileMutation.error} />
            <Field label="Full name">
              <input
                value={profile.name}
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </Field>
            <Field label="Email address" hint="This is your sign-in address.">
              <input value={user.email} readOnly disabled type="email" />
            </Field>
            <div className="form-grid">
              <Field label="Currency" hint="Fixed for this ledger.">
                <input value={user.currency} readOnly disabled />
              </Field>
              <Field label="Timezone">
                <select
                  value={profile.timezone}
                  onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                >
                  {[
                    'Asia/Karachi',
                    'Asia/Dubai',
                    'Asia/Kolkata',
                    'Europe/London',
                    'America/New_York',
                    'UTC',
                  ].map((zone) => (
                    <option key={zone}>{zone}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="setting-form-footer">
              <Button loading={profileMutation.isPending} disabled={!online}>
                <Check size={17} /> Save profile
              </Button>
            </div>
          </form>
        </section>
        <section className="panel settings-card">
          <div className="setting-section-heading">
            <span className="setting-icon">
              <LockKeyhole size={21} />
            </span>
            <div>
              <h2>Password & security</h2>
              <p>Keep your private space private.</p>
            </div>
          </div>
          <form className="form-stack" onSubmit={updatePassword}>
            <FormError error={passwordMutation.error} />
            <Field label="Current password">
              <input
                type="password"
                value={passwords.currentPassword}
                autoComplete="current-password"
                required
                maxLength={128}
                onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              />
            </Field>
            <Field
              label="New password"
              hint="Use at least 12 characters. Try a memorable passphrase."
            >
              <input
                type="password"
                value={passwords.newPassword}
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                value={passwords.confirm}
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              />
            </Field>
            <div className="security-note">
              <ShieldCheck size={16} />
              <span>Changing your password signs out all other sessions.</span>
            </div>
            <div className="setting-form-footer">
              <Button variant="secondary" loading={passwordMutation.isPending} disabled={!online}>
                Update password
              </Button>
            </div>
          </form>
        </section>
        <section className="panel settings-card">
          <div className="setting-section-heading">
            <span className="setting-icon">
              <Sun size={21} />
            </span>
            <div>
              <h2>Appearance</h2>
              <p>A comfortable view, day or night.</p>
            </div>
          </div>
          <div className="theme-options">
            {[
              ['light', 'Light', Sun],
              ['dark', 'Dark', Moon],
              ['system', 'System', Monitor],
            ].map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`theme-option ${theme === value ? 'selected' : ''}`}
                aria-pressed={theme === value}
              >
                <div className={`theme-preview ${value}`}>
                  <span />
                  <div>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <span>
                  <Icon size={16} />
                  {label}
                  {theme === value && <Check size={16} />}
                </span>
              </button>
            ))}
          </div>
          <p className="setting-description">System follows your device’s appearance setting.</p>
        </section>
        <section className="panel settings-card install-card">
          <div className="setting-section-heading">
            <span className="setting-icon">
              <Smartphone size={21} />
            </span>
            <div>
              <h2>Cashbook, one tap away</h2>
              <p>A little less browser. A lot more app.</p>
            </div>
          </div>
          <p>
            Add Cashbook to your home screen for a focused, app-like experience on your phone or
            computer.
          </p>
          <div className="install-benefits">
            <span>
              <Check size={15} /> Full-screen workspace
            </span>
            <span>
              <Check size={15} /> Quick home-screen access
            </span>
          </div>
          <Button
            variant="secondary"
            disabled={pwa.installed}
            onClick={async () => {
              if (!(await pwa.install())) setShowInstall(true);
            }}
          >
            {pwa.installed ? <Check size={17} /> : <Download size={17} />}{' '}
            {pwa.installed ? 'App installed' : 'Install Cashbook'}
          </Button>
          <small className="muted">
            An internet connection is required to view and save entries.
          </small>
        </section>
      </div>
      <section className="panel session-panel">
        <div>
          <h2>Account sessions</h2>
          <p>Finished for now? Sign out on this device, or on every device.</p>
        </div>
        <div className="heading-actions">
          <Button variant="secondary" onClick={() => setConfirmation('this')}>
            <LogOut size={17} /> Sign out
          </Button>
          <Button variant="danger-ghost" onClick={() => setConfirmation('all')}>
            Sign out everywhere
          </Button>
        </div>
      </section>
      <Dialog
        open={!!confirmation}
        onClose={() => !signingOut && setConfirmation(null)}
        title={confirmation === 'all' ? 'Sign out everywhere?' : 'Sign out of Cashbook?'}
        description={
          confirmation === 'all'
            ? 'All your active sessions, including this one, will end.'
            : 'Your saved entries will be here when you return.'
        }
      >
        <div className="dialog-footer">
          <Button variant="secondary" disabled={signingOut} onClick={() => setConfirmation(null)}>
            Stay here
          </Button>
          <Button loading={signingOut} onClick={signOut}>
            Sign out
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={showInstall}
        onClose={() => setShowInstall(false)}
        title="Install Cashbook"
        description="Open the deployed HTTPS site in your regular browser."
      >
        <div className="install-instructions">
          <p>
            <strong>Android / Chrome:</strong> Open the browser menu and choose “Install app” or
            “Add to Home screen”.
          </p>
          <p>
            <strong>iPhone / Safari:</strong> Tap Share, then “Add to Home Screen”.
          </p>
          <p>
            <strong>Desktop:</strong> Use the install icon in the browser’s address bar, or its Apps
            menu.
          </p>
          <p className="muted">
            The install option depends on your browser and becomes available on HTTPS or localhost.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
