// OptiSigns playlist operations.
//
// Schema (confirmed against tenant introspection, May 2026):
//   playlists: PlaylistResponse!
//     page: PlaylistConnection!     // Relay-style
//       edges: [PlaylistEdge!]
//         node: Playlist
//   getPlaylistDetail(_id: ID!): PlaylistDetailResponse
//   savePlaylist: PlaylistDetailResponse
//   addPlaylistItems: [PlaylistItem!]
//   updatePlaylistItems: [PlaylistItem!]
//   removePlaylistItems: [PlaylistItem!]
//
//   type Playlist { _id, name, assets: [PlaylistItem!] }
//   type PlaylistItem {
//     _id, assetRootId, filename, type, duration, thumbnail, webLink, ...
//   }
//
// Note: OptiSigns clones asset metadata onto the PlaylistItem when the item is
// added. So a PlaylistItem _is_ effectively the asset-in-context, with the
// source asset linked via assetRootId.

import { gqlRequest } from "./client";

// ---------- Output types ----------

export type RemotePlaylistItem = {
  _id: string | null;
  assetRootId?: string | null;
  filename?: string | null;
  type?: string | null;
  duration?: number | null;
  thumbnail?: string | null;
  webLink?: string | null;
};

export type RemotePlaylist = {
  _id: string;
  name?: string | null;
  assets: RemotePlaylistItem[];
};

export type RemotePlaylistSummary = {
  _id: string;
  name?: string | null;
  itemCount: number;
};

// Inputs (used by callers in publish/import; exact server-side input names
// remain to be confirmed for add/update mutations — see notes below).
export type PlaylistItemInput = {
  assetId: string;
  durationSeconds: number;
  sortOrder?: number;
  startDate?: string | null;
  endDate?: string | null;
};

// ---------- Queries ----------

const LIST_PLAYLISTS = /* GraphQL */ `
  query ListPlaylists {
    playlists {
      page {
        edges {
          node {
            _id
            name
            assets { _id }
          }
        }
      }
    }
  }
`;

type ListPlaylistsResult = {
  playlists: {
    page: {
      edges: Array<{
        node: {
          _id: string;
          name?: string | null;
          assets?: Array<{ _id?: string | null }> | null;
        } | null;
      }> | null;
    } | null;
  } | null;
};

export async function listPlaylists(): Promise<RemotePlaylistSummary[]> {
  const data = await gqlRequest<ListPlaylistsResult>(LIST_PLAYLISTS);
  const edges = data.playlists?.page?.edges ?? [];
  return edges
    .map((e) => e.node)
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((n) => ({
      _id: n._id,
      name: n.name ?? null,
      itemCount: n.assets?.length ?? 0,
    }));
}

const GET_PLAYLIST = /* GraphQL */ `
  query GetPlaylist($id: ID!) {
    getPlaylistDetail(_id: $id) {
      _id
      name
      assets {
        _id
        assetRootId
        filename
        type
        duration
        thumbnail
        webLink
      }
    }
  }
`;

type GetPlaylistResult = {
  getPlaylistDetail: {
    _id: string;
    name?: string | null;
    assets?: RemotePlaylistItem[] | null;
  } | null;
};

export async function getPlaylist(playlistId: string): Promise<RemotePlaylist | null> {
  const data = await gqlRequest<GetPlaylistResult>(GET_PLAYLIST, { id: playlistId });
  const node = data.getPlaylistDetail;
  if (!node) return null;
  return {
    _id: node._id,
    name: node.name ?? null,
    assets: (node.assets ?? []).filter((a): a is RemotePlaylistItem => !!a),
  };
}

// ---------- Mutations ----------
//
// NOTE: addPlaylistItems / updatePlaylistItems / removePlaylistItems exist on
// the schema, but their exact input argument names/types were not in the
// introspection slice we fetched. The shapes below are best guesses based on
// OptiSigns' public docs; if a mutation 400s, the error will tell us exactly
// which argument is wrong and we can fix it without changing call sites.

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
}): Promise<{ _id: string; name?: string | null }> {
  const data = await gqlRequest<{ savePlaylist: { _id: string; name?: string } }>(
    SAVE_PLAYLIST,
    { payload }
  );
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
  return gqlRequest<{ updatePlaylistItems: Array<{ _id: string }> }>(
    UPDATE_PLAYLIST_ITEMS,
    {
      playlistId,
      items: items.map((i) => ({
        _id: i._id,
        duration: i.durationSeconds,
        sortOrder: i.sortOrder,
      })),
    }
  );
}

const REMOVE_PLAYLIST_ITEMS = /* GraphQL */ `
  mutation RemovePlaylistItems($playlistId: ID!, $itemIds: [ID!]!) {
    removePlaylistItems(playlistId: $playlistId, itemIds: $itemIds) {
      _id
    }
  }
`;

export async function removePlaylistItems(playlistId: string, itemIds: string[]) {
  return gqlRequest<{ removePlaylistItems: Array<{ _id: string }> }>(
    REMOVE_PLAYLIST_ITEMS,
    { playlistId, itemIds }
  );
}
