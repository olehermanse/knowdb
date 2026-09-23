import { Entry, functionSignature, getFunctionSyntax } from "@/lib/data";

// The signature, parameters, return type and category of a built-in
// function, from data/functions.json, laid out like a host's details.
export default function FunctionDetails({ entry }: { entry: Entry }) {
  const fn = getFunctionSyntax(entry.name);
  if (!fn) return null;
  return (
    <dl className="host-details" data-testid="function-details">
      <dt>Signature</dt>
      <dd>
        <code data-testid="function-signature">{functionSignature(entry.name, fn)}</code>
      </dd>
      <dt>Parameters</dt>
      <dd data-testid="function-parameters">
        {fn.parameters.length === 0 ? (
          <span className="muted">None</span>
        ) : (
          <ol className="function-parameters">
            {fn.parameters.map((p, i) => (
              <li key={i}>
                <code>{p.type}</code> {p.description}{" "}
                <span className="muted" title="Allowed values">
                  ({p.range})
                </span>
              </li>
            ))}
          </ol>
        )}
        {fn.variadic && (
          <div className="muted" data-testid="function-variadic">
            Variadic: at least {fn.minArgs ?? fn.parameters.length}
            {fn.maxArgs !== undefined ? ` and at most ${fn.maxArgs}` : ""} arguments.
          </div>
        )}
      </dd>
      <dt>Returns</dt>
      <dd data-testid="function-returns">
        <code>{fn.returnType}</code>
      </dd>
      <dt>Category</dt>
      <dd data-testid="function-category">{fn.category}</dd>
      {fn.status !== "normal" && (
        <>
          <dt>Status</dt>
          <dd data-testid="function-status">{fn.status}</dd>
        </>
      )}
    </dl>
  );
}
