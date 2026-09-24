import { Entry, getPromiseTypeSyntax } from "@/lib/data";

// The bundle types allowing a built-in promise type and its attributes,
// from data/promise-types.json, laid out like a host's details.
export default function PromiseTypeDetails({ entry }: { entry: Entry }) {
  const pt = getPromiseTypeSyntax(entry.name);
  if (!pt) return null;
  const attributes = Object.entries(pt.attributes);
  const own = attributes.filter(([, a]) => a.visibility === "promiseType");
  const common = attributes.filter(([, a]) => a.visibility !== "promiseType");
  const codes = (list: [string, { type: string; status: string }][]) =>
    list.length === 0 ? (
      <span className="muted">None</span>
    ) : (
      list.map(([name, a]) => (
        <code key={name} title={`${a.type}${a.status !== "normal" ? `, ${a.status}` : ""}`}>
          {name}
        </code>
      ))
    );
  return (
    <dl className="host-details" data-testid="promise-type-details">
      <dt>Bundle types</dt>
      <dd className="inline-links" data-testid="promise-type-bundle-types">
        {pt["bundle-types"].length === 0 ? (
          <span className="muted">None</span>
        ) : (
          pt["bundle-types"].map((b) => <code key={b}>{b}</code>)
        )}
      </dd>
      <dt>Attributes</dt>
      <dd className="inline-links" data-testid="promise-type-attributes">
        {codes(own)}
      </dd>
      <dt>Common attributes</dt>
      <dd className="inline-links" data-testid="promise-type-common-attributes">
        {codes(common)}
      </dd>
      {pt.status !== "normal" && (
        <>
          <dt>Status</dt>
          <dd data-testid="promise-type-status">{pt.status}</dd>
        </>
      )}
    </dl>
  );
}
