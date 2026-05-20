// OptiSigns device operations.
//
// Confirmed against tenant introspection (May 2026):
//   devices: DeviceResponse!
//     page: DeviceConnection!
//       edges: [DeviceEdge!]
//         node: Device
//   updateDevice: DeviceDetailResponse!

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
 * Assign a playlist to a device/screen.
 */
export async function assignPlaylistToDevice(deviceId: string, playlistId: string) {
  return gqlRequest<{
    updateDevice: { _id: string; currentType?: string; currentAssetId?: string };
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
      page {
        edges {
          node {
            _id
            deviceName
            currentType
            currentAssetId
          }
        }
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

type DevicesQueryResult = {
  devices: {
    page: { edges: Array<{ node: RemoteDevice | null }> | null } | null;
  } | null;
};

export async function getDevices(): Promise<RemoteDevice[]> {
  const data = await gqlRequest<DevicesQueryResult>(GET_DEVICES);
  const edges = data.devices?.page?.edges ?? [];
  return edges.map((e) => e.node).filter((n): n is RemoteDevice => !!n);
}
