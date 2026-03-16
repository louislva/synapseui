import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import { useDeviceStore } from "../store/useDeviceStore"
import { statusColor } from "../lib/status"
import { Button } from "./ui/button"
import type { Device } from "../hooks/useDevices"

export function DeviceDropdown({ devices }: { devices: Device[] }) {
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
