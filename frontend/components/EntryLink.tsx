import Link from "next/link";
import { EntryRef, entryHref } from "@/lib/data";

export default function EntryLink({
  type,
  name,
  label,
}: EntryRef & { label?: string }) {
  return (
    <Link className="entry-link" href={entryHref({ type, name })}>
      {label ?? name}
    </Link>
  );
}
