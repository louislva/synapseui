import { create } from "zustand"

interface DeviceStore {
  selectedSerial: string | null
  selectDevice: (serial: string | null) => void
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  selectedSerial: null,
  selectDevice: (serial) => set({ selectedSerial: serial }),
}))
