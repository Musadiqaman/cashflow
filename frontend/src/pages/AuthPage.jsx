import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Moon,
  Sun,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Brand } from '../components/Brand.jsx';
import { Button, Field, FormError } from '../components/UI.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
export default function AuthPage({ register = false }) {
  const { accept } = useAuth(),
    { toggle, resolved } = useTheme();
  const [show, setShow] = useState(false),
    [form, setForm] = useState({ name: '', email: '', password: '', currency: 'PKR' });
  const mutation = useMutation({
    mutationFn: (data) =>
      api(register ? '/auth/register' : '/auth/login', { method: 'POST', body: data }),
    onSuccess: (result) => accept(result),
  });
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = (event) => {
    event.preventDefault();
    mutation.mutate(
      register
        ? { ...form, timezone: 'Asia/Karachi' }
        : { email: form.email, password: form.password },
    );
  };
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link to="/" className="brand-link">
          <Brand />
        </Link>
        <div className="story-main">
          <span className="eyebrow">A LITTLE CLARITY. EVERY DAY.</span>
          <h1>
            Good things start
            <br />
            with a clear
            <br />
            <span>cashbook.</span>
          </h1>
          <p>
            Keep track of what comes in, what goes out, and where you stand. One calm place for your
            money.
          </p>
          <div className="story-illustration" aria-hidden="true">
            <div className="story-circle" />
            <div className="mini-card mini-in">
              <span>
                <ArrowDownLeft size={21} />
              </span>
              <div>
                <strong>Money in</strong>
                <small>Every little win, recorded.</small>
              </div>
              <Check size={18} />
            </div>
            <div className="mini-card mini-out">
              <span>
                <ArrowUpRight size={21} />
              </span>
              <div>
                <strong>Money out</strong>
                <small>Know where every rupee goes.</small>
              </div>
            </div>
            <div className="mini-chart">
              {[28, 41, 35, 56, 49, 66, 60, 85, 76, 99, 91, 118].map((h, i) => (
                <i key={i} style={{ height: h }} />
              ))}
            </div>
          </div>
        </div>
        <div className="story-bottom">
          <ShieldCheck size={18} /> Private by design. Simple by choice.
        </div>
      </section>
      <main className="auth-main">
        <button className="icon-button auth-theme" onClick={toggle} aria-label="Toggle color theme">
          {resolved === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">YOUR PERSONAL CASH SPACE</span>
          <h2>{register ? 'A fresh start, right here.' : 'Welcome back.'}</h2>
          <p className="auth-intro">
            {register
              ? 'Create your account and make your money a little clearer.'
              : 'Sign in to pick up where you left off.'}
          </p>
          <form onSubmit={submit} className="form-stack">
            <FormError error={mutation.error} />
            {register && (
              <Field label="Full name" error={mutation.error?.fields?.name}>
                <input
                  autoComplete="name"
                  name="name"
                  placeholder="Your full name"
                  minLength={2}
                  maxLength={80}
                  required
                  value={form.name}
                  onChange={change}
                />
              </Field>
            )}
            <Field label="Email address" error={mutation.error?.fields?.email}>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                maxLength={254}
                required
                value={form.email}
                onChange={change}
              />
            </Field>
            <Field
              label="Password"
              hint={register ? 'At least 12 characters. A memorable passphrase works well.' : null}
              error={mutation.error?.fields?.password}
            >
              <div className="password-input">
                <input
                  type={show ? 'text' : 'password'}
                  name="password"
                  autoComplete={register ? 'new-password' : 'current-password'}
                  placeholder={register ? 'Create a strong password' : 'Enter your password'}
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  required
                  value={form.password}
                  onChange={change}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            {register && (
              <Field
                label="Account currency"
                hint="Your ledger uses one currency. This cannot be changed later."
              >
                <select name="currency" value={form.currency} onChange={change}>
                  {['PKR', 'USD', 'AED', 'GBP', 'EUR', 'INR'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                      {c === 'PKR' ? ' — Pakistani rupee' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Button className="full-width auth-submit" loading={mutation.isPending}>
              {register ? 'Create account' : 'Sign in'}
              <ArrowRight size={18} />
            </Button>
          </form>
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New to Cashbook?'}{' '}
            <Link to={register ? '/login' : '/register'} onClick={() => mutation.reset()}>
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <p className="auth-note">
            <ShieldCheck size={14} /> Your entries are only visible to your account.
          </p>
        </div>
        <footer className="auth-footer">Less guesswork. More peace of mind.</footer>
      </main>
    </div>
  );
}
