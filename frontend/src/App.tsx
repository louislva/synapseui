import { useState, useRef, useEffect } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import {
  ChevronDown,
  Cpu,
  FileSliders,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Square,
  Upload,
  X,
} from "lucide-react"
import { useDevices } from "./hooks/useDevices"
import { useGraphStore } from "./store/useGraphStore"
import { useConfigStore } from "./store/useConfigStore"
import { useDeviceStore } from "./store/useDeviceStore"
import { NodeEditor } from "./components/NodeEditor"
import { ConfigsSidebar } from "./components/ConfigsSidebar"
import { ParameterPanel } from "./components/ParameterPanel"
import { serializeGraph, configHash } from "./lib/serialize"
import type { Device } from "./hooks/useDevices"

function statusColor(status: string) {
  switch (status) {
    case "Running":
      return "bg-green-500"
    case "Stopped":
      return "bg-yellow-500"
    case "Error":
    case "Unreachable":
      return "bg-red-500"
    default:
      return "bg-muted-foreground"
  }
}

function DeviceDropdown({ devices }: { devices: Device[] }) {
  const { selectedUri, selectDevice } = useDeviceStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = devices.find((d) => d.uri === selectedUri)

  useEffect(() => {
    if (selectedUri && !devices.find((d) => d.uri === selectedUri)) {
      selectDevice(devices.length > 0 ? devices[0].uri : null)
    }
  }, [devices, selectedUri, selectDevice])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-sm font-medium border border-border bg-background hover:bg-muted/50 transition-colors"
      >
        {selected ? (
          <>
            <span
              className={`size-1.5 rounded-full ${statusColor(selected.status)}`}
            />
            <span className="max-w-[120px] truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">No device</span>
        )}
        <ChevronDown className="size-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-lg">
          {devices.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No devices found
            </div>
          ) : (
            devices.map((d) => (
              <button
                key={d.uri}
                onClick={() => {
                  selectDevice(d.uri)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  d.uri === selectedUri
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted/50"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${statusColor(d.status)}`}
                />
                <span className="flex-1 text-left truncate">{d.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {d.uri}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function App() {
  const [configsOpen, setConfigsOpen] = useState(true)
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [startingStopping, setStartingStopping] = useState(false)
  const {
    devices,
    status,
    simulators,
    refresh,
    launchSimulator,
    killSimulator,
    updateDeviceStatus,
  } = useDevices(true)

  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const activeConfigId = useConfigStore((s) => s.activeConfigId)
  const saveActiveConfig = useConfigStore((s) => s.saveActiveConfig)
  const selectedUri = useDeviceStore((s) => s.selectedUri)
  const selectDevice = useDeviceStore((s) => s.selectDevice)
  const deployedHashes = useDeviceStore((s) => s.deployedHashes)
  const setDeployedHash = useDeviceStore((s) => s.setDeployedHash)

  const selectedDevice = devices.find((d) => d.uri === selectedUri)
  const isRunning = selectedDevice?.status === "Running"

  const currentHash = configHash(nodes, edges)
  const isDeployed =
    selectedUri != null && deployedHashes[selectedUri] === currentHash
  const canDeploy =
    !!activeConfigId && nodes.length > 0 && !!selectedUri && !isDeployed

  const handleDeploy = async () => {
    if (!selectedUri || !canDeploy) return
    setDeploying(true)
    try {
      saveActiveConfig()
      const payload = serializeGraph(nodes, edges)
      const res = await fetch(
        `/api/devices/configure?uri=${encodeURIComponent(selectedUri)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error("Deploy failed:", err)
        return
      }
      setDeployedHash(selectedUri, currentHash)
    } catch (e) {
      console.error("Deploy failed:", e)
    } finally {
      setDeploying(false)
    }
  }

  const handleStartStop = async () => {
    if (!selectedUri) return
    setStartingStopping(true)
    try {
      const action = isRunning ? "stop" : "start"
      const res = await fetch(
        `/api/devices/${action}?uri=${encodeURIComponent(selectedUri)}`,
        { method: "POST" },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error(`${action} failed:`, err)
        return
      }
      const data = await res.json()
      updateDeviceStatus(selectedUri, data.status)
    } catch (e) {
      console.error("Start/stop failed:", e)
    } finally {
      setStartingStopping(false)
    }
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen">
        {/* Toolbar */}
        <div className="flex items-center h-11 px-3 gap-2 border-b border-border bg-background">
          {/* Left: Configs toggle */}
          <button
            onClick={() => setConfigsOpen(!configsOpen)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-sm font-medium transition-colors ${
              configsOpen
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <FileSliders className="size-3.5" />
            Configs
          </button>

          <div className="flex-1" />

          {/* Center: Device selector + Deploy + Start/Stop */}
          <DeviceDropdown devices={devices} />

          <button
            onClick={handleDeploy}
            disabled={!canDeploy || deploying}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-sm font-medium transition-colors border ${
              canDeploy
                ? "border-border text-foreground hover:bg-muted"
                : "border-transparent text-muted-foreground opacity-50"
            } disabled:pointer-events-none`}
          >
            {deploying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {isDeployed ? "Deployed" : "Deploy"}
          </button>

          <button
            onClick={handleStartStop}
            disabled={!selectedUri || startingStopping}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-sm font-medium transition-colors border ${
              selectedUri
                ? "border-border text-foreground hover:bg-muted"
                : "border-transparent text-muted-foreground opacity-50"
            } disabled:pointer-events-none`}
          >
            {startingStopping ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : isRunning ? (
              <Square className="size-3 fill-current" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
            {isRunning ? "Stop" : "Start"}
          </button>

          <div className="flex-1" />

          {/* Right: Devices toggle */}
          <button
            onClick={() => setDevicesOpen(!devicesOpen)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-sm font-medium transition-colors ${
              devicesOpen
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Cpu className="size-3.5" />
            Devices
          </button>
        </div>

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Configs sidebar (left) */}
          {configsOpen && <ConfigsSidebar />}

          {/* Node editor canvas */}
          <NodeEditor />

          {/* Parameter panel (right, when node selected) */}
          {selectedNodeId && <ParameterPanel />}

          {/* Devices sidebar (right) */}
          {devicesOpen && (
            <div className="w-64 border-l border-border bg-background p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Devices
                </h2>
                <button
                  onClick={refresh}
                  disabled={status === "searching"}
                  className="inline-flex items-center justify-center rounded-md size-6 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="size-3.5" />
                </button>
              </div>

              {status === "searching" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Searching...
                </div>
              )}

              {status === "ready" && devices.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No devices found.
                </p>
              )}

              {status === "ready" && devices.length > 0 && (
                <ul className="space-y-2">
                  {devices.map((d) => (
                    <li
                      key={d.uri}
                      onClick={() => selectDevice(d.uri)}
                      className={`rounded-md border p-2 cursor-pointer transition-colors ${
                        d.uri === selectedUri
                          ? "border-ring bg-muted/50"
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        <span
                          className={`inline-block size-1.5 rounded-full ${statusColor(d.status)}`}
                        />
                        {d.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {d.uri} · {d.status}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {d.serial}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {status === "error" && (
                <p className="text-sm text-destructive">
                  Failed to reach discovery service.
                </p>
              )}

              {/* Simulators section */}
              <div className="flex items-center justify-between mt-6 mb-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Simulators
                </h2>
                <button
                  onClick={launchSimulator}
                  className="inline-flex items-center justify-center rounded-md size-6 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  title="Launch simulator"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>

              {simulators.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No simulators running.
                </p>
              )}

              {simulators.length > 0 && (
                <ul className="space-y-2">
                  {simulators.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-md border border-border p-2 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          <span
                            className={`inline-block size-1.5 rounded-full ${
                              s.running ? "bg-blue-500" : "bg-muted-foreground"
                            }`}
                          />
                          Sim {s.id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          PID {s.pid}
                        </div>
                      </div>
                      {s.running && (
                        <button
                          onClick={() => killSimulator(s.id)}
                          className="inline-flex items-center justify-center rounded-md size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Stop simulator"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  )
}

export default App
