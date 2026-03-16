import { useEffect, useRef } from "react"

interface TextLogProps {
  messages: string[]
  selectedUri: string | null
}

export function TextLog({ messages, selectedUri }: TextLogProps) {
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div
      ref={logRef}
      className="flex-1 overflow-y-auto overflow-x-hidden p-2 font-mono text-[11px] leading-[1.4] text-foreground/80"
    >
      {messages.length === 0 ? (
        <div className="text-muted-foreground">
          {selectedUri
            ? "Select a tap to start streaming..."
            : "No device selected"}
        </div>
      ) : (
        messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.startsWith("---")
                ? "text-center text-muted-foreground/50 text-[10px] py-1"
                : "whitespace-nowrap"
            }
          >
            {msg}
          </div>
        ))
      )}
    </div>
  )
}
