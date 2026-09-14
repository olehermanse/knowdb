// Relative ("3 minutes ago") and full ("14 Sep 2026, 17:02:11 UTC") time
// formatting for timestamps. Everything is in UTC so server and browser
// agree regardless of their time zones.

const UNITS: [number, string][] = [
  [365 * 24 * 3600, "year"],
  [30 * 24 * 3600, "month"],
  [7 * 24 * 3600, "week"],
  [24 * 3600, "day"],
  [3600, "hour"],
  [60, "minute"],
];

export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return seconds >= 0 ? "just now" : "in a moment";
  for (const [size, unit] of UNITS) {
    if (abs >= size) {
      const n = Math.round(abs / size);
      const text = `${n} ${unit}${n === 1 ? "" : "s"}`;
      return seconds >= 0 ? `${text} ago` : `in ${text}`;
    }
  }
  return seconds >= 0 ? "less than a minute ago" : "in less than a minute";
}

const FULL = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});

export function formatFull(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${FULL.format(date)} UTC`;
}
