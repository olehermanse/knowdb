import { Suspense } from "react";
import { connection } from "next/server";
import EntryLink from "@/components/EntryLink";
import Link from "next/link";
import { countOfType, ENTRY_TYPES, randomEntries, TYPE_LABELS } from "@/lib/data";

async function RandomEntries() {
  // Defer to request time so every page load shows a fresh random sample.
  await connection();
  // Enough entries to show at least one of every entry type.
  const entries = randomEntries(12);
  return (
    <ul className="entry-list" data-testid="entry-list">
      {entries.map((entry) => (
        <li key={`${entry.type}:${entry.name}`}>
          <span className="type-badge">{entry.type}</span>
          <EntryLink type={entry.type} name={entry.name} />
        </li>
      ))}
    </ul>
  );
}

// One button per entry type, linking to a listing of everything of that type.
function TypeButtons() {
  return (
    <nav className="type-buttons" aria-label="Browse by type" data-testid="type-buttons">
      {ENTRY_TYPES.map((type) => (
        <Link
          key={type}
          href={`/search?type=${type}`}
          className="type-button"
          data-testid={`type-button-${type}`}
        >
          {TYPE_LABELS[type]} <span className="muted">({countOfType(type)})</span>
        </Link>
      ))}
    </nav>
  );
}

export default function Home() {
  return (
    <>
      <h1>Explore your infrastructure</h1>
      <p className="muted">Browse everything of one type:</p>
      <TypeButtons />
      <p className="muted">Or pick one of the randomly selected entries below:</p>
      <Suspense fallback={<p className="muted">Loading entries…</p>}>
        <RandomEntries />
      </Suspense>
    </>
  );
}
