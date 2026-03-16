import { useState, useEffect, useCallback } from "react"

export interface Device {
  host: string
  port: number
  capability: string
  name: string
  serial: string
}

export interface Simulator {
  id: string
  pid: number
  running: boolean
}

type DiscoveryStatus = "searching" | "ready" | "error"

export function useDevices(enabled: boolean, intervalMs = 30_000) {
  const [devices, setDevices] = useState<Device[]>([])
  const [status, setStatus] = useState<DiscoveryStatus>("searching")
  const [simulators, setSimulators] = useState<Simulator[]>([])

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

  const fetchSimulators = useCallback(async () => {
    try {
      const res = await fetch("/api/simulators")
      if (!res.ok) return
      const data = await res.json()
      setSimulators(data.simulators)
    } catch {
      // ignore — simulators list is non-critical
    }
  }, [])

  const fetchAll = useCallback(() => {
    fetchDevices()
    fetchSimulators()
  }, [fetchDevices, fetchSimulators])

  useEffect(() => {
    if (!enabled) return
    setStatus("searching")
    fetchAll()
    const id = setInterval(fetchAll, intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs, fetchAll])

  const refresh = useCallback(() => {
    setStatus("searching")
    fetchAll()
  }, [fetchAll])

  const launchSimulator = useCallback(async () => {
    try {
      const res = await fetch("/api/simulators", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      if (!res.ok) throw new Error(res.statusText)
      // refresh after a short delay to let the simulator register with discovery
      setTimeout(() => {
        fetchAll()
      }, 2000)
      await fetchSimulators()
    } catch {
      // ignore
    }
  }, [fetchAll, fetchSimulators])

  const killSimulator = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/simulators/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(res.statusText)
      await fetchAll()
    } catch {
      // ignore
    }
  }, [fetchAll])

  return { devices, status, simulators, refresh, launchSimulator, killSimulator }
}
