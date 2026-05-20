// Low-level OptiSigns GraphQL client. SERVER-ONLY.
//
// Never import this from a "use client" file or from anything that ships to the
// browser. The OptiSigns API key lives in OPTISIGNS_API_KEY and is read here.
//
// All higher-level operations (playlists, devices, assets) live in sibling
// files and call gqlRequest() below.

const DEFAULT_ENDPOINT = "https://graphql-gateway.optisigns.com/graphql";

export type GqlResponse<T> = {
  data?: T;
  errors?: Array<{
    message: string;
    path?: (string | number)[];
    extensions?: { code?: string; [key: string]: unknown };
  }>;
};

export class OptiSignsError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "OptiSignsError";
  }
}

/**
 * Translate well-known OptiSigns error codes into actionable messages.
 * Returns null if no special handling applies.
 */
function translateOptiSignsCode(
  errors: Array<{ message?: string; extensions?: { code?: string } }>
): string | null {
  const codes = errors
    .map((e) => (e.extensions?.code || "").toUpperCase())
    .filter(Boolean);
  const msgs = errors.map((e) => (e.message || "").toUpperCase());
  const has = (token: string) =>
    codes.some((c) => c.includes(token)) || msgs.some((m) => m.includes(token));

  if (has("API_NOT_AVAILABLE")) {
    return (
      "OptiSigns reports this API endpoint isn't available for your account. " +
      "This is usually because the OptiSigns API add-on isn't enabled on your plan, " +
      "or the bearer token doesn't have permission for this operation. " +
      "Check Settings → API in your OptiSigns dashboard."
    );
  }
  if (has("UNAUTHENTICATED") || has("UNAUTHORIZED")) {
    return "OptiSigns rejected the bearer token. Verify OPTISIGNS_API_KEY is current and active.";
  }
  if (has("FORBIDDEN")) {
    return "OptiSigns refused this operation. The API key may lack permission for this resource.";
  }
  return null;
}

/**
 * Normalize a user-supplied GraphQL endpoint:
 *  - trim whitespace
 *  - strip trailing slashes
 *  - if the URL has no path (or just "/"), append "/graphql"
 *
 * This is the difference between getting "Cannot POST /" (Express 404)
 * and a real GraphQL response.
 */
export function normalizeEndpoint(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    if (u.pathname === "" || u.pathname === "/") {
      u.pathname = "/graphql";
    }
    return u.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

function getConfig() {
  const apiKey = process.env.OPTISIGNS_API_KEY;
  const endpoint = normalizeEndpoint(
    process.env.OPTISIGNS_GRAPHQL_ENDPOINT || DEFAULT_ENDPOINT
  );
  if (!apiKey) {
    throw new OptiSignsError(
      "OPTISIGNS_API_KEY is not set. Configure it in your environment (Netlify env or .env)."
    );
  }
  return { apiKey, endpoint };
}

export async function gqlRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  opts: { timeoutMs?: number } = {}
): Promise<T> {
  const { apiKey, endpoint } = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      // Important: never include this in any client-side bundle.
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let json: GqlResponse<T> & { message?: string; error?: string } = {};
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON 4xx/5xx from a proxy or load balancer. Surface a snippet.
      if (!res.ok) {
        console.error("[optisigns] non-JSON error", res.status, text.slice(0, 500));
        throw new OptiSignsError(
          `OptiSigns ${res.status} at ${endpoint}: ${text.slice(0, 200) || res.statusText}`
        );
      }
      throw new OptiSignsError(`OptiSigns returned non-JSON (${res.status})`, { body: text.slice(0, 500) });
    }

    if (!res.ok) {
      console.error("[optisigns] HTTP error", res.status, json);
      // Recognize the classic "wrong path" mistake and give a directive hint.
      if (res.status === 404 && /Cannot POST \//.test(String(json.message ?? ""))) {
        throw new OptiSignsError(
          `OptiSigns 404 at ${endpoint} — the URL is reachable but doesn't speak GraphQL at this path. Set OPTISIGNS_GRAPHQL_ENDPOINT to the full path including /graphql (e.g. https://graphql-gateway.optisigns.com/graphql).`,
          json
        );
      }
      const friendly = translateOptiSignsCode(json.errors ?? []);
      if (friendly) throw new OptiSignsError(friendly, json);
      const gqlMsgs = json.errors?.map((e) => e.message).filter(Boolean).join("; ");
      const upstreamMsg = gqlMsgs || json.message || json.error || `HTTP ${res.status}`;
      throw new OptiSignsError(`OptiSigns ${res.status} at ${endpoint}: ${upstreamMsg}`, json);
    }

    if (json.errors && json.errors.length > 0) {
      console.error("[optisigns] GraphQL errors", json.errors);
      const friendly = translateOptiSignsCode(json.errors);
      throw new OptiSignsError(
        friendly || json.errors.map((e) => e.message).join("; "),
        json.errors
      );
    }

    if (!json.data) throw new OptiSignsError("OptiSigns returned no data", json);
    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}
