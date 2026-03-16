import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronDown, X } from "lucide-react"
import { useDeviceStore } from "../store/useDeviceStore"

interface TapInfo {
  name: string
  message_type: string
  endpoint: string
  tap_type: number
}

interface StreamMessage {
  frames?: Array<Record<string, unknown>>
  status?: string
  error?: string
  tap_name?: string
  message_type?: string
}

const MAX_MESSAGES = 200

export function StreamPanel({ onClose }: { onClose: () => void }) {
  const selectedUri = useDeviceStore((s) => s.selectedUri)
  const [taps, setTaps] = useState<TapInfo[]>([])
  const [selectedTap, setSelectedTap] = useState<string>("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [messages, setMessages] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [fps, setFps] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fpsCountRef = useRef(0)
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch taps when device changes
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
      } catch {
        // ignore
      }
    }
    fetchTaps()
    // Re-fetch every 5s in case device state changes
    const id = setInterval(fetchTaps, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedUri])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as HTMLElement)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [dropdownOpen])

  // FPS counter
  useEffect(() => {
    fpsIntervalRef.current = setInterval(() => {
      setFps(fpsCountRef.current)
      fpsCountRef.current = 0
    }, 1000)
    return () => {
      if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current)
    }
  }, [])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
  }, [])

  const connectToTap = useCallback(
    (tapName: string) => {
      disconnect()
      if (!tapName || !selectedUri) return

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const wsUrl = `${protocol}//${window.location.host}/api/devices/stream?uri=${encodeURIComponent(selectedUri)}&tap_name=${encodeURIComponent(tapName)}`

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setMessages([])
        setFrameCount(0)
        fpsCountRef.current = 0
      }

      ws.onmessage = (event) => {
        const msg: StreamMessage = JSON.parse(event.data)

        if (msg.error) {
          setMessages((prev) => [
            ...prev.slice(-MAX_MESSAGES),
            `ERROR: ${msg.error}`,
          ])
          return
        }

        if (msg.status === "connected") {
          setConnected(true)
          setMessages((prev) => [
            ...prev.slice(-MAX_MESSAGES),
            `Connected to tap "${msg.tap_name}" (${msg.message_type})`,
          ])
          return
        }

        if (msg.frames) {
          const lines = msg.frames.map((f) => {
            if (f.type === "broadband") {
              const samples = f.frame_data as number[]
              const preview = samples
                .slice(0, 8)
                .map((s) => String(s).padStart(5))
                .join(", ")
              return `seq=${String(f.sequence_number).padStart(8)} t=${f.timestamp_ns} rate=${f.sample_rate_hz} ch=${f.num_channels} [${preview}]`
            }
            return JSON.stringify(f)
          })
          setMessages((prev) => [...prev.slice(-MAX_MESSAGES), ...lines])
          setFrameCount((c) => c + msg.frames!.length)
          fpsCountRef.current += msg.frames.length
        }
      }

      ws.onclose = () => {
        setConnected(false)
        setMessages((prev) => [...prev.slice(-MAX_MESSAGES), "Disconnected"])
      }
    },
    [selectedUri, disconnect],
  )

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [messages])

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const handleSelectTap = (tapName: string) => {
    setSelectedTap(tapName)
    setDropdownOpen(false)
    if (tapName === "") {
      disconnect()
      setMessages([])
      setFrameCount(0)
    } else {
      connectToTap(tapName)
    }
  }

  const selectedTapInfo = taps.find((t) => t.name === selectedTap)

  return (
    <div className="border-t border-border bg-background flex flex-col h-[280px] min-h-[120px]">
      {/* Header */}
      <div className="flex items-center h-9 px-3 gap-2 border-b border-border bg-muted/30 shrink-0">
        <span className="text-xs font-medium text-muted-foreground">
          Stream
        </span>

        {/* Tap dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 h-6 text-xs font-medium border border-border bg-background hover:bg-muted/50 transition-colors"
          >
            {connected && (
              <span className="size-1.5 rounded-full bg-green-500" />
            )}
            <span className="max-w-[200px] truncate">
              {selectedTap || "Select tap..."}
            </span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>

          {dropdownOpen && (
            <div className="absolute bottom-full mb-1 left-0 z-50 min-w-[240px] rounded-lg border border-border bg-popover p-1 shadow-lg">
              <button
                onClick={() => handleSelectTap("")}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  selectedTap === ""
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className="text-muted-foreground">None</span>
              </button>
              {taps.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No taps available
                </div>
              ) : (
                taps.map((t, i) => (
                  <button
                    key={`${t.name}-${i}`}
                    onClick={() => handleSelectTap(t.name)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      t.name === selectedTap
                        ? "bg-muted text-foreground"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="flex-1 text-left truncate">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {t.message_type.split(".").pop()}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {connected && selectedTapInfo && (
          <span className="text-[10px] text-muted-foreground">
            {selectedTapInfo.message_type.split(".").pop()}
          </span>
        )}

        <div className="flex-1" />

        {connected && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {frameCount.toLocaleString()} frames · {fps} fps
          </span>
        )}

        <button
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-md size-5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* Log area */}
      <div
        ref={logRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 font-mono text-[11px] leading-[1.4] text-foreground/80"
      >
        {messages.length === 0 ? (
          <div className="text-muted-foreground">
            {selectedUri
              ? "Select a tap to start streaming..."
              : "No device selected"}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="whitespace-nowrap">
              {msg}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
