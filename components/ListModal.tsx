import Link from "next/link";

// A row in the modal: a badge, a main link and optionally a second link
// (e.g. a software's version), joined by a separator (a space by default,
// "=" for a variable's value), and a faded note after them (e.g. how many
// hosts share the value), optionally linking somewhere.
export interface ModalRow {
  key: string;
  type: string;
  label: string;
  href: string;
  extra?: { label: string; href: string };
  separator?: string;
  note?: { label: string; href?: string };
}

// A count plus a "Show all" button opening a popover that lists every row
// vertically. This is a server component: opening and closing use the
// native HTML popover attribute, and the live filter is a few lines of
// plain JavaScript in the layout (see components/listModalScript.ts), so
// no React runs in the browser for it.
export default function ListModal({
  title,
  singular,
  plural,
  verb,
  rows,
  testId,
}: {
  title: string;
  singular: string;
  plural: string;
  // Word after the count on the button, e.g. "installed" -> "10 installed".
  verb: string;
  rows: ModalRow[];
  testId: string;
}) {
  const id = `${testId}-popover`;
  const count = `${rows.length} ${rows.length === 1 ? singular : plural}`;
  return (
    <span className="list-modal-trigger" data-testid={testId}>
      <button
        type="button"
        className="list-modal-button"
        popoverTarget={id}
        popoverTargetAction="show"
        aria-label={`${count}, show all`}
        data-testid={`${testId}-open`}
      >
        {rows.length} {verb}
      </button>
      <div
        id={id}
        popover="auto"
        className="list-modal"
        role="dialog"
        aria-label={title}
        data-list-modal
        data-total={rows.length}
        data-plural={plural}
        data-count={count}
        data-testid={`${testId}-dialog`}
      >
        <div className="list-modal-panel">
          <div className="list-modal-header">
            <h2>{title}</h2>
            <button
              type="button"
              className="list-modal-close"
              popoverTarget={id}
              popoverTargetAction="hide"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <input
            type="search"
            placeholder={`Filter ${plural}…`}
            aria-label={`Filter ${plural}`}
            data-list-modal-filter
            data-testid={`${testId}-filter`}
          />
          <p className="muted" data-list-modal-shown data-testid={`${testId}-shown`}>
            {count}
          </p>
          <ul className="entry-list list-modal-list" data-testid={`${testId}-list`}>
            {rows.map((row) => (
              <li
                key={row.key}
                data-list-modal-row
                data-label={`${row.label} ${row.extra?.label ?? ""}`.trim().toLowerCase()}
              >
                <span className="type-badge">{row.type}</span>
                <span>
                  <Link className="entry-link" href={row.href}>
                    {row.label}
                  </Link>
                  {row.extra && (
                    <>
                      {row.separator ?? " "}
                      <Link className="entry-link" href={row.extra.href}>
                        {row.extra.label}
                      </Link>
                    </>
                  )}
                  {row.note && (
                    <span className="muted list-modal-note" data-testid="list-modal-note">
                      {" "}
                      {row.note.href ? (
                        <Link className="entry-link" href={row.note.href}>
                          {row.note.label}
                        </Link>
                      ) : (
                        row.note.label
                      )}
                    </span>
                  )}
                </span>
              </li>
            ))}
            <li className="muted" data-list-modal-empty hidden>
              Nothing matches.
            </li>
          </ul>
        </div>
      </div>
    </span>
  );
}
