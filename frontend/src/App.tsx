import { useState, useRef, useEffect, useMemo } from "react"
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
import { DevicesSidebar } from "./components/DevicesSidebar"
import { DeviceDropdown } from "./components/DeviceDropdown"
import { ParameterPanel } from "./components/ParameterPanel"
import { serializeGraph, configHash } from "./lib/serialize"
import { Button } from "./components/ui/button"

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

  const currentHash = useMemo(() => configHash(nodes, edges), [nodes, edges])
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
          {devicesOpen && (
            <DevicesSidebar
              devices={devices}
              status={status}
              refresh={refresh}
              launchSimulator={launchSimulator}
              killSimulator={killSimulator}
            />
          )}
        </div>
      </div>
    </ReactFlowProvider>
  )
}

export default App
