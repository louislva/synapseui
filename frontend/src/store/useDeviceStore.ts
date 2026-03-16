import { create } from "zustand"

export interface TapInfo {
  name: string
  message_type: string
  endpoint: string
  tap_type: number
}

interface DeviceStore {
  selectedUri: string | null
  selectDevice: (uri: string | null) => void

  // Track the config hash that was last deployed to each device
  deployedHashes: Record<string, string>
  setDeployedHash: (uri: string, hash: string) => void

  // Available taps on the selected device
  taps: TapInfo[]
  setTaps: (taps: TapInfo[]) => void

  // When a node requests to open a tap in the stream panel
  pendingTapName: string | null
  requestStreamTap: (tapName: string) => void
  clearPendingTap: () => void
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  selectedUri: null,
  selectDevice: (uri) => set({ selectedUri: uri }),

  deployedHashes: {},
  setDeployedHash: (uri, hash) =>
    set({ deployedHashes: { ...get().deployedHashes, [uri]: hash } }),

  taps: [],
  setTaps: (taps) => set({ taps }),

  pendingTapName: null,
  requestStreamTap: (tapName) => set({ pendingTapName: tapName }),
  clearPendingTap: () => set({ pendingTapName: null }),
}))
