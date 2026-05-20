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
  errors?: Array<{ message: string; path?: (string | number)[]; extensions?: unknown }>;
};

export class OptiSignsError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "OptiSignsError";
  }
}

function getConfig() {
  const apiKey = process.env.OPTISIGNS_API_KEY;
  const endpoint = process.env.OPTISIGNS_GRAPHQL_ENDPOINT || DEFAULT_ENDPOINT;
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
    let json: GqlResponse<T>;
    try {
      json = JSON.parse(text);
    } catch {
      throw new OptiSignsError(`OptiSigns returned non-JSON (${res.status})`, { body: text.slice(0, 500) });
    }

    if (!res.ok) {
      // Server-side log only. Never echo this back to the client unredacted.
      console.error("[optisigns] HTTP error", res.status, json);
      throw new OptiSignsError(`OptiSigns HTTP ${res.status}`, json);
    }

    if (json.errors && json.errors.length > 0) {
      console.error("[optisigns] GraphQL errors", json.errors);
      throw new OptiSignsError(json.errors.map((e) => e.message).join("; "), json.errors);
    }

    if (!json.data) throw new OptiSignsError("OptiSigns returned no data", json);
    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}
