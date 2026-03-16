import { create } from "zustand"

interface DeviceStore {
  selectedUri: string | null
  selectDevice: (uri: string | null) => void

  // Track the config hash that was last deployed to each device
  deployedHashes: Record<string, string>
  setDeployedHash: (uri: string, hash: string) => void
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  selectedUri: null,
  selectDevice: (uri) => set({ selectedUri: uri }),

  deployedHashes: {},
  setDeployedHash: (uri, hash) =>
    set({ deployedHashes: { ...get().deployedHashes, [uri]: hash } }),
}))
