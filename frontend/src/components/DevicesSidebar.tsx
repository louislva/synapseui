import { Loader2, Plus, RefreshCw, X } from "lucide-react"
import { useDeviceStore } from "../store/useDeviceStore"
import { statusColor } from "../lib/status"
import { Button } from "./ui/button"
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
    <div className="w-64 border-l border-border bg-background p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-muted-foreground">Devices</h2>
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
        <p className="text-sm text-muted-foreground">No devices found.</p>
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
  )
}
