import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, queryString } from '../services/api.js';
import { categories } from '../utils/format.js';
import { Button } from '../components/UI.jsx';
import { useToast } from '../components/Toast.jsx';
import { EntryTable } from '../components/ledger/EntryTable.jsx';
const empty = { type: '', status: 'posted', from: '', to: '', category: '', reference: '' };
export default function Transactions() {
  const { user } = useAuth(),
    notify = useToast(),
    [params] = useSearchParams();
  const [filters, setFilters] = useState({
      ...empty,
      type: ['in', 'out'].includes(params.get('type')) ? params.get('type') : '',
    }),
    [reference, setReference] = useState(''),
    [stack, setStack] = useState(['']),
    [size, setSize] = useState(20),
    [exporting, setExporting] = useState(false),
    [expanded, setExpanded] = useState(false);
  const cursor = stack.at(-1),
    query = useQuery({
      queryKey: ['entries', user.id, 'list', filters, cursor, size],
      queryFn: ({ signal }) =>
        api(`/entries?${queryString({ ...filters, limit: size, cursor })}`, { signal }),
    });
  const change = (name, value) => {
    setFilters({ ...filters, [name]: value, ...(name === 'type' ? { category: '' } : {}) });
    setStack(['']);
  };
  const reset = () => {
    setFilters(empty);
    setReference('');
    setStack(['']);
  };
  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api(`/export?${queryString(filters)}`, { blob: true });
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = 'cashbook-transactions.csv';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Your CSV export is ready.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE WHOLE STORY</span>
          <h1>Transactions</h1>
          <p>Every money move, neatly in one place.</p>
        </div>
        <div className="heading-actions">
          <Button variant="secondary" onClick={exportCsv} loading={exporting}>
            <ArrowDownToLine size={17} /> Export CSV
          </Button>
          <Link to="/cash-in" className="button primary">
            <ArrowDownLeft size={18} /> New entry
          </Link>
        </div>
      </div>
      <section className="panel transactions-panel">
        <div className="filters-top">
          <div className="segmented" aria-label="Entry type">
            {[
              ['', 'All entries'],
              ['in', 'Cash in'],
              ['out', 'Cash out'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => change('type', value)}
                className={filters.type === value ? 'active' : ''}
                aria-pressed={filters.type === value}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="filter-actions">
            <form
              className="reference-search"
              onSubmit={(e) => {
                e.preventDefault();
                change('reference', reference.trim().toUpperCase());
              }}
            >
              <Search size={17} />
              <input
                aria-label="Search by full reference"
                placeholder="Full reference…"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={40}
              />
              <button type="submit" aria-label="Find reference">
                <ChevronRight size={18} />
              </button>
            </form>
            <button
              className={`filter-toggle ${expanded ? 'active' : ''}`}
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              <Filter size={17} /> Filters
            </button>
          </div>
        </div>
        {expanded && (
          <div className="filters-expanded">
            <label>
              From
              <input
                type="date"
                min="2000-01-01"
                max={filters.to || undefined}
                value={filters.from}
                onChange={(e) => change('from', e.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                min={filters.from || '2000-01-01'}
                value={filters.to}
                onChange={(e) => change('to', e.target.value)}
              />
            </label>
            <label>
              Category
              <select
                value={filters.category}
                disabled={!filters.type}
                onChange={(e) => change('category', e.target.value)}
              >
                <option value="">All categories</option>
                {(categories[filters.type] || []).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={filters.status} onChange={(e) => change('status', e.target.value)}>
                <option value="posted">Recorded</option>
                <option value="void">Voided</option>
              </select>
            </label>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw size={16} /> Reset
            </Button>
          </div>
        )}
        {filters.reference && (
          <div className="filter-summary">
            Reference: <b>{filters.reference}</b>
            <button
              onClick={() => {
                setReference('');
                change('reference', '');
              }}
            >
              Clear
            </button>
          </div>
        )}
        <EntryTable
          entries={query.data?.items}
          loading={query.isPending}
          error={query.error}
          retry={query.refetch}
        />
        <div className="pagination">
          <div>
            <span>Page {stack.length}</span>
            <span className="muted"> · {query.data?.items.length || 0} entries</span>
          </div>
          <div className="pagination-actions">
            <label className="page-size">
              <span>Rows</span>
              <select
                aria-label="Entries per page"
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value));
                  setStack(['']);
                }}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              className="icon-button bordered"
              disabled={stack.length === 1 || query.isFetching}
              aria-label="Previous page"
              onClick={() => setStack(stack.slice(0, -1))}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-button bordered"
              disabled={!query.data?.nextCursor || query.isFetching}
              aria-label="Next page"
              onClick={() => setStack([...stack, query.data.nextCursor])}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      <p className="table-footnote">
        Only recorded entries affect your balance. Voided entries stay in your history.
      </p>
    </div>
  );
}
