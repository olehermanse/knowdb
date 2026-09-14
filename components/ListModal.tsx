import Link from "next/link";

// A row in the modal: a badge, a main link and optionally a second link
// (e.g. a software's version).
export interface ModalRow {
  key: string;
  type: string;
  label: string;
  href: string;
  extra?: { label: string; href: string };
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
  rows,
  testId,
}: {
  title: string;
  singular: string;
  plural: string;
  rows: ModalRow[];
  testId: string;
}) {
  const id = `${testId}-popover`;
  const count = `${rows.length} ${rows.length === 1 ? singular : plural}`;
  return (
    <span className="list-modal-trigger" data-testid={testId}>
      <span data-testid={`${testId}-count`}>{count}</span>{" "}
      <button
        type="button"
        className="list-modal-button"
        popoverTarget={id}
        popoverTargetAction="show"
        data-testid={`${testId}-open`}
      >
        Show all
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
                      {" "}
                      <Link className="entry-link" href={row.extra.href}>
                        {row.extra.label}
                      </Link>
                    </>
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
