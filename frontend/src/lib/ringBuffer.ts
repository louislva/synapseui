export class ChannelRingBuffer {
  readonly capacity: number
  numChannels: number
  channels: Float32Array[]
  writePos: number
  totalWritten: number
  sampleRate: number

  constructor(numChannels: number, capacity = 30_000) {
    this.capacity = capacity
    this.numChannels = numChannels
    this.channels = Array.from({ length: numChannels }, () => new Float32Array(capacity))
    this.writePos = 0
    this.totalWritten = 0
    this.sampleRate = 0
  }

  /** De-interleave and append samples. Resets if channel count changes. */
  push(interleavedData: number[], numChannels: number): void {
    if (numChannels !== this.numChannels) {
      this.numChannels = numChannels
      this.channels = Array.from({ length: numChannels }, () => new Float32Array(this.capacity))
      this.writePos = 0
      this.totalWritten = 0
    }

    const samplesPerChannel = (interleavedData.length / numChannels) | 0
    for (let s = 0; s < samplesPerChannel; s++) {
      const base = s * numChannels
      const pos = (this.writePos + s) % this.capacity
      for (let ch = 0; ch < numChannels; ch++) {
        this.channels[ch][pos] = interleavedData[base + ch]
      }
    }
    this.writePos = (this.writePos + samplesPerChannel) % this.capacity
    this.totalWritten += samplesPerChannel
  }

  /** Returns the last `count` samples for a channel, oldest first. */
  getChannel(ch: number, count: number): Float32Array {
    if (ch >= this.numChannels) return new Float32Array(0)
    const available = Math.min(count, this.totalWritten, this.capacity)
    const result = new Float32Array(available)
    const buf = this.channels[ch]
    let readPos = (this.writePos - available + this.capacity) % this.capacity
    for (let i = 0; i < available; i++) {
      result[i] = buf[readPos]
      readPos = (readPos + 1) % this.capacity
    }
    return result
  }
}
