import { useState, useEffect, useCallback } from "react"

export interface Device {
  host: string
  port: number
  capability: string
  name: string
  serial: string
}

type DiscoveryStatus = "searching" | "ready" | "error"

export function useDevices(enabled: boolean, intervalMs = 30_000) {
  const [devices, setDevices] = useState<Device[]>([])
  const [status, setStatus] = useState<DiscoveryStatus>("searching")

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices")
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()
      setDevices(data.devices)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    setStatus("searching")
    fetchDevices()
    const id = setInterval(fetchDevices, intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs, fetchDevices])

  const refresh = useCallback(() => {
    setStatus("searching")
    fetchDevices()
  }, [fetchDevices])

  return { devices, status, refresh }
}
