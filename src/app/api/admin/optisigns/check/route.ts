// GET /api/admin/optisigns/check
//
// Probes the OptiSigns gateway and returns a structured status. Admin-only.
// Performs three steps:
//   1. Verifies env vars are present.
//   2. Sends `query { __typename }` — confirms the endpoint speaks GraphQL.
//   3. Sends a real query (`getDevices`) — confirms the bearer token is valid
//      and the schema has the fields we expect.
//
// Each step's outcome is returned independently so the UI can show exactly
// where the chain broke.

import { requireAdmin } from "@/lib/rbac";
import { handle, ok } from "@/lib/http";
import { gqlRequest } from "@/lib/optisigns/client";

export const dynamic = "force-dynamic";

type StepResult = { ok: boolean; detail?: string };

export async function GET() {
  return handle(async () => {
    await requireAdmin();

    const env: StepResult = {
      ok: !!process.env.OPTISIGNS_API_KEY,
      detail: process.env.OPTISIGNS_API_KEY
        ? "OPTISIGNS_API_KEY present"
        : "OPTISIGNS_API_KEY is not set",
    };

    const endpoint =
      process.env.OPTISIGNS_GRAPHQL_ENDPOINT ||
      "https://graphql-gateway.optisigns.com/graphql";

    let reach: StepResult = { ok: false, detail: "Not attempted" };
    let auth: StepResult = { ok: false, detail: "Not attempted" };
    let deviceCount: number | null = null;
    let sampleDeviceName: string | null = null;

    if (env.ok) {
      try {
        await gqlRequest<{ __typename: string }>("query { __typename }");
        reach = { ok: true, detail: "GraphQL endpoint reachable" };
      } catch (err) {
        reach = {
          ok: false,
          detail: err instanceof Error ? err.message : "Unreachable",
        };
      }

      if (reach.ok) {
        try {
          const data = await gqlRequest<{
            devices: Array<{ _id: string; deviceName?: string }>;
          }>("query { devices { _id deviceName } }");
          const devices = data.devices ?? [];
          deviceCount = devices.length;
          sampleDeviceName = devices[0]?.deviceName ?? null;
          auth = { ok: true, detail: `API key accepted (${devices.length} device(s) visible)` };
        } catch (err) {
          auth = {
            ok: false,
            detail: err instanceof Error ? err.message : "Auth check failed",
          };
        }
      }
    }

    return ok({
      ok: env.ok && reach.ok && auth.ok,
      endpoint,
      steps: { env, reach, auth },
      deviceCount,
      sampleDeviceName,
    });
  });
}
