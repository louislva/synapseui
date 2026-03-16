import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, ArrowRight, Cpu, FileSliders, X } from "lucide-react"
import { Button } from "./ui/button"

const STORAGE_KEY = "synapseui-onboarding-done"

interface OnboardingOverlayProps {
  onOpenConfigs: () => void
  onOpenDevices: () => void
  onDismiss: () => void
}

const steps = [
  {
    title: "Welcome to SynapseUI",
    body: "SynapseUI is a visual editor for building and deploying signal chain configurations to Synapse devices. Design processing pipelines by connecting nodes on a canvas, then deploy them to hardware or simulators.",
    highlight: null as string | null,
  },
  {
    title: "Create a Config",
    body: "Start by creating a signal chain config. Open the Configs sidebar and click the + button to create your first config. Then right-click the canvas or use the + button to add nodes.",
    highlight: "configs",
  },
  {
    title: "Connect a Device",
    body: "Open the Devices panel to discover hardware on your network or launch a simulator. Once a device appears, select it from the toolbar dropdown, then deploy your config.",
    highlight: "devices",
  },
]

export function OnboardingOverlay({
  onOpenConfigs,
  onOpenDevices,
  onDismiss,
}: OnboardingOverlayProps) {
  const [step, setStep] = useState(0)
  const current = steps[step]

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1")
    onDismiss()
  }, [onDismiss])

  // Open relevant sidebar on step change
  useEffect(() => {
    if (current.highlight === "configs") onOpenConfigs()
    if (current.highlight === "devices") onOpenDevices()
  }, [step, current.highlight, onOpenConfigs, onOpenDevices])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={finish} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-popover p-6 shadow-2xl mx-4">
        {/* Close */}
        <button
          onClick={finish}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step
                  ? "w-6 bg-primary"
                  : i < step
                    ? "w-3 bg-primary/40"
                    : "w-3 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Highlight icon */}
        {current.highlight === "configs" && (
          <div className="flex items-center gap-2 mb-3 text-muted-foreground">
            <div className="flex items-center gap-1 rounded-md border border-ring bg-muted px-2 py-1 text-xs font-medium text-foreground">
              <FileSliders className="size-3" />
              Configs
            </div>
            <ArrowLeft className="size-3.5 animate-pulse" />
            <span className="text-xs">in the toolbar</span>
          </div>
        )}
        {current.highlight === "devices" && (
          <div className="flex items-center gap-2 mb-3 text-muted-foreground">
            <span className="text-xs">in the toolbar</span>
            <ArrowRight className="size-3.5 animate-pulse" />
            <div className="flex items-center gap-1 rounded-md border border-ring bg-muted px-2 py-1 text-xs font-medium text-foreground">
              <Cpu className="size-3" />
              Devices
            </div>
          </div>
        )}

        {/* Content */}
        <h2 className="text-lg font-semibold mb-2">{current.title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {current.body}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={finish}
            className="text-muted-foreground"
          >
            Skip
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button size="sm" onClick={finish}>
                Get Started
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function useOnboarding() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setShow(true)
    }
  }, [])

  return { showOnboarding: show, dismissOnboarding: () => setShow(false) }
}
