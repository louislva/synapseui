import { useDeviceStore } from "../../store/useDeviceStore"

interface StreamEmptyStateProps {
  onSelectTap: (tapName: string) => void
  selectedTap: string
}

export function StreamEmptyState({ onSelectTap, selectedTap }: StreamEmptyStateProps) {
  const taps = useDeviceStore((s) => s.taps)
  const unselected = !selectedTap

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <span className="text-xs text-muted-foreground">Waiting for data...</span>
      {unselected && taps.length > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            Select a tap to start streaming
          </span>
          <div className="flex flex-wrap justify-center gap-1.5">
            {taps.map((t, i) => (
              <button
                key={`${t.name}-${i}`}
                onClick={() => onSelectTap(t.name)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border border-border bg-background hover:bg-muted/50 hover:border-foreground/20 transition-colors cursor-pointer"
              >
                <span className="size-1.5 rounded-full bg-blue-500" />
                {t.name}
                <span className="text-[10px] text-muted-foreground">
                  {t.message_type.split(".").pop()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
