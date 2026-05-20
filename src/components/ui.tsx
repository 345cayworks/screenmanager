import clsx from "clsx";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("bg-white border border-slate-200 rounded-xl shadow-sm", className)}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className="text-3xl font-semibold text-slate-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </Card>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue" | "indigo";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  return (
    <span className={clsx("inline-block text-[11px] font-semibold uppercase tracking-wide rounded px-2 py-0.5", tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-white">
      <div className="text-slate-700 font-medium">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-1">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function statusTone(status: string): "slate" | "green" | "amber" | "red" | "blue" | "indigo" {
  switch (status) {
    case "PUBLISHED":
    case "APPROVED":
    case "ACTIVE":
      return "green";
    case "PENDING_APPROVAL":
    case "PENDING":
      return "amber";
    case "REJECTED":
    case "SUSPENDED":
    case "INACTIVE":
    case "EXPIRED":
      return "red";
    case "DRAFT":
      return "blue";
    default:
      return "slate";
  }
}
