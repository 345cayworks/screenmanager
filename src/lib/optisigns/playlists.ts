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

export type RemotePlaylist = {
  _id: string;
  name?: string;
  items?: Array<{
    _id?: string;
    assetId?: string;
    duration?: number;
  }>;
};

// ---------- Queries ----------

const GET_PLAYLIST = /* GraphQL */ `
  query GetPlaylist($id: ID!) {
    playlist(_id: $id) {
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

export async function getPlaylist(playlistId: string): Promise<RemotePlaylist | null> {
  const data = await gqlRequest<{ playlist: RemotePlaylist | null }>(GET_PLAYLIST, { id: playlistId });
  return data.playlist ?? null;
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
