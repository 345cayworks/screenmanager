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

const GET_DEVICES = /* GraphQL */ `
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

const GET_DEVICES_NO_ARGS = /* GraphQL */ `
  query GetDevices {
    devices {
      page {
        _id
        deviceName
        currentType
        currentAssetId
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

export async function getDevices(): Promise<RemoteDevice[]> {
  try {
    const data = await gqlRequest<{ devices: { page: RemoteDevice[] } }>(GET_DEVICES, { first: 500 });
    return data.devices?.page ?? [];
  } catch (err) {
    // Some schema variants reject the `first` arg — fall back to no-args.
    if (err instanceof Error && /\$first|argument/i.test(err.message)) {
      const data = await gqlRequest<{ devices: { page: RemoteDevice[] } }>(GET_DEVICES_NO_ARGS);
      return data.devices?.page ?? [];
    }
    throw err;
  }
}
