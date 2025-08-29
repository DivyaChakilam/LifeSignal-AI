// src/lib/checkinUtils.ts
export function computeSafetyStatus(
  lastCheckIn: Date | null,
  intervalMinutes: number
): "safe" | "missed" | "unknown" {
  if (!lastCheckIn) return "unknown";

  const nextDue = new Date(lastCheckIn.getTime() + intervalMinutes * 60 * 1000);
  return new Date() > nextDue ? "missed" : "safe";
}
