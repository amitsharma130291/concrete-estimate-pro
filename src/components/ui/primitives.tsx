import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export function Card({
  title,
  icon,
  subtitle,
  subtitleTone = "muted",
  children,
  className = "",
}: {
  title?: string;
  icon?: ReactNode;
  subtitle?: string;
  /** "red" is for an irreversible/destructive section (e.g. a "Danger zone" subtitle).
   * "orange" flags an important note worth noticing but not destructive (e.g. "Never shown
   * to the customer"). Everywhere else keeps the default neutral "muted" so this doesn't
   * change any other card's look. */
  subtitleTone?: "muted" | "red" | "orange";
  children: ReactNode;
  className?: string;
}) {
  const subtitleClass =
    subtitleTone === "red" ? "font-semibold text-red" : subtitleTone === "orange" ? "font-semibold text-orange-dark" : "text-muted";
  return (
    <div className={`rounded-xl border border-border bg-white shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-orange" aria-hidden="true">{icon}</span>}
            <h3 className="font-semibold text-ink">{title}</h3>
          </div>
          {subtitle && <span className={`text-sm ${subtitleClass}`}>{subtitle}</span>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  required = false,
  htmlFor,
  wide = false,
  children,
}: {
  label: string;
  hint?: string;
  /** When set, replaces `hint` with a red error message and marks the label for screen
   * readers -- used with NumberInput's own `error` prop to block save/calculate on
   * required/invalid fields instead of silently treating them as zero. */
  error?: string | null;
  /** Shows a red asterisk after the label -- purely a visual/screen-reader cue that this
   * field must be filled in; validation itself still lives wherever the field is used. */
  required?: boolean;
  htmlFor?: string;
  /** The default 3-column grid caps the input at 140px, which is deliberately compact for
   * the calculators' short numeric fields (dimensions, percentages) -- but the same cap
   * makes a general text field (a name, an email, a business address) look squeezed inside
   * a much wider card, like Settings' business-profile form. `wide` swaps to a 2-column
   * layout (label | input, input taking all remaining space) with hint/error below instead
   * of in a third column. */
  wide?: boolean;
  children: ReactNode;
}) {
  if (wide) {
    return (
      <div className="py-2.5">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
          {label}
          {required && (
            <span className="text-red" aria-hidden="true">
              {" "}*
            </span>
          )}
        </label>
        <div className="mt-1.5">{children}</div>
        {error ? (
          <span role="alert" className="mt-1 block text-xs font-medium text-red sm:text-sm">
            {error}
          </span>
        ) : (
          hint && <span className="mt-1 block text-xs text-muted sm:text-sm">{hint}</span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-center gap-1 py-2.5 sm:grid-cols-[minmax(0,110px)_minmax(0,140px)_1fr] sm:gap-3">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="text-red" aria-hidden="true">
            {" "}*
          </span>
        )}
      </label>
      <div>{children}</div>
      {error ? (
        <span role="alert" className="text-xs font-medium text-red sm:text-sm">
          {error}
        </span>
      ) : (
        hint && <span className="text-xs text-muted sm:text-sm">{hint}</span>
      )}
    </div>
  );
}

export function NumberInput({
  className = "",
  value,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  /** Error message for this field (see Field's `error`). When set, shows a red border and
   * `aria-invalid`. When `value` is NaN (a blank required field, tracked as NaN rather
   * than coerced to 0 so "cleared" is distinguishable from "typed 0"), the input renders
   * empty instead of the literal text "NaN". */
  error?: string | null;
}) {
  const displayValue = typeof value === "number" && !Number.isFinite(value) ? "" : value;
  return (
    <input
      type="number"
      inputMode="decimal"
      value={displayValue}
      aria-invalid={error ? true : undefined}
      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink shadow-sm transition ${
        error ? "border-red focus:border-red" : "border-border focus:border-orange"
      } ${className}`}
      {...props}
    />
  );
}

export function TextInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      className={`w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink shadow-sm transition focus:border-orange ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink shadow-sm transition focus:border-orange ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function UnitInput({
  value,
  onChange,
  unit,
  onUnitChange,
  units,
  id,
  min = 0,
  step = "any",
}: {
  value: number;
  onChange: (v: number) => void;
  unit: string;
  onUnitChange?: (u: string) => void;
  units?: string[];
  id?: string;
  min?: number;
  step?: string | number;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
        className="w-full min-w-0 flex-1 border-0 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-0"
      />
      {units && onUnitChange ? (
        <select
          value={unit}
          onChange={(e) => onUnitChange(e.target.value)}
          aria-label="Unit"
          className="border-l border-border bg-warm-white px-2 text-sm text-muted focus:outline-none"
        >
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      ) : (
        <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">
          {unit}
        </span>
      )}
    </div>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base",
  };
  const variants = {
    primary: "bg-orange text-white hover:bg-orange-dark",
    secondary: "bg-charcoal text-white hover:bg-charcoal-light",
    ghost: "bg-transparent text-ink border border-border hover:bg-warm-white",
    danger: "bg-red text-white hover:brightness-95",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "green" | "amber" | "red" | "orange";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-warm-white text-muted border border-border",
    green: "bg-green-light text-green",
    amber: "bg-amber-light text-amber",
    red: "bg-red-light text-red",
    orange: "bg-orange/10 text-orange-dark",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function StatTile({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "green" | "red" }) {
  const valueColor = tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-ink";
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold ${valueColor}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** "lg" (was the old `wide` prop) fits a single form comfortably. "xl" is for content that's
   * itself multi-column -- ScenarioCompareModal lays out two full scenario forms side by
   * side, so even "lg" left each one squeezed to roughly a quarter of the modal's width. */
  size?: "md" | "lg" | "xl";
}) {
  const maxWidthClass = size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-2xl" : "max-w-md";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-8 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${maxWidthClass} rounded-xl bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-semibold text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-warm-white hover:text-ink">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Catalog sections" className="flex flex-wrap gap-1 rounded-lg border border-border bg-warm-white p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
            active === t.key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  desc,
  action,
}: {
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{desc}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
