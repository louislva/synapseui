import { useState } from 'react'
import { Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'

function App() {
  const [devicesOpen, setDevicesOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="flex items-center h-11 px-3 border-b border-border bg-background">
        <Button
          variant={devicesOpen ? 'outline' : 'ghost'}
          size="sm"
          onClick={() => setDevicesOpen(!devicesOpen)}
        >
          <Cpu className="size-3.5" />
          Devices
        </Button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Devices side pane */}
        {devicesOpen && (
          <div className="w-64 border-r border-border bg-background p-4 overflow-y-auto">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Devices</h2>
            <p className="text-sm text-muted-foreground">No devices connected.</p>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1" />
      </div>
    </div>
  )
}

export default App
