// GET /api/admin/optisigns/check
//
// Probes the OptiSigns gateway and returns a structured status. Admin-only.
//
//   1. env    — OPTISIGNS_API_KEY is set
//   2. reach  — endpoint speaks GraphQL  (query { __typename })
//   3. auth   — bearer token works AND we can read the schema
//
// On success, the response includes:
//   - list of root Query and Mutation field names (sorted)
//   - structure of every type whose name matches the patterns we care
//     about (Device, Playlist, Asset, *Response) so we can tune our
//     query documents to the live schema.

import { requireAdmin } from "@/lib/rbac";
import { handle, ok } from "@/lib/http";
import { gqlRequest } from "@/lib/optisigns/client";

export const dynamic = "force-dynamic";

type Step = { ok: boolean; detail?: string };

// One level of unwrapping for non-null + list combinations.
const INTROSPECT = /* GraphQL */ `
  query Introspect {
    __schema {
      queryType { name fields { name type { ...T } } }
      mutationType { name fields { name type { ...T } } }
      types {
        kind
        name
        fields {
          name
          type { ...T }
        }
      }
    }
  }
  fragment T on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType { kind name }
      }
    }
  }
`;

type TypeRef = { kind: string; name: string | null; ofType?: TypeRef | null };
type SchemaField = { name: string; type: TypeRef };
type SchemaType = { kind: string; name: string | null; fields: SchemaField[] | null };
type IntrospectResult = {
  __schema: {
    queryType: { fields: SchemaField[] };
    mutationType: { fields: SchemaField[] } | null;
    types: SchemaType[];
  };
};

function describeType(t: TypeRef | null | undefined): string {
  if (!t) return "?";
  if (t.kind === "NON_NULL") return `${describeType(t.ofType)}!`;
  if (t.kind === "LIST") return `[${describeType(t.ofType)}]`;
  return t.name || t.kind;
}

const NAME_PATTERNS = [
  /^Device$/i,
  /^Playlist$/i,
  /^Asset$/i,
  /^Screen$/i,
  /Response$/i,
  /^PlaylistItem/i,
  /^Page$/i,
  /^PageInfo$/i,
  /Edge$/i,
];

function shouldIncludeType(name: string | null) {
  if (!name) return false;
  return NAME_PATTERNS.some((p) => p.test(name));
}

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
    let dataAccess: Step = { ok: false, detail: "Not attempted" };
    let queries: Array<{ name: string; returns: string }> = [];
    let mutations: Array<{ name: string; returns: string }> = [];
    let typesOfInterest: Array<{ name: string; fields: Array<{ name: string; type: string }> }> = [];

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
          queries = (data.__schema.queryType?.fields ?? [])
            .map((f) => ({ name: f.name, returns: describeType(f.type) }))
            .sort((a, b) => a.name.localeCompare(b.name));
          mutations = (data.__schema.mutationType?.fields ?? [])
            .map((f) => ({ name: f.name, returns: describeType(f.type) }))
            .sort((a, b) => a.name.localeCompare(b.name));
          typesOfInterest = (data.__schema.types ?? [])
            .filter((t) => t.kind === "OBJECT" && shouldIncludeType(t.name))
            .map((t) => ({
              name: t.name!,
              fields: (t.fields ?? []).map((f) => ({ name: f.name, type: describeType(f.type) })),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
          auth = {
            ok: true,
            detail: `Schema accessible — ${queries.length} queries · ${mutations.length} mutations · ${typesOfInterest.length} relevant types`,
          };
        } catch (err) {
          auth = {
            ok: false,
            detail: err instanceof Error ? err.message : "Auth/introspection check failed",
          };
        }
      }

      // Step 4 — data access. Introspection can succeed (schema visible) while
      // OptiSigns still gates data-read endpoints behind the paid API add-on.
      // Exercise a real list query to find out.
      if (auth.ok) {
        try {
          const data = await gqlRequest<{ playlists: { page: { edges: unknown[] } } }>(
            "query { playlists { page { edges { node { _id } } } } }"
          );
          const count = data.playlists?.page?.edges?.length ?? 0;
          dataAccess = {
            ok: true,
            detail: `Playlist data accessible (${count} item(s) in this page)`,
          };
        } catch (err) {
          dataAccess = {
            ok: false,
            detail: err instanceof Error ? err.message : "Data access failed",
          };
        }
      }
    }

    return ok({
      ok: env.ok && reach.ok && auth.ok && dataAccess.ok,
      endpoint,
      steps: { env, reach, auth, dataAccess },
      queries,
      mutations,
      typesOfInterest,
    });
  });
}
