import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Eye, Pencil, Ban, ArrowRight, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, queryString } from '../../services/api.js';
import { dateLabel, formatMoney } from '../../utils/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useOnline } from '../../hooks/useOnline.js';
import { Button, Dialog, EmptyState, ErrorState, Field, FormError, Skeleton } from '../UI.jsx';
import { useToast } from '../Toast.jsx';
import { EntryForm } from './EntryForm.jsx';
function EntryHistory({ entry, onVoid, onEdit }) {
  const { user } = useAuth(),
    online = useOnline();
  const query = useQuery({
    queryKey: ['history', user.id, entry.id],
    queryFn: ({ signal }) => api(`/entries/${entry.id}/history`, { signal }),
  });
  const current = query.data?.entry || entry;
  return (
    <div className="entry-detail">
      <div className={`detail-amount ${current.type}`}>
        {current.type === 'in' ? '+' : '−'}
        {formatMoney(current.amountMinor, user.currency)}
      </div>
      <div className="detail-grid">
        <div>
          <small>Reference</small>
          <strong className="mono">{current.reference}</strong>
        </div>
        <div>
          <small>Entry date</small>
          <strong>{dateLabel(current.occurredOn)}</strong>
        </div>
        <div>
          <small>Category</small>
          <strong>{current.category}</strong>
        </div>
        <div>
          <small>Status</small>
          <strong className={`badge ${current.status}`}>
            {current.status === 'posted' ? 'Recorded' : 'Voided'}
          </strong>
        </div>
      </div>
      {current.note && (
        <div className="detail-note">
          <small>Note</small>
          <p>{current.note}</p>
        </div>
      )}
      {current.voidReason && (
        <div className="form-error">
          <Ban size={18} />
          <span>Voided: {current.voidReason}</span>
        </div>
      )}
      <h3 className="history-heading">
        <History size={18} /> Entry history
      </h3>
      {query.isPending ? (
        <Skeleton className="history-skeleton" />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : (
        <ol className="audit-list">
          {query.data.events.map((event) => (
            <li key={event.id}>
              <span className="audit-dot" />
              <div>
                <strong>
                  {event.action === 'create'
                    ? 'Entry recorded'
                    : event.action === 'edit'
                      ? 'Entry updated'
                      : 'Entry voided'}
                </strong>
                <small>
                  {new Date(event.createdAt).toLocaleString('en-GB', { timeZone: user.timezone })}
                </small>
                {event.action === 'edit' && (
                  <p>
                    {event.before.title} · {formatMoney(event.before.amountMinor, user.currency)} →{' '}
                    {event.after.title} · {formatMoney(event.after.amountMinor, user.currency)}
                    <br />
                    {event.after.category} · {dateLabel(event.after.occurredOn, true)}
                  </p>
                )}
                {event.reason && <p>{event.reason}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <small className="muted">Showing up to 50 recent changes.</small>
      {current.status === 'posted' && (
        <div className="dialog-footer">
          <Button variant="secondary" onClick={() => onEdit(current)} disabled={!online}>
            <Pencil size={17} /> Edit entry
          </Button>
          <Button variant="danger-ghost" onClick={() => onVoid(current)} disabled={!online}>
            <Ban size={17} /> Void this entry
          </Button>
        </div>
      )}
    </div>
  );
}
export function EntryTable({ entries = [], loading = false, error, retry, compact = false }) {
  const { user } = useAuth(),
    online = useOnline(),
    notify = useToast(),
    client = useQueryClient();
  const [editing, setEditing] = useState(null),
    [viewing, setViewing] = useState(null),
    [voiding, setVoiding] = useState(null),
    [reason, setReason] = useState('');
  const voidMutation = useMutation({
    mutationFn: () =>
      api(`/entries/${voiding.id}/void`, {
        method: 'POST',
        body: { version: voiding.version, reason },
      }),
    onSuccess: () => {
      setVoiding(null);
      setReason('');
      client.invalidateQueries({ queryKey: ['entries'] });
      client.invalidateQueries({ queryKey: ['dashboard'] });
      client.invalidateQueries({ queryKey: ['history'] });
      notify('Entry voided. Your balance has been updated.');
    },
  });
  if (loading)
    return (
      <div className="table-skeleton" role="status" aria-label="Loading transactions">
        {[1, 2, 3, 4].map((n) => (
          <Skeleton key={n} />
        ))}
      </div>
    );
  if (error) return <ErrorState error={error} retry={retry} />;
  if (!entries.length)
    return (
      <EmptyState
        title="Nothing here just yet"
        message="Your cash entries will appear here. Start with a little money in or out."
        action={
          <Link to="/cash-in" className="button secondary">
            Record your first entry <ArrowRight size={16} />
          </Link>
        }
      />
    );
  return (
    <>
      <div className={`table-scroll ${compact ? 'compact' : ''}`}>
        <table className="entry-table">
          <thead>
            <tr>
              <th scope="col">Transaction</th>
              <th scope="col" className="date-col">
                Date
              </th>
              <th scope="col" className="reference-col">
                Reference
              </th>
              <th scope="col" className="amount-col">
                Amount
              </th>
              <th scope="col" className="status-col">
                Status
              </th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className={entry.status === 'void' ? 'void-row' : ''}>
                <td>
                  <div className="entry-description">
                    <span className={`direction-icon ${entry.type}`}>
                      {entry.type === 'in' ? (
                        <ArrowDownLeft size={19} />
                      ) : (
                        <ArrowUpRight size={19} />
                      )}
                    </span>
                    <div>
                      <strong>{entry.title}</strong>
                      <small>
                        {entry.category}
                        <span className="mobile-date"> · {dateLabel(entry.occurredOn, true)}</span>
                      </small>
                    </div>
                  </div>
                </td>
                <td className="date-col">{dateLabel(entry.occurredOn, true)}</td>
                <td className="reference-col mono">{entry.reference}</td>
                <td className={`amount-col amount-${entry.type}`}>
                  {entry.type === 'in' ? '+' : '−'}
                  {formatMoney(entry.amountMinor, user.currency)}
                </td>
                <td className="status-col">
                  <span className={`badge ${entry.status}`}>
                    <i />
                    {entry.status === 'posted' ? 'Recorded' : 'Voided'}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      onClick={() => setViewing(entry)}
                      aria-label={`View ${entry.title}`}
                    >
                      <Eye size={17} />
                    </button>
                    {entry.status === 'posted' && (
                      <button
                        className="icon-button edit-action"
                        onClick={() => setEditing(entry)}
                        disabled={!online}
                        aria-label={`Edit ${entry.title}`}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit entry"
        description="Your balance and reports will update automatically."
      >
        {editing && (
          <EntryForm
            entry={editing}
            key={`${editing.id}-${editing.version}`}
            onSuccess={() => setEditing(null)}
          />
        )}
      </Dialog>
      <Dialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title || 'Entry details'}
        description="The full story behind this entry."
      >
        {viewing && (
          <EntryHistory
            entry={viewing}
            onEdit={(entry) => {
              setViewing(null);
              setEditing(entry);
            }}
            onVoid={(entry) => {
              setViewing(null);
              setVoiding(entry);
              setReason('');
              voidMutation.reset();
            }}
          />
        )}
      </Dialog>
      <Dialog
        open={!!voiding}
        onClose={() => {
          if (!voidMutation.isPending) setVoiding(null);
        }}
        title="Void this entry?"
        description="It will be removed from your balance and reports, but its history will be kept."
      >
        {voiding && (
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              voidMutation.mutate();
            }}
          >
            <div className="void-summary">
              <strong>{voiding.title}</strong>
              <span>{formatMoney(voiding.amountMinor, user.currency)}</span>
            </div>
            <FormError error={voidMutation.error} />
            <Field label="Reason">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={3}
                maxLength={200}
                required
                placeholder="Why are you voiding this entry?"
              />
            </Field>
            <div className="dialog-footer">
              <Button
                type="button"
                variant="secondary"
                disabled={voidMutation.isPending}
                onClick={() => setVoiding(null)}
              >
                Keep entry
              </Button>
              <Button variant="danger" loading={voidMutation.isPending} disabled={!online}>
                Void entry
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
export function RecentEntries({ type, title = 'Recent transactions' }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['entries', user.id, 'recent', type],
    queryFn: ({ signal }) => api(`/entries?${queryString({ type, limit: 5 })}`, { signal }),
  });
  return (
    <section className="panel recent-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>Your latest money moves, at a glance.</p>
        </div>
        <Link to={`/transactions${type ? `?type=${type}` : ''}`} className="text-link">
          View all <ArrowRight size={16} />
        </Link>
      </div>
      <EntryTable
        entries={query.data?.items}
        loading={query.isPending}
        error={query.error}
        retry={query.refetch}
        compact
      />
    </section>
  );
}
