"use client";

import Link from "next/link";
import { useRef, useState } from "react";

// A row in the modal: a badge, a main link and optionally a second link
// (e.g. a software's version).
export interface ModalRow {
  key: string;
  type: string;
  label: string;
  href: string;
  extra?: { label: string; href: string };
}

// A count plus a "Show all" button opening a modal that lists every row
// vertically, filtered live as the user types.
export default function ListModal({
  title,
  singular,
  plural,
  rows,
  testId,
}: {
  title: string;
  singular: string;
  plural: string;
  rows: ModalRow[];
  testId: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const shown = q
    ? rows.filter(
        (r) => r.label.toLowerCase().includes(q) || r.extra?.label.toLowerCase().includes(q),
      )
    : rows;
  const count = `${rows.length} ${rows.length === 1 ? singular : plural}`;

  const open = () => {
    setQuery("");
    dialog.current?.showModal();
    input.current?.focus();
  };
  const close = () => dialog.current?.close();

  return (
    <span className="list-modal-trigger" data-testid={testId}>
      <span data-testid={`${testId}-count`}>{count}</span>{" "}
      <button type="button" className="list-modal-button" onClick={open} data-testid={`${testId}-open`}>
        Show all
      </button>
      <dialog
        ref={dialog}
        className="list-modal"
        aria-label={title}
        data-testid={`${testId}-dialog`}
        onClick={(e) => {
          // Clicking the backdrop (outside the panel) closes the dialog.
          if (e.target === dialog.current) close();
        }}
      >
        <div className="list-modal-panel">
          <div className="list-modal-header">
            <h2>{title}</h2>
            <button type="button" onClick={close} aria-label="Close" className="list-modal-close">
              ×
            </button>
          </div>
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${plural}…`}
            aria-label={`Filter ${plural}`}
            data-testid={`${testId}-filter`}
          />
          <p className="muted" data-testid={`${testId}-shown`}>
            {shown.length === rows.length
              ? count
              : `${shown.length} of ${rows.length} ${plural} match`}
          </p>
          <ul className="entry-list list-modal-list" data-testid={`${testId}-list`}>
            {shown.map((row) => (
              <li key={row.key}>
                <span className="type-badge">{row.type}</span>
                <span>
                  <Link className="entry-link" href={row.href}>
                    {row.label}
                  </Link>
                  {row.extra && (
                    <>
                      {" "}
                      <Link className="entry-link" href={row.extra.href}>
                        {row.extra.label}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            ))}
            {shown.length === 0 && <li className="muted">Nothing matches.</li>}
          </ul>
        </div>
      </dialog>
    </span>
  );
}
