import { useEffect, useId, useRef } from 'react';
import { AlertCircle, ArrowRight, Inbox, LoaderCircle, X } from 'lucide-react';
export function Button({
  children,
  loading = false,
  variant = 'primary',
  className = '',
  ...props
}) {
  return (
    <button
      className={`button ${variant} ${className}`}
      {...props}
      disabled={props.disabled || loading}
    >
      {loading && <LoaderCircle className="spin" size={17} />} {children}
    </button>
  );
}
export function Field({ label, error, hint, children, className = '' }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label>
        {label}
        {children}
      </label>
      {error ? (
        <span className="field-error" role="alert" id={id}>
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}
export function FormError({ error }) {
  if (!error) return null;
  const fields = error.fields ? Object.values(error.fields).filter(Boolean) : [];
  return (
    <div className="form-error" role="alert">
      <AlertCircle size={18} />
      <span>{fields.length ? fields.join(' ') : error.message}</span>
    </div>
  );
}
export function EmptyState({
  title = 'A fresh start',
  message = 'Your entries will appear here.',
  action,
  icon: Icon = Inbox,
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={27} />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={24} />
      <h3>Something needs a second try</h3>
      <p>{error?.message || 'Unable to load this section.'}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again <ArrowRight size={16} />
        </Button>
      )}
    </div>
  );
}
export function Spinner({ label = 'Loading your cashbook…' }) {
  return (
    <div className="loading-screen" role="status">
      <LoaderCircle className="spin" size={28} />
      <p>{label}</p>
    </div>
  );
}
export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
export function Dialog({ open, onClose, title, description, children, wide = false }) {
  const ref = useRef(null),
    id = useId();
  useEffect(() => {
    if (open && !ref.current.open) ref.current.showModal();
    if (!open && ref.current.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'wide' : ''}`}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-header">
        <div>
          <h2 id={id}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
