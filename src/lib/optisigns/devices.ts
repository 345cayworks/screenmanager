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

const GET_DEVICES = /* GraphQL */ `
  query GetDevices {
    devices {
      _id
      deviceName
      currentType
      currentAssetId
    }
  }
`;

export async function getDevices() {
  const data = await gqlRequest<{
    devices: Array<{ _id: string; deviceName?: string; currentType?: string; currentAssetId?: string }>;
  }>(GET_DEVICES);
  return data.devices;
}
