import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminRole } from "@/lib/enums";
import { Card, PageHeader } from "@/components/ui";
import ConnectionCheck from "./ConnectionCheck";
import OperatingModeToggle from "./OperatingModeToggle";
import { isLocalOnly } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/dashboard");

  const localOnly = await isLocalOnly();

  const envConfigured = {
    OPTISIGNS_API_KEY: !!process.env.OPTISIGNS_API_KEY,
    OPTISIGNS_GRAPHQL_ENDPOINT: process.env.OPTISIGNS_GRAPHQL_ENDPOINT || "(default)",
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    DATABASE_URL: !!process.env.DATABASE_URL,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="System configuration & integration status." />

      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Operating mode</h2>
        <OperatingModeToggle initialLocal={localOnly} />
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Environment</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-500">OPTISIGNS_API_KEY</dt>
          <dd className="text-slate-900 font-mono">{envConfigured.OPTISIGNS_API_KEY ? "✓ configured" : "✗ missing"}</dd>
          <dt className="text-slate-500">OPTISIGNS_GRAPHQL_ENDPOINT</dt>
          <dd className="text-slate-900 font-mono">{String(envConfigured.OPTISIGNS_GRAPHQL_ENDPOINT)}</dd>
          <dt className="text-slate-500">AUTH_SECRET</dt>
          <dd className="text-slate-900 font-mono">{envConfigured.AUTH_SECRET ? "✓ configured" : "✗ missing"}</dd>
          <dt className="text-slate-500">DATABASE_URL</dt>
          <dd className="text-slate-900 font-mono">{envConfigured.DATABASE_URL ? "✓ configured" : "✗ missing"}</dd>
        </dl>
        <p className="text-xs text-slate-500 mt-4">
          Configure these in Netlify environment variables (or .env locally). API key values are never displayed.
        </p>
        {!localOnly && <ConnectionCheck />}
      </Card>
    </div>
  );
}
