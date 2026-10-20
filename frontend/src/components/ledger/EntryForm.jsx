import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ArrowDownLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api, ApiError } from '../../services/api.js';
import { amountString, categories, today } from '../../utils/format.js';
import { Button, Field, FormError } from '../UI.jsx';
import { useToast } from '../Toast.jsx';
import { useOnline } from '../../hooks/useOnline.js';
export function EntryForm({ type = 'in', entry, onSuccess, onAmountChange }) {
  const { user } = useAuth(),
    client = useQueryClient(),
    notify = useToast(),
    online = useOnline(),
    key = useRef(crypto.randomUUID());
  const defaults = () => ({
    type,
    amount: '',
    title: '',
    category: categories[type][0],
    occurredOn: today(user.timezone),
    note: '',
  });
  const [form, setForm] = useState(() =>
    entry
      ? {
          type: entry.type,
          amount: amountString(entry.amountMinor),
          title: entry.title,
          category: entry.category,
          occurredOn: entry.occurredOn,
          note: entry.note,
        }
      : defaults(),
  );
  const [localError, setLocalError] = useState(null);
  const mutation = useMutation({
    mutationFn: (data) =>
      api(entry ? `/entries/${entry.id}` : '/entries', {
        method: entry ? 'PATCH' : 'POST',
        body: entry ? { ...data, version: entry.version } : data,
        headers: entry ? {} : { 'Idempotency-Key': key.current },
      }),
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: ['entries'] });
      client.invalidateQueries({ queryKey: ['dashboard'] });
      client.invalidateQueries({ queryKey: ['history'] });
      notify(entry ? 'Entry updated.' : `Cash ${form.type} recorded. ${result.entry.reference}`);
      if (!entry) {
        setForm(defaults());
        key.current = crypto.randomUUID();
        onAmountChange?.(0);
      }
      onSuccess?.();
    },
  });
  const change = (event) => {
    const { name, value } = event.target;
    const next = {
      ...form,
      [name]: value,
      ...(name === 'type' ? { category: categories[value][0] } : {}),
    };
    setForm(next);
    key.current = crypto.randomUUID();
    setLocalError(null);
    mutation.reset();
    if (name === 'amount') onAmountChange?.(Math.round(Number(value) * 100) || 0);
  };
  const submit = (event) => {
    event.preventDefault();
    if (!/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(form.amount) || Number(form.amount) <= 0) {
      setLocalError(
        new ApiError(
          'Enter a positive amount with at most two decimal places.',
          400,
          'VALIDATION_ERROR',
          { amount: 'Enter a positive amount with at most two decimal places.' },
        ),
      );
      return;
    }
    setLocalError(null);
    mutation.mutate(form);
  };
  const error = localError || mutation.error;
  return (
    <form onSubmit={submit} className="entry-form">
      <FormError error={error} />
      <fieldset disabled={mutation.isPending || !online} className="fieldset-reset">
        <div className={`amount-field ${form.type}`}>
          <label htmlFor={entry ? 'edit-amount' : 'entry-amount'}>
            Amount <span>{user.currency}</span>
          </label>
          <div className="amount-input">
            <span>{user.currency === 'PKR' ? 'Rs' : user.currency}</span>
            <input
              id={entry ? 'edit-amount' : 'entry-amount'}
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={form.amount}
              onChange={change}
              required
              aria-invalid={!!error?.fields?.amount}
            />
          </div>
          <small>
            {entry
              ? 'Update the amount for this entry.'
              : form.type === 'in'
                ? 'How much money came in?'
                : 'How much money went out?'}
          </small>
        </div>
        {entry && (
          <Field label="Entry type">
            <select name="type" value={form.type} onChange={change}>
              <option value="in">Cash in</option>
              <option value="out">Cash out</option>
            </select>
          </Field>
        )}
        <Field label="Description" error={error?.fields?.title}>
          <input
            name="title"
            value={form.title}
            onChange={change}
            placeholder={
              form.type === 'in' ? 'e.g. Payment from a client' : 'e.g. Monthly office rent'
            }
            required
            minLength={2}
            maxLength={100}
          />
        </Field>
        <div className="form-grid">
          <Field label="Category" error={error?.fields?.category}>
            <select name="category" value={form.category} onChange={change}>
              {categories[form.type].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Date" error={error?.fields?.occurredOn}>
            <input
              type="date"
              name="occurredOn"
              value={form.occurredOn}
              onChange={change}
              required
              min="2000-01-01"
              max={today(user.timezone)}
            />
          </Field>
        </div>
        <Field
          label={
            <span>
              Note <span className="optional">optional</span>
            </span>
          }
          error={error?.fields?.note}
        >
          <textarea
            name="note"
            rows={3}
            value={form.note}
            onChange={change}
            maxLength={500}
            placeholder="Anything you’d like to remember…"
          />
        </Field>
        <div className="entry-form-footer">
          <span>
            <ShieldCheck size={15} /> Visible only to you
          </span>
          <Button
            variant={form.type === 'out' ? 'coral' : 'primary'}
            loading={mutation.isPending}
            disabled={!online}
          >
            {entry ? (
              <Check size={18} />
            ) : form.type === 'in' ? (
              <ArrowDownLeft size={18} />
            ) : (
              <ArrowUpRight size={18} />
            )}{' '}
            {entry ? 'Save changes' : `Record cash ${form.type}`}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
