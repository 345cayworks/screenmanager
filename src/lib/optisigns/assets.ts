// OptiSigns asset operations.
// IMPORTANT — schema confirmation required: see note in playlists.ts.
// Direct file upload is intentionally NOT included in MVP. To extend:
//   - Verify whether the OptiSigns GraphQL API exposes an upload mutation
//     (e.g. uploadAsset / saveWebsiteAsset). The REST endpoint /v1/assets
//     accepts multipart uploads — that may be the recommended path.
//   - Add a server-only upload route that streams to OptiSigns and creates a
//     matching AssetReference row.

import { gqlRequest } from "./client";

const GET_ASSETS = /* GraphQL */ `
  query GetAssets($limit: Int, $teamId: String) {
    assets(limit: $limit, teamId: $teamId) {
      _id
      name
      type
      thumbnail
      webLink
    }
  }
`;

export async function getAssets(opts: { limit?: number; teamId?: string } = {}) {
  const data = await gqlRequest<{
    assets: Array<{ _id: string; name?: string; type?: string; thumbnail?: string; webLink?: string }>;
  }>(GET_ASSETS, { limit: opts.limit ?? 100, teamId: opts.teamId ?? null });
  return data.assets;
}

const SAVE_WEBSITE_ASSET = /* GraphQL */ `
  mutation SaveWebsiteAsset($payload: SaveWebsiteAssetInput!) {
    saveWebsiteAsset(payload: $payload) {
      _id
      name
      webLink
    }
  }
`;

/**
 * Create a website/URL asset directly in OptiSigns. Use this when a client
 * wants to display a public URL without uploading a file.
 *
 * NOTE: confirm the exact input shape against the OptiSigns docs before relying
 * on this in production.
 */
export async function saveWebsiteAsset(payload: { name: string; url: string; teamId?: string }) {
  return gqlRequest<{ saveWebsiteAsset: { _id: string; name: string; webLink: string } }>(
    SAVE_WEBSITE_ASSET,
    { payload }
  );
}
