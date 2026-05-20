// OptiSigns device operations.
// IMPORTANT — schema confirmation required: see note in playlists.ts.

import { gqlRequest } from "./client";

const UPDATE_DEVICE = /* GraphQL */ `
  mutation UpdateDevice($payload: UpdateDeviceInput!) {
    updateDevice(payload: $payload) {
      _id
      currentType
      currentAssetId
    }
  }
`;

/**
 * Assign a playlist to a device/screen. This is the call that actually makes
 * the screen play the playlist.
 */
export async function assignPlaylistToDevice(deviceId: string, playlistId: string) {
  return gqlRequest<{
    updateDevice: { _id: string; currentType: string; currentAssetId: string };
  }>(UPDATE_DEVICE, {
    payload: {
      _id: deviceId,
      currentType: "PLAYLIST",
      currentAssetId: playlistId,
    },
  });
}

// OptiSigns wraps list responses in a paginated DeviceResponse type with the
// actual records under `.page`. We default to a large page size but expose
// the option to paginate later.

// We try the richest shape we think Device exposes, falling back through
// progressively safer shapes if any field is rejected.

const GET_DEVICES_RICH = /* GraphQL */ `
  query GetDevices($first: Int) {
    devices(first: $first) {
      page {
        _id
        deviceName
        currentType
        currentAssetId
      }
    }
  }
`;

const GET_DEVICES_BARE = /* GraphQL */ `
  query GetDevices($first: Int) {
    devices(first: $first) {
      page {
        _id
        deviceName
      }
    }
  }
`;

const GET_DEVICES_BARE_NO_ARGS = /* GraphQL */ `
  query GetDevices {
    devices {
      page {
        _id
        deviceName
      }
    }
  }
`;

export type RemoteDevice = {
  _id: string;
  deviceName?: string;
  currentType?: string;
  currentAssetId?: string;
};

async function attempt(query: string, variables?: Record<string, unknown>): Promise<RemoteDevice[] | null> {
  try {
    const data = await gqlRequest<{ devices: { page: RemoteDevice[] } }>(query, variables);
    return data.devices?.page ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/Cannot query field|argument|\$first/i.test(msg)) return null;
    throw err;
  }
}

export async function getDevices(): Promise<RemoteDevice[]> {
  return (
    (await attempt(GET_DEVICES_RICH, { first: 500 })) ??
    (await attempt(GET_DEVICES_BARE, { first: 500 })) ??
    (await attempt(GET_DEVICES_BARE_NO_ARGS)) ??
    []
  );
}
