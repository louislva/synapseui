import { useState, useEffect, useCallback } from "react"

export interface SimulatorMeta {
  id: string
  pid: number
  name: string
}

export interface Device {
  uri: string
  host: string
  port: number
  capability?: string
  name: string
  serial: string
  status: string
  simulator?: SimulatorMeta
}

interface SimulatorResponse {
  id: string
  pid: number
  running: boolean
  name: string
  uri: string
  rpc_port: number
}

export type DiscoveryStatus = "searching" | "ready" | "error"

export function useDevices(enabled: boolean, intervalMs = 5_000) {
  const [devices, setDevices] = useState<Device[]>([])
  const [status, setStatus] = useState<DiscoveryStatus>("searching")

  const fetchAll = useCallback(async () => {
    try {
      const [devRes, simRes] = await Promise.all([
        fetch("/api/devices"),
        fetch("/api/simulators"),
      ])

      const devData = devRes.ok ? await devRes.json() : { devices: [] }
      const simData = simRes.ok ? await simRes.json() : { simulators: [] }

      const discovered: Device[] = devData.devices
      const sims: SimulatorResponse[] = simData.simulators

      const discoveredUris = new Set(discovered.map((d: Device) => d.uri))

      // Create placeholders for simulators not yet discovered
      const placeholders: Device[] = sims
        .filter((s) => s.running && !discoveredUris.has(s.uri))
        .map((s) => ({
          uri: s.uri,
          host: "127.0.0.1",
          port: s.rpc_port,
          name: s.name,
          serial: "",
          status: "Starting...",
          simulator: { id: s.id, pid: s.pid, name: s.name },
        }))

      setDevices([...discovered, ...placeholders])
      setStatus(devRes.ok ? "ready" : "error")
    } catch {
      setStatus("error")
    }
  }, [])

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
      const res = await fetch("/api/simulators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()

      // Immediately add placeholder
      setDevices((prev) => [
        ...prev,
        {
          uri: data.uri,
          host: "127.0.0.1",
          port: data.rpc_port,
          name: data.name,
          serial: "",
          status: "Starting...",
          simulator: { id: data.id, pid: data.pid, name: data.name },
        },
      ])
    } catch {
      // ignore
    }
  }, [])

  const killSimulator = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/simulators/${id}`, { method: "DELETE" })
        if (!res.ok) throw new Error(res.statusText)
        // Remove from local state immediately
        setDevices((prev) => prev.filter((d) => d.simulator?.id !== id))
        fetchAll()
      } catch {
        // ignore
      }
    },
    [fetchAll],
  )

  const updateDeviceStatus = useCallback((uri: string, newStatus: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.uri === uri ? { ...d, status: newStatus } : d)),
    )
  }, [])

  return { devices, status, refresh, launchSimulator, killSimulator, updateDeviceStatus }
}
