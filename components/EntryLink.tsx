import Link from "next/link";
import { EntryRef, entryHref, entryLabel } from "@/lib/data";

// A link to an entry, showing its name; files show their abbreviated
// checksum with the full one as a tooltip.
export default function EntryLink({
  type,
  name,
  label,
}: EntryRef & { label?: string }) {
  const text = label ?? entryLabel({ type, name });
  return (
    <Link className="entry-link" href={entryHref({ type, name })} title={text === name ? undefined : name}>
      {text}
    </Link>
  );
}
