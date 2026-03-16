import { useState, useRef, useEffect } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import {
  ChevronDown,
  Cpu,
  FileSliders,
  Loader2,
  Plus,
  RefreshCw,
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
import { serializeGraph } from "./lib/serialize"
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
  const { selectedSerial, selectDevice } = useDeviceStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = devices.find((d) => d.serial === selectedSerial)

  // Auto-select first device if current selection is gone
  useEffect(() => {
    if (selectedSerial && !devices.find((d) => d.serial === selectedSerial)) {
      selectDevice(devices.length > 0 ? devices[0].serial : null)
    }
  }, [devices, selectedSerial, selectDevice])

  // Close on outside click
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
            <span className={`size-1.5 rounded-full ${statusColor(selected.status)}`} />
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
                key={d.serial}
                onClick={() => {
                  selectDevice(d.serial)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  d.serial === selectedSerial
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className={`size-1.5 rounded-full ${statusColor(d.status)}`} />
                <span className="flex-1 text-left truncate">{d.name}</span>
                <span className="text-[10px] text-muted-foreground">{d.serial}</span>
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
  const { devices, status, simulators, refresh, launchSimulator, killSimulator } =
    useDevices(true)

  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const activeConfigId = useConfigStore((s) => s.activeConfigId)
  const saveActiveConfig = useConfigStore((s) => s.saveActiveConfig)
  const selectedSerial = useDeviceStore((s) => s.selectedSerial)
  const selectDevice = useDeviceStore((s) => s.selectDevice)

  const handleDeploy = () => {
    saveActiveConfig()
    const payload = serializeGraph(nodes, edges)
    console.log(
      `Deploy to device ${selectedSerial}:`,
      JSON.stringify(payload, null, 2),
    )
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

          {/* Center: Device selector + Deploy */}
          <DeviceDropdown devices={devices} />

          <button
            onClick={handleDeploy}
            disabled={!activeConfigId || nodes.length === 0 || !selectedSerial}
            className="inline-flex items-center gap-1.5 rounded-md px-3 h-7 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <Upload className="size-3.5" />
            Deploy
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
                      key={d.serial}
                      onClick={() => selectDevice(d.serial)}
                      className={`rounded-md border p-2 cursor-pointer transition-colors ${
                        d.serial === selectedSerial
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
                        {d.host}:{d.port} · {d.status}
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
                              s.running ? "bg-green-500" : "bg-muted-foreground"
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
