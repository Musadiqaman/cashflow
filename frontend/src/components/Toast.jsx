import { createContext, useContext, useRef, useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null),
    timer = useRef();
  const notify = (message, type = 'success') => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 5000);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && (
        <div className={`toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
