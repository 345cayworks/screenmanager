"use client";

import { useState } from "react";

type Step = { ok: boolean; detail?: string };
type Result = {
  ok: boolean;
  endpoint: string;
  steps: { env: Step; reach: Step; auth: Step };
  queries: string[];
  mutations: string[];
};

export default function ConnectionCheck() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/optisigns/check");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || `HTTP ${res.status}`);
      } else {
        setResult(body);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
    setBusy(false);
  }

  return (
    <div className="mt-6 pt-6 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">OptiSigns connection</h3>
          <p className="text-xs text-slate-500">
            Verifies env vars, GraphQL reachability, and the API key.
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="px-3 py-1.5 text-sm bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400 text-white rounded-lg font-medium"
        >
          {busy ? "Testing…" : "Test connection"}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          <StepLine label="Env vars" step={result.steps.env} />
          <StepLine label="Endpoint reachable" step={result.steps.reach} />
          <StepLine label="API key accepted" step={result.steps.auth} />
          <div className="text-xs text-slate-500 mt-2 font-mono">{result.endpoint}</div>

          {(result.queries.length > 0 || result.mutations.length > 0) && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-slate-700 font-medium">
                Schema discovered ({result.queries.length} queries, {result.mutations.length} mutations)
              </summary>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <div className="text-slate-500 font-medium mb-1">Queries</div>
                  <ul className="font-mono text-[11px] text-slate-700 space-y-0.5 max-h-64 overflow-y-auto">
                    {result.queries.map((q) => <li key={q}>{q}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-slate-500 font-medium mb-1">Mutations</div>
                  <ul className="font-mono text-[11px] text-slate-700 space-y-0.5 max-h-64 overflow-y-auto">
                    {result.mutations.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function StepLine({ label, step }: { label: string; step: Step }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span
        className={
          step.ok ? "text-green-600 font-bold" : "text-red-600 font-bold"
        }
      >
        {step.ok ? "✓" : "✗"}
      </span>
      <span className="text-slate-700 font-medium w-44">{label}</span>
      <span className="text-slate-500 flex-1">{step.detail}</span>
    </div>
  );
}
