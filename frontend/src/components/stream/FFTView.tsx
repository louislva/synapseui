import { useState, useEffect, useRef } from "react"
import type { ChannelRingBuffer } from "../../lib/ringBuffer"
import { computePSD } from "../../lib/fft"
import { ChevronUp, ChevronDown } from "lucide-react"

const FFT_SIZE = 1024

interface FFTViewProps {
  buffer: ChannelRingBuffer | null
}

export function FFTView({ buffer }: FFTViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const [channel, setChannel] = useState(0)
  const channelRef = useRef(0)

  useEffect(() => { channelRef.current = channel }, [channel])

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

    const MARGIN = { top: 20, right: 16, bottom: 32, left: 48 }

    // Smoothed Y-axis range (EMA over ~10s at 60fps → alpha ≈ 1/600)
    const SMOOTH_ALPHA = 1 / 600
    let smoothDbMin = NaN
    let smoothDbMax = NaN

    const draw = () => {
      rafId = requestAnimationFrame(draw)
      const { w, h } = sizeRef.current
      if (!w || !h || !buffer || buffer.totalWritten === 0) return

      const dpr = window.devicePixelRatio || 1
      const ch = channelRef.current
      const samples = buffer.getChannel(ch, FFT_SIZE)
      if (samples.length < 64) return

      const { freqs, magnitudeDb } = computePSD(samples, FFT_SIZE, buffer.sampleRate)

      // Read theme colors
      const style = getComputedStyle(document.documentElement)
      const bg = style.getPropertyValue("--background").trim()
      const fg = style.getPropertyValue("--foreground").trim()
      const gridColor = style.getPropertyValue("--border").trim()
      const mutedFg = style.getPropertyValue("--muted-foreground").trim()

      ctx.save()
      ctx.scale(dpr, dpr)
      const cw = w / dpr, cHeight = h / dpr

      ctx.fillStyle = bg || "#0a0a0a"
      ctx.fillRect(0, 0, cw, cHeight)

      const plotLeft = MARGIN.left
      const plotTop = MARGIN.top
      const plotW = cw - MARGIN.left - MARGIN.right
      const plotH = cHeight - MARGIN.top - MARGIN.bottom

      // Find instantaneous dB range
      let rawMin = Infinity, rawMax = -Infinity
      for (let i = 1; i < magnitudeDb.length; i++) {
        if (magnitudeDb[i] < rawMin) rawMin = magnitudeDb[i]
        if (magnitudeDb[i] > rawMax) rawMax = magnitudeDb[i]
      }
      rawMin = Math.floor(rawMin / 10) * 10
      rawMax = Math.ceil(rawMax / 10) * 10
      if (rawMax - rawMin < 20) rawMin = rawMax - 60

      // EMA smoothing (seed on first frame)
      if (isNaN(smoothDbMin)) {
        smoothDbMin = rawMin
        smoothDbMax = rawMax
      } else {
        smoothDbMin += SMOOTH_ALPHA * (rawMin - smoothDbMin)
        smoothDbMax += SMOOTH_ALPHA * (rawMax - smoothDbMax)
        // Allow fast expansion if signal suddenly exceeds range
        if (rawMin < smoothDbMin) smoothDbMin = smoothDbMin + 0.3 * (rawMin - smoothDbMin)
        if (rawMax > smoothDbMax) smoothDbMax = smoothDbMax + 0.3 * (rawMax - smoothDbMax)
      }

      const dbMin = Math.floor(smoothDbMin / 10) * 10
      const dbMax = Math.ceil(smoothDbMax / 10) * 10
      const dbRange = dbMax - dbMin || 1

      const maxFreq = freqs[freqs.length - 1]

      // Grid lines
      ctx.strokeStyle = gridColor || "#222"
      ctx.lineWidth = 0.5
      ctx.fillStyle = mutedFg || "#666"
      ctx.font = "9px monospace"
      ctx.textBaseline = "middle"
      ctx.textAlign = "right"

      // Y-axis grid (dB)
      for (let db = dbMin; db <= dbMax; db += 10) {
        const y = plotTop + (1 - (db - dbMin) / dbRange) * plotH
        ctx.beginPath()
        ctx.moveTo(plotLeft, y)
        ctx.lineTo(plotLeft + plotW, y)
        ctx.stroke()
        ctx.fillText(`${db}`, plotLeft - 4, y)
      }

      // X-axis grid (frequency)
      ctx.textBaseline = "top"
      ctx.textAlign = "center"
      const freqStep = niceStep(maxFreq, 6)
      for (let f = 0; f <= maxFreq; f += freqStep) {
        const x = plotLeft + (f / maxFreq) * plotW
        ctx.beginPath()
        ctx.moveTo(x, plotTop)
        ctx.lineTo(x, plotTop + plotH)
        ctx.stroke()
        ctx.fillText(formatFreq(f), x, plotTop + plotH + 4)
      }

      // Axis labels
      ctx.fillStyle = fg || "#ccc"
      ctx.font = "10px monospace"
      ctx.textAlign = "center"
      ctx.fillText("Frequency", plotLeft + plotW / 2, cHeight - 4)
      ctx.save()
      ctx.translate(10, plotTop + plotH / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText("dB", 0, 0)
      ctx.restore()

      // PSD line
      ctx.beginPath()
      for (let i = 1; i < freqs.length; i++) {
        const x = plotLeft + (freqs[i] / maxFreq) * plotW
        const y = plotTop + (1 - (magnitudeDb[i] - dbMin) / dbRange) * plotH
        if (i === 1) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Fill under curve
      const lastX = plotLeft + plotW
      const bottomY = plotTop + plotH
      ctx.lineTo(lastX, bottomY)
      ctx.lineTo(plotLeft + (freqs[1] / maxFreq) * plotW, bottomY)
      ctx.closePath()
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)"
      ctx.fill()

      ctx.restore()
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [buffer])

  const maxCh = buffer ? buffer.numChannels - 1 : 0

  return (
    <div ref={containerRef} className="flex-1 relative min-h-0">
      {!buffer ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Waiting for data...
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} className="block" />
          <div className="absolute top-1 right-1 flex items-center gap-0.5 rounded border border-border bg-background/80 backdrop-blur-sm px-1.5 py-0.5">
            <span className="text-[10px] text-muted-foreground mr-0.5">Ch</span>
            <span className="text-[10px] font-medium tabular-nums w-4 text-center">{channel}</span>
            <button
              onClick={() => setChannel((c) => Math.min(c + 1, maxCh))}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronUp className="size-3" />
            </button>
            <button
              onClick={() => setChannel((c) => Math.max(c - 1, 0))}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="size-3" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function niceStep(max: number, targetTicks: number): number {
  const rough = max / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return nice * mag
}

function formatFreq(f: number): string {
  if (f >= 1000) return `${(f / 1000).toFixed(f % 1000 === 0 ? 0 : 1)}k`
  return `${f.toFixed(0)}`
}
