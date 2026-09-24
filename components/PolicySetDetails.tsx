import { Entry, formatBytes, getPolicySet } from "@/lib/data";

// The version, checksum and size of a policy set, laid out like a host's
// details.
export default function PolicySetDetails({ entry }: { entry: Entry }) {
  const set = getPolicySet(entry.name);
  if (!set) return null;
  const files = Object.keys(set.files).length;
  return (
    <dl className="host-details" data-testid="policy-set-details">
      <dt>Version</dt>
      <dd data-testid="policy-set-version">{set.version}</dd>
      <dt>Checksum</dt>
      <dd>
        <code data-testid="policy-set-checksum">{entry.name}</code>
      </dd>
      <dt>Files</dt>
      <dd data-testid="policy-set-files">{files}</dd>
      <dt>Size</dt>
      <dd data-testid="policy-set-size">{formatBytes(set.size)}</dd>
    </dl>
  );
}
