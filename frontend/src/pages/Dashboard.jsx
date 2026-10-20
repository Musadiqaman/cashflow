import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  ArrowRight,
  TrendingUp,
  CalendarDays,
  ChartNoAxesCombined,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, queryString } from '../services/api.js';
import { addDays, today, dateLabel, formatMoney, chartColors } from '../utils/format.js';
import { EmptyState, ErrorState, Skeleton } from '../components/UI.jsx';
import { RecentEntries } from '../components/ledger/EntryTable.jsx';
function Change({ value, previous }) {
  if (!previous)
    return (
      <span className="stat-detail">
        {value ? 'A fresh start this period' : 'Your entries will show here'}
      </span>
    );
  const percent = ((value - previous) / previous) * 100;
  return (
    <span className="stat-detail">
      <b>
        {percent >= 0 ? '+' : ''}
        {Math.round(percent)}%
      </b>{' '}
      vs previous period
    </span>
  );
}
function FlowChart({ data, currency, id }) {
  return (
    <div
      className="flow-chart"
      role="img"
      aria-label="Daily cash in and cash out across the selected period"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`${id}-in`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#399a77" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#399a77" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id={`${id}-out`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d98c71" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#d98c71" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 5" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => dateLabel(v, true)}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={42}
            dy={10}
          />
          <YAxis
            tickFormatter={(v) => formatMoney(v, currency, true)}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={66}
          />
          <Tooltip
            labelFormatter={(v) => dateLabel(v)}
            formatter={(v, name) => [
              formatMoney(v, currency),
              name === 'inMinor' ? 'Cash in' : 'Cash out',
            ]}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              color: 'var(--text)',
              boxShadow: 'var(--shadow)',
            }}
          />
          <Area
            type="monotone"
            dataKey="inMinor"
            stroke="#399a77"
            strokeWidth={2.5}
            fill={`url(#${id}-in)`}
            activeDot={{ r: 5, strokeWidth: 3 }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="outMinor"
            stroke="#d98c71"
            strokeWidth={2.5}
            fill={`url(#${id}-out)`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export default function Dashboard() {
  const { user } = useAuth(),
    [period, setPeriod] = useState('30'),
    id = useId().replaceAll(':', ''),
    to = today(user.timezone);
  const [custom, setCustom] = useState({ from: addDays(to, -29), to });
  const range = period === 'custom' ? custom : { from: addDays(to, -Number(period) + 1), to };
  const query = useQuery({
    queryKey: ['dashboard', user.id, range],
    queryFn: ({ signal }) => api(`/dashboard?${queryString(range)}`, { signal }),
  });
  const data = query.data,
    net = data ? data.period.inMinor - data.period.outMinor : 0;
  return (
    <div className="page dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR MONEY, CLEARLY</span>
          <h1>
            Overview
            <span className="greeting-dot" />
          </h1>
          <p>Hi {user.name.split(' ')[0]}, here’s where your cash stands.</p>
        </div>
        <div className="heading-actions">
          <Link to="/cash-out" className="button secondary">
            <ArrowUpRight size={18} /> Cash out
          </Link>
          <Link to="/cash-in" className="button primary">
            <ArrowDownLeft size={18} /> Cash in
          </Link>
        </div>
      </div>
      <div className="overview-toolbar">
        <div>
          <span className="status-dot" />
          <strong>Cash at a glance</strong>
          <span className="toolbar-divider" />
          <span>
            {dateLabel(range.from, true)} – {dateLabel(range.to, true)}
          </span>
        </div>
        <label className="period-select">
          <CalendarDays size={16} />
          <span className="sr-only">Report period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 12 months</option>
            <option value="custom">Custom dates</option>
          </select>
        </label>
      </div>
      {period === 'custom' && (
        <div className="custom-range">
          <label>
            From
            <input
              type="date"
              min="2000-01-01"
              max={custom.to}
              value={custom.from}
              onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              min={custom.from}
              value={custom.to}
              onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })}
            />
          </label>
          <small>Choose up to 366 days.</small>
        </div>
      )}
      {query.isError ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : (
        <>
          <div className="stats-grid">
            <article className="stat-card balance-card">
              <div className="stat-top">
                <span>Current balance</span>
                <Wallet size={20} />
              </div>
              {data ? (
                <h2>{formatMoney(data.balanceMinor, user.currency)}</h2>
              ) : (
                <Skeleton className="stat-skeleton" />
              )}
              <div className="balance-bottom">
                <span>
                  <span className="balance-dot" /> All-time balance
                </span>
                <ArrowUpRight size={17} />
              </div>
              <div className="balance-orbit" />
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>Cash in</span>
                <span className="stat-icon in">
                  <ArrowDownLeft size={20} />
                </span>
              </div>
              {data ? (
                <h2>{formatMoney(data.period.inMinor, user.currency)}</h2>
              ) : (
                <Skeleton className="stat-skeleton" />
              )}
              {data && <Change value={data.period.inMinor} previous={data.previous.inMinor} />}
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>Cash out</span>
                <span className="stat-icon out">
                  <ArrowUpRight size={20} />
                </span>
              </div>
              {data ? (
                <h2>{formatMoney(data.period.outMinor, user.currency)}</h2>
              ) : (
                <Skeleton className="stat-skeleton" />
              )}
              {data && <Change value={data.period.outMinor} previous={data.previous.outMinor} />}
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>Net cash flow</span>
                <span className="stat-icon neutral">
                  <TrendingUp size={20} />
                </span>
              </div>
              {data ? (
                <h2 className={net < 0 ? 'amount-out' : ''}>{formatMoney(net, user.currency)}</h2>
              ) : (
                <Skeleton className="stat-skeleton" />
              )}
              <span className="stat-detail">
                {data?.period.count ?? '—'} recorded entries this period
              </span>
            </article>
          </div>
          <div className="charts-grid">
            <section className="panel cash-flow-panel">
              <div className="panel-heading">
                <div>
                  <h2>Cash flow</h2>
                  <p>A little perspective on your daily ins and outs.</p>
                </div>
                <div className="chart-legend">
                  <span>
                    <i className="in" /> Cash in
                  </span>
                  <span>
                    <i className="out" /> Cash out
                  </span>
                </div>
              </div>
              {!data ? (
                <Skeleton className="chart-skeleton" />
              ) : data.period.count ? (
                <FlowChart data={data.series} currency={user.currency} id={id} />
              ) : (
                <EmptyState
                  icon={ChartNoAxesCombined}
                  title="Your cash story starts here"
                  message="Record an entry and watch your money come into focus."
                  action={
                    <Link to="/cash-in" className="text-link">
                      Add cash in <ArrowRight size={16} />
                    </Link>
                  }
                />
              )}
              <div className="chart-footer">
                <span>Selected period</span>
                <b>
                  {data ? formatMoney(net, user.currency) : '—'} <small>net cash flow</small>
                </b>
              </div>
            </section>
            <section className="panel spending-panel">
              <div className="panel-heading">
                <div>
                  <h2>Where it went</h2>
                  <p>Cash out by category.</p>
                </div>
                <span className="tiny-label">THIS PERIOD</span>
              </div>
              {!data ? (
                <Skeleton className="chart-skeleton" />
              ) : !data.expenses.length ? (
                <EmptyState
                  icon={Wallet}
                  title="A clean slate"
                  message="Your spending breakdown will appear after your first cash out entry."
                />
              ) : (
                <>
                  <div className="donut-wrap">
                    <div
                      className="donut-chart"
                      role="img"
                      aria-label="Cash out breakdown by category"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.expenses}
                            dataKey="amountMinor"
                            nameKey="name"
                            innerRadius={65}
                            outerRadius={83}
                            paddingAngle={data.expenses.length > 1 ? 3 : 0}
                            stroke="none"
                            startAngle={90}
                            endAngle={-270}
                            isAnimationActive={false}
                          >
                            {data.expenses.map((entry, i) => (
                              <Cell key={entry.name} fill={chartColors[i % chartColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v) => formatMoney(v, user.currency)}
                            contentStyle={{
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 12,
                              color: 'var(--text)',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="donut-label">
                      <small>Total cash out</small>
                      <strong>{formatMoney(data.period.outMinor, user.currency, true)}</strong>
                    </div>
                  </div>
                  <ul className="category-legend">
                    {data.expenses.map((item, i) => (
                      <li key={item.name}>
                        <span>
                          <i style={{ background: chartColors[i % chartColors.length] }} />
                          {item.name}
                        </span>
                        <b>
                          {Math.round((item.amountMinor / data.period.outMinor) * 100)}%{' '}
                          <small>{formatMoney(item.amountMinor, user.currency, true)}</small>
                        </b>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        </>
      )}
      <RecentEntries />
      <div className="dashboard-note">
        <span className="note-leaf">✦</span>
        <p>A little consistency makes a big difference. Keep your cashbook up to date.</p>
      </div>
    </div>
  );
}
