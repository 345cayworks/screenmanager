// GET /api/admin/optisigns/check
//
// Probes the OptiSigns gateway and returns a structured status. Admin-only.
//
//   1. env       — OPTISIGNS_API_KEY is set.
//   2. reach     — endpoint speaks GraphQL  (query { __typename })
//   3. auth      — bearer token works AND we can read the schema
//                  (query { __schema { queryType { fields { name } } } })
//
// When step 3 succeeds we return the list of root Query field names so
// the admin can see what their account exposes — invaluable when our
// hard-coded query names don't match the live schema.

import { requireAdmin } from "@/lib/rbac";
import { handle, ok } from "@/lib/http";
import { gqlRequest } from "@/lib/optisigns/client";

export const dynamic = "force-dynamic";

type Step = { ok: boolean; detail?: string };

const INTROSPECT = /* GraphQL */ `
  query Introspect {
    __schema {
      queryType { name fields { name } }
      mutationType { name fields { name } }
    }
  }
`;

type IntrospectResult = {
  __schema: {
    queryType: { name: string; fields: Array<{ name: string }> };
    mutationType: { name: string; fields: Array<{ name: string }> } | null;
  };
};

export async function GET() {
  return handle(async () => {
    await requireAdmin();

    const env: Step = {
      ok: !!process.env.OPTISIGNS_API_KEY,
      detail: process.env.OPTISIGNS_API_KEY
        ? "OPTISIGNS_API_KEY present"
        : "OPTISIGNS_API_KEY is not set",
    };

    const endpoint =
      process.env.OPTISIGNS_GRAPHQL_ENDPOINT ||
      "https://graphql-gateway.optisigns.com/graphql";

    let reach: Step = { ok: false, detail: "Not attempted" };
    let auth: Step = { ok: false, detail: "Not attempted" };
    let queries: string[] = [];
    let mutations: string[] = [];

    if (env.ok) {
      try {
        await gqlRequest<{ __typename: string }>("query { __typename }");
        reach = { ok: true, detail: "GraphQL endpoint reachable" };
      } catch (err) {
        reach = { ok: false, detail: err instanceof Error ? err.message : "Unreachable" };
      }

      if (reach.ok) {
        try {
          const data = await gqlRequest<IntrospectResult>(INTROSPECT);
          queries = data.__schema?.queryType?.fields?.map((f) => f.name).sort() ?? [];
          mutations = data.__schema?.mutationType?.fields?.map((f) => f.name).sort() ?? [];
          auth = {
            ok: true,
            detail: `Schema accessible — ${queries.length} root query field(s), ${mutations.length} mutation(s)`,
          };
        } catch (err) {
          auth = {
            ok: false,
            detail: err instanceof Error ? err.message : "Auth/introspection check failed",
          };
        }
      }
    }

    return ok({
      ok: env.ok && reach.ok && auth.ok,
      endpoint,
      steps: { env, reach, auth },
      queries,
      mutations,
    });
  });
}
