import { Suspense } from "react";
import { connection } from "next/server";
import EntryLink from "@/components/EntryLink";
import { randomEntries } from "@/lib/data";

async function RandomEntries() {
  // Defer to request time so every page load shows a fresh random sample.
  await connection();
  const entries = randomEntries(10);
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

export default function Home() {
  return (
    <>
      <h1>Explore your infrastructure</h1>
      <p className="muted">
        A random sample of entries from your infrastructure. Click any entry to
        see what it is and how it is connected to everything else.
      </p>
      <Suspense fallback={<p className="muted">Loading entries…</p>}>
        <RandomEntries />
      </Suspense>
    </>
  );
}
