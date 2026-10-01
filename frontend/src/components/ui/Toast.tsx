import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type Toast = { id: number; title?: string; message: string; tone?: "success"|"error"|"info"|"warning" };
type Ctx = {
  notify: (t: Omit<Toast, "id">) => void;
};
const ToastCtx = createContext<Ctx>({ notify: () => {} });

export function useToast() { return useContext(ToastCtx); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const notify = (t: Omit<Toast, "id">) => {
    const id = idRef.current++;
    setItems(s => [...s, { id, ...t }]);
    // auto-dismiss in 4s
    setTimeout(() => setItems(s => s.filter(x => x.id !== id)), 4000);
    // update aria-live
    const live = document.getElementById('toast-live');
    if (live) live.textContent = `${t.tone ?? 'info'}: ${t.title ? t.title + '. ' : ''}${t.message}`;
  };

  const ctx = useMemo(() => ({ notify }), []);
  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      {/* screen reader live region */}
      <div id="toast-live" className="sr-live" aria-live="polite" />

      {/* container */}
      <div className="fixed right-4 bottom-4 z-[3000] space-y-3 w-[min(90vw,360px)]">
        {items.map(t => (
          <ToastItem key={t.id} t={t} onClose={() => setItems(s => s.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function toneClasses(tone?: Toast["tone"]) {
  switch (tone) {
    case "success": return "bg-emerald-600";
    case "error":   return "bg-red-600";
    case "warning": return "bg-yellow-600";
    default:        return "bg-neutral-800";
  }
}
function ToastItem({ t, onClose }: { t: Toast; onClose: () => void }) {
  // Allow ESC to close last toast
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="rounded-xl overflow-hidden shadow-lg border bg-white">
      <div className={`h-1 ${toneClasses(t.tone)}`} />
      <div className="p-3">
        {t.title && <div className="font-semibold text-sm">{t.title}</div>}
        <div className="text-sm text-neutral-700">{t.message}</div>
        <div className="mt-2 text-right">
          <button className="text-xs text-neutral-500 hover:text-neutral-700" onClick={onClose} aria-label="Dismiss notification">Dismiss</button>
        </div>
      </div>
    </div>
  );
}
