import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Loader2, X, Inbox } from "lucide-react";
import { ROOM_STATUS, RES_STATUS, PRIORITY } from "../lib/status";
import { initials, inr } from "../lib/format";

// ── Buttons ───────────────────────────────────────────────────────────────────
const BTN = {
  primary: "bg-ink-900 text-white hover:bg-ink-800 shadow-sm",
  gold: "bg-gold-500 text-white hover:bg-gold-600 shadow-sm",
  secondary: "bg-white text-ink-900 border border-line hover:bg-slate-50 hover:border-slate-300 shadow-sm",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-ink-900",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
  "danger-ghost": "text-rose-600 hover:bg-rose-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
};
const SIZE = { xs: "h-7 px-2 text-xs gap-1", sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-9 px-4 text-[13.5px] gap-2", lg: "h-11 px-5 text-[15px] gap-2" };

export function Button({ variant = "primary", size = "md", icon: Icon, loading, className, children, ...props }) {
  return (
    <button
      className={clsx("inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50", BTN[variant], SIZE[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className={size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, ...props }) {
  return (
    <button aria-label={label} title={label} className={clsx("inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-ink-900", className)} {...props}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

// ── Form controls ─────────────────────────────────────────────────────────────
export function Field({ label, hint, error, required, className, children, htmlFor }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Input({ label, hint, error, required, className, inputClassName, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className} htmlFor={id}>
      <input id={id} className={clsx("input", error && "border-rose-300", inputClassName)} {...props} />
    </Field>
  );
}

export function Select({ label, hint, error, required, className, options = [], placeholder, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className} htmlFor={id}>
      <select id={id} className="input pr-8" {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const v = typeof o === "object" ? o.value : o;
          return <option key={v} value={v}>{typeof o === "object" ? o.label : o}</option>;
        })}
      </select>
    </Field>
  );
}

export function Textarea({ label, hint, className, rows = 3, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} className={className} htmlFor={id}>
      <textarea id={id} rows={rows} className="input resize-y" {...props} />
    </Field>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={clsx("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-gold-500" : "bg-slate-300")}>
        <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
      {(label || description) && (
        <span>
          <span className="block text-[13.5px] font-medium text-ink-900">{label}</span>
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Segmented({ value, onChange, options, size = "md" }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-slate-50 p-0.5">
      {options.map((o) => {
        const v = typeof o === "object" ? o.value : o;
        const Icon = o.icon;
        return (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={clsx("inline-flex items-center gap-1.5 rounded-md font-medium transition", size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
              value === v ? "bg-white text-ink-900 shadow-sm ring-1 ring-line" : "text-slate-500 hover:text-ink-900")}>
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {typeof o === "object" ? o.label : o}
          </button>
        );
      })}
    </div>
  );
}

// ── Display ───────────────────────────────────────────────────────────────────
export function Badge({ className, children, dot }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset", className || "bg-slate-100 text-slate-600 ring-slate-500/10")}>
      {dot && <span className={clsx("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

export const RoomStatusBadge = ({ status }) => <Badge className={ROOM_STATUS[status]?.tone} dot={ROOM_STATUS[status]?.dot}>{status}</Badge>;
export const ResStatusBadge = ({ status }) => <Badge className={RES_STATUS[status]?.tone}>{status}</Badge>;
export const PriorityBadge = ({ priority }) => <Badge className={PRIORITY[priority]}>{priority}</Badge>;

export function Money({ value, className, colored }) {
  const v = Math.round(value || 0);
  return <span className={clsx("tabular-nums", colored && (v > 0 ? "text-rose-600" : v < 0 ? "text-emerald-600" : "text-slate-400"), className)}>{inr(v)}</span>;
}

export function Avatar({ name, size = "md", className }) {
  const s = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-base" }[size];
  return <span className={clsx("inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-100 to-gold-200 font-semibold text-gold-700 ring-1 ring-gold-300/50", s, className)}>{initials(name)}</span>;
}

export function Card({ className, children, ...props }) {
  return <div className={clsx("card", className)} {...props}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="h-4 w-4 text-gold-500" />}
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold text-ink-900">{title}</h3>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-semibold leading-tight text-ink-900 sm:text-[30px] 2xl:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500 sm:text-[13.5px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon: Icon, accent = "text-gold-500", onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={clsx("card group flex w-full min-w-0 items-start justify-between gap-2 p-3.5 text-left transition sm:gap-3 sm:p-4", onClick && "hover:-translate-y-0.5 hover:shadow-pop")}>
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[11.5px]">{label}</p>
        <p className="mt-1.5 truncate text-[21px] font-semibold leading-none tabular-nums text-ink-900 sm:text-[26px]">{value}</p>
        {sub && <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-slate-500 sm:text-xs">{sub}</p>}
      </div>
      {Icon && <span className={clsx("hidden rounded-lg bg-slate-50 p-2 ring-1 ring-line min-[420px]:inline-flex", accent)}><Icon className="h-[18px] w-[18px]" /></span>}
    </button>
  );
}

export function Empty({ icon: Icon = Inbox, title = "Nothing here", children, className }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400"><Icon className="h-5 w-5" /></span>
      <p className="text-[14px] font-medium text-ink-900">{title}</p>
      {children && <div className="mt-1 max-w-sm text-[13px] text-slate-500">{children}</div>}
    </div>
  );
}

export const Spinner = ({ className }) => <Loader2 className={clsx("h-5 w-5 animate-spin text-gold-500", className)} />;
export const Loading = ({ label = "Loading…" }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Spinner /> {label}</div>
);

export function KV({ label, children, className }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] text-ink-900">{children || <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}

export function Alert({ tone = "info", title, children, icon: Icon, className }) {
  const t = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];
  return (
    <div className={clsx("flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px]", t, className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={clsx(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={clsx("flex gap-1 overflow-x-auto border-b border-line scroll-thin", className)}>
      {tabs.map((t) => (
        <button key={t.value} type="button" onClick={() => onChange(t.value)}
          className={clsx("-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] font-medium transition",
            value === t.value ? "border-gold-500 text-ink-900" : "border-transparent text-slate-500 hover:text-ink-900")}>
          {t.icon && <t.icon className="h-4 w-4" />}
          {t.label}
          {t.count != null && <span className={clsx("rounded-full px-1.5 text-[11px] font-semibold", value === t.value ? "bg-gold-100 text-gold-700" : "bg-slate-100 text-slate-500")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Overlays ──────────────────────────────────────────────────────────────────
function useEscape(onClose) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = "md" }) {
  useEscape(open ? onClose : null);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={clsx("relative flex max-h-[94dvh] w-full animate-pop-in flex-col rounded-t-2xl bg-white shadow-pop sm:max-h-[92vh] sm:rounded-2xl", w)}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 break-words text-[13px] text-slate-500">{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-1.5 -mt-1" />
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 scroll-thin sm:px-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-slate-50/60 px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl sm:px-5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({ open, onClose, title, subtitle, header, children, footer, width = "max-w-2xl" }) {
  useEscape(open ? onClose : null);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/30" onClick={onClose} />
      <aside className={clsx("relative flex h-full w-full animate-slide-in flex-col bg-canvas shadow-pop", width)}>
        <div className="flex items-start justify-between gap-3 border-b border-line bg-white px-4 py-3.5 sm:px-5 sm:py-4">
          {header || (
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-semibold text-ink-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
            </div>
          )}
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-thin">{children}</div>
        {footer && <div className="flex flex-wrap items-center gap-2 border-t border-line bg-white px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-5">{footer}</div>}
      </aside>
    </div>,
    document.body
  );
}

export function Confirm({ open, onClose, onConfirm, title, children, confirmLabel = "Confirm", variant = "primary", loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={variant} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div className="text-[13.5px] text-slate-600">{children}</div>
    </Modal>
  );
}
