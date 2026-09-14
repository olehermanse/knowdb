import Timestamp from "@/components/Timestamp";
import { Seen } from "@/lib/data";

// "First seen 3 years ago, last seen 34 minutes ago." in small, faded,
// italic text, shown at the top right of a page next to the type badge.
export default function SeenLine({ seen, testId }: { seen: Seen; testId: string }) {
  return (
    <p className="muted seen-line" data-testid={`${testId}-seen`}>
      First seen <Timestamp iso={seen.first} testId={`${testId}-first-seen`} />, last seen{" "}
      <Timestamp iso={seen.last} testId={`${testId}-last-seen`} />.
    </p>
  );
}
