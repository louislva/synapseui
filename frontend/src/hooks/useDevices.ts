import { useState, useEffect, useCallback, useMemo } from "react"

export interface Device {
  uri: string
  host: string
  port: number
  capability?: string
  name: string
  serial: string
  status: string
}

export interface Simulator {
  id: string
  pid: number
  name: string
  uri: string
  rpc_port: number
  running: boolean
}

export type MergedDevice = Device & { simulator?: Simulator }

export type DiscoveryStatus = "searching" | "ready" | "error"

export function useDevices(enabled: boolean, intervalMs = 5_000) {
  const [devices, setDevices] = useState<Device[]>([])
  const [simulators, setSimulators] = useState<Simulator[]>([])
  const [status, setStatus] = useState<DiscoveryStatus>("searching")

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices")
      if (res.ok) {
        const data = await res.json()
        setDevices(data.devices)
        setStatus("ready")
      } else {
        setStatus("error")
      }
    } catch {
      setStatus("error")
    }
  }, [])

  const fetchSimulators = useCallback(async () => {
    try {
      const res = await fetch("/api/simulators")
      if (res.ok) {
        const data = await res.json()
        setSimulators(data.simulators)
      }
    } catch {
      // ignore
    }
  }, [])

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchDevices(), fetchSimulators()])
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

  // Merge at display time: enrich discovered devices with sim info,
  // then append placeholders for simulators not yet discovered
  const mergedDevices = useMemo<MergedDevice[]>(() => {
    const discoveredNames = new Set(devices.map((d) => d.name))

    const enriched: MergedDevice[] = devices.map((d) => {
      const sim = simulators.find((s) => s.name === d.name)
      return sim ? { ...d, simulator: sim } : d
    })

    const placeholders: MergedDevice[] = simulators
      .filter((s) => s.running && !discoveredNames.has(s.name))
      .map((s) => ({
        uri: s.uri,
        host: "127.0.0.1",
        port: s.rpc_port,
        name: s.name,
        serial: "",
        status: "Starting...",
        simulator: s,
      }))

    return [...enriched, ...placeholders]
  }, [devices, simulators])

  const launchSimulator = useCallback(async () => {
    try {
      const res = await fetch("/api/simulators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()

      const newSim: Simulator = {
        id: data.id,
        pid: data.pid,
        name: data.name,
        uri: data.uri,
        rpc_port: data.rpc_port,
        running: true,
      }

      // Overwrite by name
      setSimulators((prev) => [
        ...prev.filter((s) => s.name !== newSim.name),
        newSim,
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
        setSimulators((prev) => prev.filter((s) => s.id !== id))
        fetchDevices()
      } catch {
        // ignore
      }
    },
    [fetchDevices],
  )

  const updateDeviceStatus = useCallback((uri: string, newStatus: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.uri === uri ? { ...d, status: newStatus } : d)),
    )
  }, [])

  return {
    devices: mergedDevices,
    status,
    refresh,
    launchSimulator,
    killSimulator,
    updateDeviceStatus,
  }
}
