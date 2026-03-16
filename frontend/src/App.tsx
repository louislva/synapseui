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
import { Button } from "./components/ui/button"
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
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
      </Button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-lg">
          {devices.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No devices found
            </div>
          ) : (
            devices.map((d) => {
              const isStarting = d.status === "Starting..."
              return (
                <Button
                  key={d.uri}
                  variant="ghost"
                  size="sm"
                  disabled={isStarting}
                  onClick={() => {
                    selectDevice(d.uri)
                    setOpen(false)
                  }}
                  className={`w-full justify-start ${
                    d.uri === selectedUri ? "bg-muted" : ""
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${statusColor(d.status)}`}
                  />
                  <span className="flex-1 text-left truncate">
                    {d.name}
                    {d.simulator && (
                      <span className="ml-1 text-[10px] text-blue-400">SIM</span>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {d.uri}
                  </span>
                </Button>
              )
            })
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfigsOpen(!configsOpen)}
            className={configsOpen ? "bg-muted" : "text-muted-foreground"}
          >
            <FileSliders className="size-3.5" />
            Configs
          </Button>

          <div className="flex-1" />

          {/* Center: Device selector + Deploy + Start/Stop */}
          <DeviceDropdown devices={devices} />

          <Button
            variant="outline"
            size="sm"
            onClick={handleDeploy}
            disabled={!canDeploy || deploying}
            className={
              !canDeploy && !deploying
                ? "border-transparent text-muted-foreground opacity-50"
                : ""
            }
          >
            {deploying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {isDeployed ? "Deployed" : "Deploy"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleStartStop}
            disabled={!selectedUri || startingStopping}
            className={
              !selectedUri && !startingStopping
                ? "border-transparent text-muted-foreground opacity-50"
                : ""
            }
          >
            {startingStopping ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : isRunning ? (
              <Square className="size-3 fill-current" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
            {isRunning ? "Stop" : "Start"}
          </Button>

          <div className="flex-1" />

          {/* Right: Devices toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDevicesOpen(!devicesOpen)}
            className={devicesOpen ? "bg-muted" : "text-muted-foreground"}
          >
            <Cpu className="size-3.5" />
            Devices
          </Button>
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
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={launchSimulator}
                    title="Launch simulator"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={refresh}
                    disabled={status === "searching"}
                  >
                    <RefreshCw className="size-3.5" />
                  </Button>
                </div>
              </div>

              {status === "searching" && devices.length === 0 && (
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

              {devices.length > 0 && (
                <ul className="space-y-2">
                  {devices.map((d) => {
                    const isStarting = d.status === "Starting..."
                    return (
                      <li
                        key={d.uri}
                        onClick={() => !isStarting && selectDevice(d.uri)}
                        className={`rounded-md border p-2 transition-colors ${
                          isStarting
                            ? "border-border opacity-50 cursor-default"
                            : d.uri === selectedUri
                              ? "border-ring bg-muted/50 cursor-pointer"
                              : "border-border hover:bg-muted/30 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium flex items-center gap-1.5 min-w-0">
                            <span
                              className={`inline-block size-1.5 rounded-full shrink-0 ${statusColor(d.status)}`}
                            />
                            <span className="truncate">{d.name}</span>
                            {d.simulator && (
                              <span className="shrink-0 text-[10px] font-medium text-blue-400 bg-blue-500/10 rounded px-1">
                                SIM
                              </span>
                            )}
                          </div>
                          {d.simulator && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                killSimulator(d.simulator!.id)
                              }}
                              title="Kill simulator"
                              className="size-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <X className="size-3" />
                            </Button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.uri} · {d.status}
                        </div>
                        {d.simulator && (
                          <div className="text-xs text-muted-foreground">
                            PID {d.simulator.pid}
                          </div>
                        )}
                        {d.serial && (
                          <div className="text-xs text-muted-foreground">
                            {d.serial}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {status === "error" && devices.length === 0 && (
                <p className="text-sm text-destructive">
                  Failed to reach discovery service.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  )
}

export default App
