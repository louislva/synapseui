import { useEffect, useRef } from "react"
import type { ChannelRingBuffer } from "../../lib/ringBuffer"
import { StreamEmptyState } from "./StreamEmptyState"

// Viridis-like colormap LUT (256 entries, RGB 0-255)
const COLORMAP = buildColormap()
function buildColormap(): Uint8Array {
  const lut = new Uint8Array(256 * 3)
  // Key stops: dark purple → teal → yellow
  const stops: [number, number, number, number][] = [
    [0, 0.267, 0.004, 0.329],
    [0.25, 0.282, 0.141, 0.458],
    [0.5, 0.127, 0.566, 0.551],
    [0.75, 0.544, 0.774, 0.247],
    [1, 0.993, 0.906, 0.144],
  ]
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let s0 = stops[0], s1 = stops[1]
    for (let j = 1; j < stops.length; j++) {
      if (t <= stops[j][0]) { s0 = stops[j - 1]; s1 = stops[j]; break }
    }
    const f = (t - s0[0]) / (s1[0] - s0[0])
    lut[i * 3] = ((s0[1] + (s1[1] - s0[1]) * f) * 255) | 0
    lut[i * 3 + 1] = ((s0[2] + (s1[2] - s0[2]) * f) * 255) | 0
    lut[i * 3 + 2] = ((s0[3] + (s1[3] - s0[3]) * f) * 255) | 0
  }
  return lut
}

interface HeatmapViewProps {
  buffer: ChannelRingBuffer | null
  onSelectTap: (tapName: string) => void
  selectedTap: string
}

export function HeatmapView({ buffer, onSelectTap, selectedTap }: HeatmapViewProps) {
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

      const numCh = buffer.numChannels
      const cols = w
      const rows = h
      const rowHeight = rows / numCh

      // Get data for all channels
      const samples: Float32Array[] = []
      let gMin = Infinity, gMax = -Infinity
      for (let ch = 0; ch < numCh; ch++) {
        const data = buffer.getChannel(ch, cols)
        samples.push(data)
        for (let i = 0; i < data.length; i++) {
          if (data[i] < gMin) gMin = data[i]
          if (data[i] > gMax) gMax = data[i]
        }
      }

      const range = gMax - gMin || 1
      const imgData = ctx.createImageData(w, h)
      const pixels = imgData.data

      for (let ch = 0; ch < numCh; ch++) {
        const data = samples[ch]
        const yStart = (ch * rowHeight) | 0
        const yEnd = ((ch + 1) * rowHeight) | 0
        const offset = cols - data.length // right-align data

        for (let x = 0; x < data.length; x++) {
          const norm = ((data[x] - gMin) / range * 255) | 0
          const ci = Math.max(0, Math.min(255, norm)) * 3
          const r = COLORMAP[ci], g = COLORMAP[ci + 1], b = COLORMAP[ci + 2]
          const px = x + offset

          for (let y = yStart; y < yEnd; y++) {
            const idx = (y * w + px) * 4
            pixels[idx] = r
            pixels[idx + 1] = g
            pixels[idx + 2] = b
            pixels[idx + 3] = 255
          }
        }
      }

      ctx.putImageData(imgData, 0, 0)
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
