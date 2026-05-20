// OptiSigns playlist operations.
//
// IMPORTANT — schema confirmation required:
// The mutation/query *names* below match the documented OptiSigns API
// (savePlaylist, addPlaylistItems, updatePlaylistItems, removePlaylistItems),
// but field names / required arguments may differ in the live schema. Run a
// __schema introspection or check the OptiSigns developer docs and adjust the
// GraphQL documents in this file before publishing to production.
//
// The function signatures are intentionally stable so the rest of the app
// doesn't have to change when the queries are finalized.

import { gqlRequest } from "./client";

export type PlaylistItemInput = {
  assetId: string;
  durationSeconds: number;
  sortOrder?: number;
  startDate?: string | null;
  endDate?: string | null;
};

export type RemotePlaylistItem = {
  _id: string;
  assetId: string;
  duration?: number | null;
  // Optional enrichment — only populated when the server returns it.
  asset?: { _id?: string; name?: string; type?: string; thumbnail?: string | null } | null;
};

export type RemotePlaylist = {
  _id: string;
  name?: string;
  items: RemotePlaylistItem[];
};

// ---------- Queries ----------

// The tenant exposes `getPlaylistDetail`, not the bare `playlist(_id:)` field.
// Try the richer shape first (nested asset metadata), fall back to minimal if
// asset fields aren't supported.
const GET_PLAYLIST_RICH = /* GraphQL */ `
  query GetPlaylist($id: ID!) {
    getPlaylistDetail(_id: $id) {
      _id
      name
      items {
        _id
        assetId
        duration
        asset {
          _id
          name
          type
          thumbnail
        }
      }
    }
  }
`;

const GET_PLAYLIST_MINIMAL = /* GraphQL */ `
  query GetPlaylist($id: ID!) {
    getPlaylistDetail(_id: $id) {
      _id
      name
      items {
        _id
        assetId
        duration
      }
    }
  }
`;

// OptiSigns returns `playlists` wrapped in a paginated PlaylistResponse, with
// the records under `.page`. We try the rich shape first (with `items` so we
// can show a count) and fall back to a minimal shape if `items` isn't a field
// on the live Playlist type.

const LIST_PLAYLISTS_RICH = /* GraphQL */ `
  query ListPlaylists($first: Int) {
    playlists(first: $first) {
      page {
        _id
        name
        items { _id }
      }
    }
  }
`;

const LIST_PLAYLISTS_MIN = /* GraphQL */ `
  query ListPlaylists($first: Int) {
    playlists(first: $first) {
      page {
        _id
        name
      }
    }
  }
`;

const LIST_PLAYLISTS_NO_ARGS = /* GraphQL */ `
  query ListPlaylists {
    playlists {
      page {
        _id
        name
      }
    }
  }
`;

export type RemotePlaylistSummary = {
  _id: string;
  name?: string;
  items?: Array<{ _id?: string }>;
};

/**
 * Lists every playlist visible to the current OptiSigns account.
 */
export async function listPlaylists(): Promise<RemotePlaylistSummary[]> {
  // Attempt rich shape first.
  try {
    const data = await gqlRequest<{ playlists: { page: RemotePlaylistSummary[] } }>(
      LIST_PLAYLISTS_RICH,
      { first: 500 }
    );
    return data.playlists?.page ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    // Field on Playlist doesn't exist — try without items.
    if (/items|field/i.test(msg)) {
      try {
        const data = await gqlRequest<{ playlists: { page: RemotePlaylistSummary[] } }>(
          LIST_PLAYLISTS_MIN,
          { first: 500 }
        );
        return data.playlists?.page ?? [];
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : "";
        if (/\$first|argument/i.test(msg2)) {
          const data = await gqlRequest<{ playlists: { page: RemotePlaylistSummary[] } }>(
            LIST_PLAYLISTS_NO_ARGS
          );
          return data.playlists?.page ?? [];
        }
        throw err2;
      }
    }
    // Args not supported — try no-args version.
    if (/\$first|argument/i.test(msg)) {
      const data = await gqlRequest<{ playlists: { page: RemotePlaylistSummary[] } }>(
        LIST_PLAYLISTS_NO_ARGS
      );
      return data.playlists?.page ?? [];
    }
    throw err;
  }
}

export async function getPlaylist(playlistId: string): Promise<RemotePlaylist | null> {
  try {
    const data = await gqlRequest<{ getPlaylistDetail: RemotePlaylist | null }>(
      GET_PLAYLIST_RICH,
      { id: playlistId }
    );
    return data.getPlaylistDetail ?? null;
  } catch (err) {
    console.warn(
      "[optisigns] rich playlist query failed, trying minimal:",
      err instanceof Error ? err.message : err
    );
    const data = await gqlRequest<{ getPlaylistDetail: RemotePlaylist | null }>(
      GET_PLAYLIST_MINIMAL,
      { id: playlistId }
    );
    return data.getPlaylistDetail ?? null;
  }
}

// ---------- Mutations ----------

const SAVE_PLAYLIST = /* GraphQL */ `
  mutation SavePlaylist($payload: SavePlaylistInput!) {
    savePlaylist(payload: $payload) {
      _id
      name
    }
  }
`;

export async function createOrUpdatePlaylist(payload: {
  _id?: string;
  name: string;
  teamId?: string;
}): Promise<{ _id: string; name?: string }> {
  const data = await gqlRequest<{ savePlaylist: { _id: string; name?: string } }>(SAVE_PLAYLIST, {
    payload,
  });
  return data.savePlaylist;
}

const ADD_PLAYLIST_ITEMS = /* GraphQL */ `
  mutation AddPlaylistItems($playlistId: ID!, $items: [AddPlaylistItemInput!]!) {
    addPlaylistItems(playlistId: $playlistId, items: $items) {
      _id
    }
  }
`;

export async function addPlaylistItems(playlistId: string, items: PlaylistItemInput[]) {
  return gqlRequest<{ addPlaylistItems: Array<{ _id: string }> }>(ADD_PLAYLIST_ITEMS, {
    playlistId,
    items: items.map((i) => ({
      assetId: i.assetId,
      duration: i.durationSeconds,
      sortOrder: i.sortOrder ?? 0,
      startDate: i.startDate ?? null,
      endDate: i.endDate ?? null,
    })),
  });
}

const UPDATE_PLAYLIST_ITEMS = /* GraphQL */ `
  mutation UpdatePlaylistItems($playlistId: ID!, $items: [UpdatePlaylistItemInput!]!) {
    updatePlaylistItems(playlistId: $playlistId, items: $items) {
      _id
    }
  }
`;

export async function updatePlaylistItems(
  playlistId: string,
  items: Array<{ _id: string; durationSeconds?: number; sortOrder?: number }>
) {
  return gqlRequest<{ updatePlaylistItems: Array<{ _id: string }> }>(UPDATE_PLAYLIST_ITEMS, {
    playlistId,
    items: items.map((i) => ({
      _id: i._id,
      duration: i.durationSeconds,
      sortOrder: i.sortOrder,
    })),
  });
}

const REMOVE_PLAYLIST_ITEMS = /* GraphQL */ `
  mutation RemovePlaylistItems($playlistId: ID!, $itemIds: [ID!]!) {
    removePlaylistItems(playlistId: $playlistId, itemIds: $itemIds) {
      _id
    }
  }
`;

export async function removePlaylistItems(playlistId: string, itemIds: string[]) {
  return gqlRequest<{ removePlaylistItems: { _id: string } }>(REMOVE_PLAYLIST_ITEMS, {
    playlistId,
    itemIds,
  });
}
