import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, ArrowRight, CheckCircle2, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { formatMoney } from '../utils/format.js';
import { EntryForm } from '../components/ledger/EntryForm.jsx';
import { RecentEntries } from '../components/ledger/EntryTable.jsx';
export default function CashPage({ type }) {
  const { user } = useAuth(),
    [draft, setDraft] = useState(0);
  const query = useQuery({
    queryKey: ['dashboard', user.id, 'current'],
    queryFn: ({ signal }) => api('/dashboard', { signal }),
  });
  const incoming = type === 'in',
    Icon = incoming ? ArrowDownLeft : ArrowUpRight;
  return (
    <div className={`page cash-page ${type}`}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {incoming ? 'WELCOME THE GOOD STUFF' : 'KEEP EVERY EXPENSE IN VIEW'}
          </span>
          <h1>
            Cash {type}
            <span className={`heading-icon ${type}`}>
              <Icon size={26} />
            </span>
          </h1>
          <p>
            {incoming
              ? 'A payment, a sale, a little extra. Give it a place in your cashbook.'
              : 'From everyday essentials to bigger plans. Make a note of it here.'}
          </p>
        </div>
        <Link to={incoming ? '/cash-out' : '/cash-in'} className="button secondary">
          Switch to cash {incoming ? 'out' : 'in'} <ArrowRight size={17} />
        </Link>
      </div>
      <div className="cash-grid">
        <section className="panel entry-panel">
          <div className="panel-heading">
            <div>
              <h2>New cash {type} entry</h2>
              <p>Just the details that matter.</p>
            </div>
            <span className={`direction-icon ${type}`}>
              <Icon size={21} />
            </span>
          </div>
          <EntryForm type={type} onAmountChange={setDraft} />
        </section>
        <aside className="cash-aside">
          <div className="balance-preview">
            <span className="balance-label">
              <Wallet size={18} /> Your balance
            </span>
            <strong>
              {query.data ? formatMoney(query.data.balanceMinor, user.currency) : '—'}
            </strong>
            <p>Available cash from all recorded entries.</p>
            <div className="balance-preview-rule" />
            <div className="preview-row">
              <span>This cash {type}</span>
              <b>
                {incoming ? '+' : '−'}
                {formatMoney(draft, user.currency)}
              </b>
            </div>
            <div className="preview-row after">
              <span>After this entry</span>
              <b>
                {query.data
                  ? formatMoney(
                      query.data.balanceMinor + (incoming ? draft : -draft),
                      user.currency,
                    )
                  : '—'}
              </b>
            </div>
            <small>Preview only. Your balance changes after saving.</small>
          </div>
          <div className="entry-tip">
            <span className="tip-icon">
              <CheckCircle2 size={22} />
            </span>
            <h3>
              Small habit.
              <br />
              Clearer picture.
            </h3>
            <p>
              Add a short description, choose a category, and you’re done. Your dashboard takes care
              of the rest.
            </p>
          </div>
          <div className="subtle-note">
            Need to correct something? You can edit or void a recorded entry from its history.
          </div>
        </aside>
      </div>
      <RecentEntries type={type} title={`Recent cash ${type}`} />
    </div>
  );
}
