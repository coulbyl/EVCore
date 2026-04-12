export function workerStatusLabel(status: string) {
  if (status === "healthy") return "sain";
  if (status === "watch") return "surveillance";
  if (status === "late") return "retard";
  return status;
}
