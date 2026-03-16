import { useState, useEffect, type RefObject } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { Button } from "./ui/button"

const STORAGE_KEY = "synapseui-onboarding-done"

const steps = [
  {
    title: "Welcome to SynapseUI",
    body: "Design signal chain configs by connecting nodes on the canvas, then deploy them to hardware or simulators.",
    target: "center" as const,
  },
  {
    title: "Create a Config",
    body: "Click + to create your first config. Then right-click the canvas to add nodes.",
    target: "configs-plus" as const,
  },
  {
    title: "Connect a Device",
    body: "Open the Devices panel to discover hardware on your network or launch a simulator. Then select it from the toolbar dropdown and deploy.",
    target: "devices" as const,
  },
]

export type OnboardingTarget = "center" | "configs" | "configs-plus" | "devices"

/* ── Shared step controls ── */

function StepControls({
  step,
  totalSteps,
  onNext: _onNext,
  onBack: _onBack,
  onDismiss: _onDismiss,
}: {
  step: number
  totalSteps: number
  onNext: () => void
  onBack: () => void
  onDismiss: () => void
}) {
  return (
    <>
      {/* Step indicator */}
      <div className="flex items-center gap-1.5 mb-3">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all ${
              i === step
                ? "w-5 bg-primary"
                : i < step
                  ? "w-2.5 bg-primary/40"
                  : "w-2.5 bg-muted"
            }`}
          />
        ))}
      </div>
    </>
  )
}

function StepActions({
  step,
  totalSteps,
  onNext,
  onBack,
  onDismiss,
}: {
  step: number
  totalSteps: number
  onNext: () => void
  onBack: () => void
  onDismiss: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <Button
        variant="ghost"
        size="xs"
        onClick={onDismiss}
        className="text-muted-foreground"
      >
        Skip
      </Button>
      <div className="flex gap-1.5">
        {step > 0 && (
          <Button variant="outline" size="xs" onClick={onBack}>
            Back
          </Button>
        )}
        {step < totalSteps - 1 ? (
          <Button size="xs" onClick={onNext}>
            Next
          </Button>
        ) : (
          <Button size="xs" onClick={onDismiss}>
            Get Started
          </Button>
        )}
      </div>
    </div>
  )
}

/* ── Center modal (step 0) ── */

export function OnboardingModal() {
  const { step, setStep, dismiss, show } = useOnboardingState()

  if (!show) return null
  const current = steps[step]
  if (current.target !== "center") return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={dismiss} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-popover p-5 shadow-2xl mx-4 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>

        <StepControls
          step={step}
          totalSteps={steps.length}
          onNext={() => setStep(step + 1)}
          onBack={() => setStep(step - 1)}
          onDismiss={dismiss}
        />

        <h2 className="text-lg font-semibold mb-2 pr-4">{current.title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          {current.body}
        </p>

        <StepActions
          step={step}
          totalSteps={steps.length}
          onNext={() => setStep(step + 1)}
          onBack={() => setStep(step - 1)}
          onDismiss={dismiss}
        />
      </div>
    </div>
  )
}

/* ── Popover (steps 1+) ── */

interface OnboardingStepProps {
  target: OnboardingTarget
  onOpenSidebar: () => void
}

export function OnboardingStep({ target, onOpenSidebar }: OnboardingStepProps) {
  const { step, setStep, dismiss, show } = useOnboardingState()

  useEffect(() => {
    if (show && steps[step].target === target) {
      onOpenSidebar()
    }
  }, [show, step, target, onOpenSidebar])

  if (!show) return null

  const current = steps[step]
  if (current.target !== target) return null

  const side = target === "devices" ? "right" : "left"

  return (
    <div
      className={`absolute top-full mt-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-300 ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      <div className="relative rounded-lg border border-border bg-popover px-4 py-3 shadow-lg w-72">
        {/* Arrow */}
        <div
          className={`absolute -top-[6px] size-3 rotate-45 border-l border-t border-border bg-popover ${
            side === "left" ? "left-4" : "right-4"
          }`}
        />

        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-3.5" />
        </button>

        <StepControls
          step={step}
          totalSteps={steps.length}
          onNext={() => setStep(step + 1)}
          onBack={() => setStep(step - 1)}
          onDismiss={dismiss}
        />

        <h3 className="text-sm font-semibold mb-1 pr-4">{current.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          {current.body}
        </p>

        <StepActions
          step={step}
          totalSteps={steps.length}
          onNext={() => setStep(step + 1)}
          onBack={() => setStep(step - 1)}
          onDismiss={dismiss}
        />
      </div>
    </div>
  )
}

/* ── Portal-based popover (for elements inside overflow containers) ── */

interface OnboardingPortalStepProps {
  target: OnboardingTarget
  anchorRef: RefObject<HTMLElement | null>
}

export function OnboardingPortalStep({ target, anchorRef }: OnboardingPortalStepProps) {
  const { step, setStep, dismiss, show } = useOnboardingState()
  const [pos, setPos] = useState<{ top: number; anchorCenter: number } | null>(null)

  useEffect(() => {
    if (!show || steps[step].target !== target || !anchorRef.current) {
      setPos(null)
      return
    }
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) {
        setPos({ top: rect.bottom + 8, anchorCenter: rect.left + rect.width / 2 })
      }
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [show, step, target, anchorRef])

  if (!show || !pos) return null
  const current = steps[step]
  if (current.target !== target) return null

  const stepProps = {
    step,
    totalSteps: steps.length,
    onNext: () => setStep(step + 1),
    onBack: () => setStep(step - 1),
    onDismiss: dismiss,
  }

  // Position popover so the arrow (at left: 22px center) aligns with the anchor center
  const arrowOffset = 22 // arrow left-4 (16px) + half arrow size (6px)
  const popoverLeft = pos.anchorCenter - arrowOffset

  return createPortal(
    <div
      className="fixed z-[100] animate-in fade-in slide-in-from-top-2 duration-300"
      style={{ top: pos.top, left: popoverLeft }}
    >
      <div className="relative rounded-lg border border-border bg-popover px-4 py-3 shadow-lg w-72">
        <div className="absolute -top-[6px] left-4 size-3 rotate-45 border-l border-t border-border bg-popover" />

        <button
          onClick={dismiss}
          className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-3.5" />
        </button>

        <StepControls {...stepProps} />
        <h3 className="text-sm font-semibold mb-1 pr-4">{current.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{current.body}</p>
        <StepActions {...stepProps} />
      </div>
    </div>,
    document.body
  )
}

/* ── Shared state ── */

let _step = 0
let _show = false
let _initialized = false
const _listeners = new Set<() => void>()

function notify() {
  _listeners.forEach((fn) => fn())
}

function useOnboardingState() {
  const [, rerender] = useState(0)

  useEffect(() => {
    const fn = () => rerender((n) => n + 1)
    _listeners.add(fn)
    return () => { _listeners.delete(fn) }
  }, [])

  return {
    step: _step,
    show: _show,
    setStep: (s: number) => { _step = s; notify() },
    dismiss: () => {
      localStorage.setItem(STORAGE_KEY, "1")
      _show = false
      notify()
    },
  }
}

export function useOnboarding() {
  const [, rerender] = useState(0)

  useEffect(() => {
    if (!_initialized) {
      _initialized = true
      if (!localStorage.getItem(STORAGE_KEY)) {
        _show = true
        _step = 0
      }
    }
    const fn = () => rerender((n) => n + 1)
    _listeners.add(fn)
    notify()
    return () => { _listeners.delete(fn) }
  }, [])

  return { showOnboarding: _show }
}
