import { ArrowDownUp } from 'lucide-react';
export function Brand({ small = false }) {
  return (
    <div className={`brand ${small ? 'small' : ''}`}>
      <span className="brand-mark">
        <ArrowDownUp size={small ? 21 : 25} />
      </span>
      <span>
        cashbook<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
