import { formatFull, formatRelative } from "@/lib/time";

// A relative time ("3 minutes ago") with the full date and time as a
// tooltip, and the machine-readable timestamp on the element.
export default function Timestamp({ iso, testId }: { iso: string; testId?: string }) {
  return (
    <time dateTime={iso} title={formatFull(iso)} data-testid={testId}>
      {formatRelative(iso)}
    </time>
  );
}
