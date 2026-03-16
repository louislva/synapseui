import { Info, Loader2, Plus, RefreshCw, X } from "lucide-react"
import { useDeviceStore } from "../store/useDeviceStore"
import { statusColor } from "../lib/status"
import { Button } from "./ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip"
import type { MergedDevice, DiscoveryStatus } from "../hooks/useDevices"

interface DevicesSidebarProps {
  devices: MergedDevice[]
  status: DiscoveryStatus
  refresh: () => void
  launchSimulator: () => void
  killSimulator: (id: string) => void
}

export function DevicesSidebar({
  devices,
  status,
  refresh,
  launchSimulator,
  killSimulator,
}: DevicesSidebarProps) {
  const selectedUri = useDeviceStore((s) => s.selectedUri)
  const selectDevice = useDeviceStore((s) => s.selectDevice)

  return (
    <TooltipProvider>
    <div className="w-64 border-l border-border bg-background p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-muted-foreground">Devices</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={refresh}
          disabled={status === "searching"}
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {status === "searching" && devices.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Searching...
        </div>
      )}

      {status === "ready" && devices.length === 0 && (
        <p className="text-sm text-muted-foreground">No devices found.</p>
      )}

      {devices.length > 0 && (
        <ul className="space-y-2">
          {devices.map((d) => {
            const isStarting = d.status === "Connecting..."
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
                {d.simulator && (
                  <div className="flex items-center gap-1 text-xs text-blue-400 mt-0.5">
                    <span>Simulator</span>
                    <Tooltip>
                      <TooltipTrigger className="inline-flex cursor-help">
                        <Info className="size-3" />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        A virtual device running locally for development and testing. It emulates a real Synapse device.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{d.uri} · {d.status}</span>
                  <Tooltip>
                    <TooltipTrigger className="inline-flex cursor-help">
                      <Info className="size-3" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {d.status === "Running"
                        ? "Device is actively streaming data."
                        : d.status === "Stopped"
                          ? "Device is configured but not streaming. Press Start to begin."
                          : d.status === "Connecting..."
                            ? "Simulator is connecting..."
                            : d.status === "Error"
                              ? "Device encountered an error."
                              : `Device state: ${d.status}`}
                    </TooltipContent>
                  </Tooltip>
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

      <Button
        variant="outline"
        size="sm"
        onClick={launchSimulator}
        className="w-full mt-3"
      >
        <Plus className="size-3.5 mr-1.5" />
        Create simulator
      </Button>
    </div>
    </TooltipProvider>
  )
}
