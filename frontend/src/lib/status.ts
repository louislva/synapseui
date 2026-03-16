export function statusColor(status: string) {
  switch (status) {
    case "Running":
      return "bg-green-500"
    case "Stopped":
      return "bg-yellow-500"
    case "Error":
    case "Unreachable":
      return "bg-red-500"
    default:
      return "bg-muted-foreground"
  }
}
