import { useState, useEffect } from "react"
import { useDeviceStore } from "../store/useDeviceStore"
import { Button } from "./ui/button"

const STORAGE_KEY = "synapseui-stream-hint-dismissed"

interface StreamHintProps {
  onOpenStream: () => void
}

export function StreamHint({ onOpenStream }: StreamHintProps) {
  const [visible, setVisible] = useState(false)
  const taps = useDeviceStore((s) => s.taps)
  const requestStreamTap = useDeviceStore((s) => s.requestStreamTap)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1")
    setVisible(false)
  }

  return (
    <div className="absolute top-full right-0 mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="relative rounded-lg border border-border bg-popover px-4 py-3 shadow-lg max-w-xs">
        <div className="absolute -top-[6px] right-6 size-3 rotate-45 border-l border-t border-border bg-popover" />
        <div>
            <p className="text-sm text-foreground font-medium mb-1">
              Your device is running!
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Open the Stream panel to watch live output from your signal chain in real time.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  if (taps.length > 0) {
                    requestStreamTap(taps[0].name)
                  }
                  onOpenStream()
                  dismiss()
                }}
              >
                Open Stream
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={dismiss}
                className="text-muted-foreground"
              >
                Dismiss
              </Button>
            </div>
        </div>
      </div>
    </div>
  )
}
