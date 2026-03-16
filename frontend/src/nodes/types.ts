export type PortDirection = "input" | "output"

export interface PortDef {
  id: string
  label: string
  direction: PortDirection
}

export type ParamType = "number" | "select" | "boolean" | "string"

export interface ParamDef {
  key: string
  label: string
  type: ParamType
  default: number | string | boolean
  options?: { label: string; value: string | number }[]
  min?: number
  max?: number
  step?: number
  unit?: string
}

export interface NodeTypeDef {
  type: string
  label: string
  category: "Sources" | "Filters" | "Detectors"
  ports: PortDef[]
  params: ParamDef[]
  color: string
}

export const NODE_TYPE_DEFS: Record<string, NodeTypeDef> = {
  broadband_source: {
    type: "broadband_source",
    label: "Broadband Source",
    category: "Sources",
    color: "#3b82f6",
    ports: [{ id: "out", label: "Out", direction: "output" }],
    params: [
      {
        key: "sample_rate_hz",
        label: "Sample Rate",
        type: "number",
        default: 30000,
        min: 1000,
        max: 100000,
        step: 1000,
        unit: "Hz",
      },
{
        key: "bit_depth",
        label: "Bit Depth",
        type: "select",
        default: 12,
        options: [
          { label: "12-bit", value: 12 },
          { label: "16-bit", value: 16 },
          { label: "24-bit", value: 24 },
        ],
      },
    ],
  },
  spectral_filter: {
    type: "spectral_filter",
    label: "Spectral Filter",
    category: "Filters",
    color: "#a855f7",
    ports: [
      { id: "in", label: "In", direction: "input" },
      { id: "out", label: "Out", direction: "output" },
    ],
    params: [
      {
        key: "filter_type",
        label: "Filter Type",
        type: "select",
        default: "butterworth",
        options: [
          { label: "Butterworth", value: "butterworth" },
          { label: "Chebyshev", value: "chebyshev" },
          { label: "Bessel", value: "bessel" },
        ],
      },
      {
        key: "low_cutoff_hz",
        label: "Low Cutoff",
        type: "number",
        default: 300,
        min: 0,
        max: 50000,
        step: 10,
        unit: "Hz",
      },
      {
        key: "high_cutoff_hz",
        label: "High Cutoff",
        type: "number",
        default: 3000,
        min: 0,
        max: 50000,
        step: 10,
        unit: "Hz",
      },
      {
        key: "order",
        label: "Order",
        type: "number",
        default: 4,
        min: 1,
        max: 10,
        step: 1,
      },
    ],
  },
  spike_detector: {
    type: "spike_detector",
    label: "Spike Detector",
    category: "Detectors",
    color: "#f97316",
    ports: [
      { id: "in", label: "In", direction: "input" },
      { id: "out", label: "Out", direction: "output" },
    ],
    params: [
      {
        key: "threshold_sigma",
        label: "Threshold",
        type: "number",
        default: 4,
        min: 1,
        max: 20,
        step: 0.5,
        unit: "σ",
      },
      {
        key: "dead_time_ms",
        label: "Dead Time",
        type: "number",
        default: 1,
        min: 0,
        max: 10,
        step: 0.1,
        unit: "ms",
      },
    ],
  },
}

export const NODE_TYPE_LIST = Object.values(NODE_TYPE_DEFS)

export interface NodeData extends Record<string, unknown> {
  type: string
  label: string
  params: Record<string, number | string | boolean>
}

export function createDefaultParams(
  def: NodeTypeDef,
): Record<string, number | string | boolean> {
  const params: Record<string, number | string | boolean> = {}
  for (const p of def.params) {
    params[p.key] = p.default
  }
  return params
}
