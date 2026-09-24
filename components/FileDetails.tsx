import EntryLink from "@/components/EntryLink";
import { Entry, policySetsWithFile } from "@/lib/data";

// The policy sets a file belongs to, as a field below the description
// (like a host's details); nothing when the file is in none.
export default function FileDetails({ entry }: { entry: Entry }) {
  const sets = policySetsWithFile(entry.name);
  if (sets.length === 0) return null;
  return (
    <dl className="host-details" data-testid="file-details">
      <dt>Policy sets</dt>
      <dd className="inline-links" data-testid="file-policy-sets">
        {sets.map((set) => (
          <EntryLink key={set} type="policy-set" name={set} />
        ))}
      </dd>
    </dl>
  );
}
