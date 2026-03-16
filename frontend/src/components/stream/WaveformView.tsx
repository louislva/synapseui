import { useEffect, useRef } from "react"
import type { ChannelRingBuffer } from "../../lib/ringBuffer"
import { StreamEmptyState } from "./StreamEmptyState"

const CHANNEL_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#a855f7", "#06b6d4", "#f97316", "#ec4899",
]

interface WaveformViewProps {
  buffer: ChannelRingBuffer | null
  onSelectTap: (tapName: string) => void
  selectedTap: string
}

export function WaveformView({ buffer, onSelectTap, selectedTap }: WaveformViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 0, h: 0 })

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const dpr = window.devicePixelRatio || 1
      canvas.width = (width * dpr) | 0
      canvas.height = (height * dpr) | 0
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      sizeRef.current = { w: canvas.width, h: canvas.height }
    })
    observer.observe(container)

    const ctx = canvas.getContext("2d")!
    let rafId = 0

    const draw = () => {
      rafId = requestAnimationFrame(draw)
      const { w, h } = sizeRef.current
      if (!w || !h || !buffer || buffer.totalWritten === 0) return

      const dpr = window.devicePixelRatio || 1
      const numCh = buffer.numChannels

      // Read theme colors
      const style = getComputedStyle(document.documentElement)
      const bg = style.getPropertyValue("--background").trim()
      const gridColor = style.getPropertyValue("--border").trim()
      const labelColor = style.getPropertyValue("--muted-foreground").trim()

      ctx.save()
      ctx.scale(dpr, dpr)
      const cw = w / dpr, ch = h / dpr
      const bandHCss = ch / numCh

      // Clear
      ctx.fillStyle = bg || "#0a0a0a"
      ctx.fillRect(0, 0, cw, ch)

      // Draw each channel
      for (let c = 0; c < numCh; c++) {
        const data = buffer.getChannel(c, (cw - 30) | 0)
        if (data.length === 0) continue

        const yCenter = bandHCss * (c + 0.5)
        const halfBand = bandHCss * 0.45

        // Find min/max for auto-scale
        let min = data[0], max = data[0]
        for (let i = 1; i < data.length; i++) {
          if (data[i] < min) min = data[i]
          if (data[i] > max) max = data[i]
        }
        const range = max - min || 1

        // Separator line
        if (c > 0) {
          ctx.strokeStyle = gridColor || "#222"
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(0, bandHCss * c)
          ctx.lineTo(cw, bandHCss * c)
          ctx.stroke()
        }

        // Channel label
        ctx.fillStyle = labelColor || "#666"
        ctx.font = "9px monospace"
        ctx.textBaseline = "middle"
        ctx.fillText(`${c}`, 4, yCenter)

        // Waveform
        const xOffset = 30
        const drawW = cw - xOffset
        ctx.strokeStyle = CHANNEL_COLORS[c % CHANNEL_COLORS.length]
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let i = 0; i < data.length; i++) {
          const x = xOffset + (i / data.length) * drawW
          const y = yCenter - ((data[i] - min) / range - 0.5) * 2 * halfBand
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      ctx.restore()
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [buffer])

  return (
    <div ref={containerRef} className="flex-1 relative min-h-0">
      {!buffer ? (
        <StreamEmptyState onSelectTap={onSelectTap} selectedTap={selectedTap} />
      ) : (
        <canvas ref={canvasRef} className="block" />
      )}
    </div>
  )
}
