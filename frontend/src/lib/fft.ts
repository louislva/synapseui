/** In-place radix-2 Cooley-Tukey FFT. Arrays must be power-of-2 length. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    while (j & bit) {
      j ^= bit
      bit >>= 1
    }
    j ^= bit
    if (i < j) {
      let tmp = re[i]; re[i] = re[j]; re[j] = tmp
      tmp = im[i]; im[i] = im[j]; im[j] = tmp
    }
  }
  // Butterfly stages
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const angle = -2 * Math.PI / size
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)
    for (let i = 0; i < n; i += size) {
      let curRe = 1, curIm = 0
      for (let j = 0; j < half; j++) {
        const a = i + j
        const b = a + half
        const tRe = curRe * re[b] - curIm * im[b]
        const tIm = curRe * im[b] + curIm * re[b]
        re[b] = re[a] - tRe
        im[b] = im[a] - tIm
        re[a] += tRe
        im[a] += tIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}

/** Hanning window coefficients (cached per size). */
const windowCache = new Map<number, Float64Array>()
export function hanningWindow(n: number): Float64Array {
  let w = windowCache.get(n)
  if (!w) {
    w = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
    }
    windowCache.set(n, w)
  }
  return w
}

/** Compute power spectral density (positive frequencies only). */
export function computePSD(
  samples: Float32Array,
  fftSize: number,
  sampleRate: number,
): { freqs: Float64Array; magnitudeDb: Float64Array } {
  const window = hanningWindow(fftSize)
  const re = new Float64Array(fftSize)
  const im = new Float64Array(fftSize)

  // Apply window (zero-pad if samples shorter than fftSize)
  const len = Math.min(samples.length, fftSize)
  for (let i = 0; i < len; i++) {
    re[i] = samples[i] * window[i]
  }

  fft(re, im)

  const numBins = (fftSize >> 1) + 1
  const freqs = new Float64Array(numBins)
  const magnitudeDb = new Float64Array(numBins)
  const binWidth = sampleRate / fftSize

  for (let i = 0; i < numBins; i++) {
    freqs[i] = i * binWidth
    const power = re[i] * re[i] + im[i] * im[i]
    magnitudeDb[i] = 10 * Math.log10(Math.max(power, 1e-20))
  }

  return { freqs, magnitudeDb }
}
