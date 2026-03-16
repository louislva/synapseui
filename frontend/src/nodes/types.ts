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
  category: "Sources" | "Filters" | "Stimulation"
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
        default: 1000,
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
        key: "method",
        label: "Method",
        type: "select",
        default: "kBandPass",
        options: [
          { label: "Low Pass", value: "kLowPass" },
          { label: "High Pass", value: "kHighPass" },
          { label: "Band Pass", value: "kBandPass" },
          { label: "Band Stop", value: "kBandStop" },
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
  // spike_source: {
  //   type: "spike_source",
  //   label: "Spike Source",
  //   category: "Sources",
  //   color: "#f97316",
  //   ports: [{ id: "out", label: "Out", direction: "output" }],
  //   params: [
  //     {
  //       key: "sample_rate_hz",
  //       label: "Sample Rate",
  //       type: "number",
  //       default: 30000,
  //       min: 1000,
  //       max: 100000,
  //       step: 1000,
  //       unit: "Hz",
  //     },
  //     {
  //       key: "spike_window_ms",
  //       label: "Spike Window",
  //       type: "number",
  //       default: 20,
  //       min: 1,
  //       max: 100,
  //       step: 1,
  //       unit: "ms",
  //     },
  //     {
  //       key: "threshold_uV",
  //       label: "Threshold",
  //       type: "number",
  //       default: 50,
  //       min: 1,
  //       max: 500,
  //       step: 1,
  //       unit: "μV",
  //     },
  //   ],
  // },
  // optical_stimulation: {
  //   type: "optical_stimulation",
  //   label: "Optical Stimulation",
  //   category: "Stimulation",
  //   color: "#22c55e",
  //   ports: [{ id: "in", label: "In", direction: "input" }],
  //   params: [
  //     {
  //       key: "bit_width",
  //       label: "Bit Width",
  //       type: "select",
  //       default: 8,
  //       options: [
  //         { label: "8-bit", value: 8 },
  //         { label: "10-bit", value: 10 },
  //         { label: "12-bit", value: 12 },
  //       ],
  //     },
  //     {
  //       key: "frame_rate",
  //       label: "Frame Rate",
  //       type: "number",
  //       default: 30,
  //       min: 1,
  //       max: 120,
  //       step: 1,
  //       unit: "Hz",
  //     },
  //     {
  //       key: "gain",
  //       label: "Gain",
  //       type: "number",
  //       default: 1.0,
  //       min: 0.1,
  //       max: 10.0,
  //       step: 0.1,
  //     },
  //   ],
  // },
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
