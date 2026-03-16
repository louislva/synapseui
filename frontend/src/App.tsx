import { useState, useCallback, useMemo, useEffect } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import {
  AlertTriangle,
  Cpu,
  FileSliders,
  Loader2,
  Play,
  Radio,
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
import { StreamPanel } from "./components/StreamPanel"
import { OnboardingOverlay, useOnboarding } from "./components/OnboardingOverlay"
import { DeviceHint } from "./components/DeviceHint"
import { StreamHint } from "./components/StreamHint"
import { serializeGraph, configHash } from "./lib/serialize"
import { Button } from "./components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip"

function App() {
  const { showOnboarding, dismissOnboarding } = useOnboarding()
  const [configsOpen, setConfigsOpen] = useState(true)
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [streamOpen, setStreamOpen] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [startingStopping, setStartingStopping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showError = useCallback((msg: string) => {
    setError(msg)
    setTimeout(() => setError(null), 5000)
  }, [])
  const {
    devices,
    status,
    refresh,
    launchSimulator,
    killSimulator,
    updateDeviceStatus,
  } = useDevices(true, 5_000, showError)

  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const activeConfigId = useConfigStore((s) => s.activeConfigId)
  const saveActiveConfig = useConfigStore((s) => s.saveActiveConfig)
  const selectedUri = useDeviceStore((s) => s.selectedUri)
  const deployedHashes = useDeviceStore((s) => s.deployedHashes)
  const setDeployedHash = useDeviceStore((s) => s.setDeployedHash)
  const setTaps = useDeviceStore((s) => s.setTaps)
  const pendingTapName = useDeviceStore((s) => s.pendingTapName)

  // Poll for available taps on the selected device
  useEffect(() => {
    if (!selectedUri) {
      setTaps([])
      return
    }
    let cancelled = false
    const fetchTaps = async () => {
      try {
        const res = await fetch(
          `/api/devices/taps?uri=${encodeURIComponent(selectedUri)}`,
        )
        if (res.ok && !cancelled) {
          const data = await res.json()
          setTaps(data.taps ?? [])
        }
      } catch (e) {
        console.warn("Failed to fetch taps:", e)
      }
    }
    fetchTaps()
    const id = setInterval(fetchTaps, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedUri, setTaps])

  // When a node requests to open a specific tap, open the stream panel
  useEffect(() => {
    if (pendingTapName) {
      setStreamOpen(true)
    }
  }, [pendingTapName])

  const selectedDevice = devices.find((d) => d.uri === selectedUri)
  const isRunning = selectedDevice?.status === "Running"

  const currentHash = useMemo(() => configHash(nodes, edges), [nodes, edges])
  const isDeployed =
    selectedUri != null && deployedHashes[selectedUri] === currentHash
  const canDeploy =
    !!activeConfigId && nodes.length > 0 && !!selectedUri && !isDeployed
  const hasDeployedToDevice =
    selectedUri != null && selectedUri in deployedHashes

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
        showError(`Deploy failed: ${err.detail || res.statusText}`)
        return
      }
      setDeployedHash(selectedUri, currentHash)
    } catch (e) {
      showError(`Deploy failed: ${e instanceof Error ? e.message : "Network error"}`)
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
        showError(`${action.charAt(0).toUpperCase() + action.slice(1)} failed: ${err.detail || res.statusText}`)
        return
      }
      const data = await res.json()
      updateDeviceStatus(selectedUri, data.status)
    } catch (e) {
      showError(`${isRunning ? "Stop" : "Start"} failed: ${e instanceof Error ? e.message : "Network error"}`)
    } finally {
      setStartingStopping(false)
    }
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen">
        {/* Toolbar */}
        <div className="flex items-center h-11 px-3 gap-2 border-b border-border bg-background">
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

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="inline-flex">
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
              </TooltipTrigger>
              {!selectedUri && !deploying && (
                <TooltipContent side="bottom">
                  Select a connected device first
                </TooltipContent>
              )}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger className="inline-flex">
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
                  {!isRunning && selectedUri && !hasDeployedToDevice && !startingStopping && (
                    <AlertTriangle className="size-3 text-amber-400" />
                  )}
                </Button>
              </TooltipTrigger>
              {!selectedUri && !startingStopping ? (
                <TooltipContent side="bottom">
                  Select a connected device first
                </TooltipContent>
              ) : selectedUri && !isRunning && !hasDeployedToDevice && !startingStopping ? (
                <TooltipContent side="bottom" className="max-w-56 text-center">
                  This will start the device with whatever config is already on it — deploy first to use your current config
                </TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStreamOpen(!streamOpen)}
            className={streamOpen ? "bg-muted" : "text-muted-foreground"}
          >
            <Radio className="size-3.5" />
            Stream
          </Button>

          <div className="flex-1" />

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

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/15 border-b border-red-500/30 text-red-400 text-sm">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="hover:text-red-300 cursor-pointer">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">
          {configsOpen && <ConfigsSidebar />}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <div className="relative flex-1 min-h-0">
              <NodeEditor />
              {activeConfigId && !selectedUri && (
                <DeviceHint onOpenDevices={() => setDevicesOpen(true)} />
              )}
              {isRunning && !streamOpen && (
                <StreamHint onOpenStream={() => setStreamOpen(true)} />
              )}
            </div>
            {streamOpen && (
              <StreamPanel onClose={() => setStreamOpen(false)} />
            )}
          </div>
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
      {showOnboarding && (
        <OnboardingOverlay
          onOpenConfigs={() => setConfigsOpen(true)}
          onOpenDevices={() => setDevicesOpen(true)}
          onDismiss={dismissOnboarding}
        />
      )}
    </ReactFlowProvider>
  )
}

export default App
