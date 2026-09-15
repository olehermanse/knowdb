import PieChart, { PieItem } from "@/components/PieChart";
import { aggregateClouds, Entry } from "@/lib/data";

export const NO_CLOUD_LABEL = "None";

function sectionText(entry: Entry): string {
  switch (entry.type) {
    case "software":
      return `The hosts with ${entry.name} installed run in these clouds:`;
    case "service":
      return `The hosts running ${entry.name} run in these clouds:`;
    case "version":
      return `The hosts with ${entry.name} run in these clouds:`;
    case "os":
      return `The ${entry.name} hosts run in these clouds:`;
    case "port":
      return "The hosts listening to this port run in these clouds:";
    case "role":
      return `The CFEngine ${entry.name.toLowerCase()}s run in these clouds:`;
    default:
      return "The hosts run in these clouds:";
  }
}

// "Clouds" tab: a pie chart and ranked list of the cloud providers the
// related hosts run in. Hosts without a provider get their own slice.
export default function CloudProviders({ entry }: { entry: Entry }) {
  const counts = aggregateClouds(entry.hosts);
  const items: PieItem[] = counts.map((c) => ({
    label: c.cloud || NO_CLOUD_LABEL,
    hosts: c.hosts,
    link: c.cloud ? { type: "cloud", name: c.cloud } : undefined,
  }));
  return (
    <section data-testid="cloud-section">
      <p className="muted">{sectionText(entry)}</p>
      <PieChart
        items={items}
        subject="These hosts"
        noun="cloud provider"
        testId="cloud"
        ariaLabel="Cloud providers"
      />
    </section>
  );
}
