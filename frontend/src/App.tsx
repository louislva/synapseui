import { useState } from 'react'
import { Cpu, Loader2, RefreshCw } from 'lucide-react'
import { useDevices } from './hooks/useDevices'

function App() {
  const [devicesOpen, setDevicesOpen] = useState(false)
  const { devices, status, refresh } = useDevices(devicesOpen)

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="flex items-center h-11 px-3 border-b border-border bg-background">
        <button
          onClick={() => setDevicesOpen(!devicesOpen)}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-sm font-medium transition-colors ${
            devicesOpen
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Cpu className="size-3.5" />
          Devices
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Devices side pane */}
        {devicesOpen && (
          <div className="w-64 border-r border-border bg-background p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground">Devices</h2>
              <button
                onClick={refresh}
                disabled={status === 'searching'}
                className="inline-flex items-center justify-center rounded-md size-6 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>

            {status === 'searching' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Searching...
              </div>
            )}

            {status === 'ready' && devices.length === 0 && (
              <p className="text-sm text-muted-foreground">No devices found.</p>
            )}

            {status === 'ready' && devices.length > 0 && (
              <ul className="space-y-2">
                {devices.map((d) => (
                  <li key={d.serial} className="rounded-md border border-border p-2">
                    <div className="text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.host}:{d.port}
                    </div>
                    <div className="text-xs text-muted-foreground">{d.serial}</div>
                  </li>
                ))}
              </ul>
            )}

            {status === 'error' && (
              <p className="text-sm text-destructive">
                Failed to reach discovery service.
              </p>
            )}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1" />
      </div>
    </div>
  )
}

export default App
