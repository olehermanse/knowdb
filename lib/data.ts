import hostsJson from "@/data/hosts.json";
import infoJson from "@/data/info.json";
import groupsJson from "@/data/groups.json";

export interface Host {
  os: string;
  id: string;
  hostname: string;
  ips: string[];
  macs: string[];
  "ports-listening": number[];
  software: string[];
  "local-users": string[];
}

export type EntryType =
  | "host"
  | "hostname"
  | "os"
  | "ip"
  | "mac"
  | "port"
  | "software"
  | "user"
  | "group";

// A group of hosts, defined in data/groups.json by case-insensitive
// substring matching on host fields. A host is in the group if, for every
// field listed in `match`, at least one of the substrings matches.
export interface Group {
  name: string;
  description: string;
  match: {
    os?: string[];
    hostname?: string[];
  };
}

const groups = (groupsJson as { groups: Group[] }).groups;

function fieldMatches(value: string, substrings: string[] | undefined): boolean {
  if (!substrings) return true;
  const lower = value.toLowerCase();
  return substrings.some((s) => lower.includes(s.toLowerCase()));
}

export function hostInGroup(host: Host, group: Group): boolean {
  return (
    fieldMatches(host.os, group.match.os) &&
    fieldMatches(host.hostname, group.match.hostname)
  );
}

export interface EntryRef {
  type: EntryType;
  name: string;
}

export interface Entry extends EntryRef {
  // Host keys (SHA=...) of all hosts this entry is linked to.
  hosts: string[];
}

const hosts = hostsJson as Host[];

function entryKey(type: EntryType, name: string): string {
  return `${type}:${name}`;
}

function buildIndex() {
  const hostsByKey = new Map<string, Host>();
  const entries = new Map<string, { type: EntryType; name: string; hosts: Set<string> }>();
  const groupsByHost = new Map<string, string[]>();

  const ensure = (type: EntryType, name: string) => {
    const key = entryKey(type, name);
    let entry = entries.get(key);
    if (!entry) {
      entry = { type, name, hosts: new Set() };
      entries.set(key, entry);
    }
    return entry;
  };

  const link = (type: EntryType, name: string, hostkey: string) => {
    ensure(type, name).hosts.add(hostkey);
  };

  // Groups exist as entries even if no host currently matches them.
  for (const group of groups) ensure("group", group.name);

  for (const host of hosts) {
    hostsByKey.set(host.id, host);
    link("host", host.id, host.id);
    link("hostname", host.hostname, host.id);
    link("os", host.os, host.id);
    for (const ip of host.ips) link("ip", ip, host.id);
    for (const mac of host.macs) link("mac", mac, host.id);
    for (const port of host["ports-listening"]) link("port", String(port), host.id);
    for (const sw of host.software) link("software", sw, host.id);
    for (const user of host["local-users"]) link("user", user, host.id);
    const hostGroups = groups.filter((g) => hostInGroup(host, g)).map((g) => g.name);
    for (const name of hostGroups) link("group", name, host.id);
    groupsByHost.set(host.id, hostGroups);
  }

  return { hostsByKey, entries, groupsByHost };
}

const { hostsByKey, entries, groupsByHost } = buildIndex();

export function getEntry(type: EntryType, name: string): Entry | undefined {
  const entry = entries.get(entryKey(type, name));
  if (!entry) return undefined;
  return { type: entry.type, name: entry.name, hosts: [...entry.hosts].sort() };
}

export function getHost(hostkey: string): Host | undefined {
  return hostsByKey.get(hostkey);
}

export function getGroup(name: string): Group | undefined {
  return groups.find((g) => g.name === name);
}

export function allGroups(): Group[] {
  return groups;
}

// Names of the groups a host belongs to, in groups.json order.
export function getHostGroups(hostkey: string): string[] {
  return groupsByHost.get(hostkey) ?? [];
}

export interface PortCount {
  port: number;
  // Number of the given hosts listening on this port.
  hosts: number;
}

// Aggregate the listening ports of a set of hosts, ascending by port number.
export function aggregatePorts(hostkeys: string[]): PortCount[] {
  const counts = new Map<number, number>();
  for (const hostkey of hostkeys) {
    const host = hostsByKey.get(hostkey);
    if (!host) continue;
    for (const port of new Set(host["ports-listening"])) {
      counts.set(port, (counts.get(port) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([port, hosts]) => ({ port, hosts }))
    .sort((a, b) => a.port - b.port);
}

export interface OsCount {
  os: string;
  // Number of the given hosts running this operating system.
  hosts: number;
}

// Aggregate the operating systems of a set of hosts, most hosts first.
// Ties are broken alphabetically so the order is stable.
export function aggregateOs(hostkeys: string[]): OsCount[] {
  const counts = new Map<string, number>();
  for (const hostkey of hostkeys) {
    const host = hostsByKey.get(hostkey);
    if (!host) continue;
    counts.set(host.os, (counts.get(host.os) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([os, hosts]) => ({ os, hosts }))
    .sort((a, b) => b.hosts - a.hosts || a.os.localeCompare(b.os));
}

// Entry types whose pages aggregate information about their linked hosts.
export const AGGREGATING_TYPES: EntryType[] = ["group", "software", "os"];

export function allEntries(): EntryRef[] {
  return [...entries.values()].map(({ type, name }) => ({ type, name }));
}

function shuffle<T>(items: T[]): T[] {
  // Fisher-Yates shuffle, in place.
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// A random sample of `count` entries which is guaranteed to include at least
// one entry of every type (as long as `count` allows for it and the type has
// any entries). The remaining slots are filled from all other entries.
export function randomEntries(count: number): EntryRef[] {
  const byType = new Map<EntryType, EntryRef[]>();
  for (const entry of allEntries()) {
    let list = byType.get(entry.type);
    if (!list) {
      list = [];
      byType.set(entry.type, list);
    }
    list.push(entry);
  }

  const picked: EntryRef[] = [];
  const pickedKeys = new Set<string>();
  for (const type of shuffle([...ENTRY_TYPES])) {
    const list = byType.get(type);
    if (!list || picked.length >= count) continue;
    const entry = list[Math.floor(Math.random() * list.length)];
    picked.push(entry);
    pickedKeys.add(entryKey(entry.type, entry.name));
  }

  const rest = shuffle(
    allEntries().filter((e) => !pickedKeys.has(entryKey(e.type, e.name))),
  );
  picked.push(...rest.slice(0, Math.max(0, count - picked.length)));
  return shuffle(picked);
}

// Shorten a host key like "SHA=7a176d50116c..." to "SHA=7a176d50…" for lists.
export function abbreviateHostId(hostkey: string): string {
  const match = /^(SHA=)?([0-9a-fA-F]+)$/.exec(hostkey);
  if (!match || match[2].length <= 12) return hostkey;
  return `${match[1] ?? ""}${match[2].slice(0, 8)}…`;
}

// If a hostname belongs to exactly one host, return that host's key so
// links to the hostname can go straight to the host.
export function uniqueHostForHostname(hostname: string): string | undefined {
  const entry = entries.get(entryKey("hostname", hostname));
  if (entry && entry.hosts.size === 1) return [...entry.hosts][0];
  return undefined;
}

export function entryHref(ref: EntryRef): string {
  if (ref.type === "hostname") {
    const hostkey = uniqueHostForHostname(ref.name);
    if (hostkey) return entryHref({ type: "host", name: hostkey });
  }
  return `/entry/${ref.type}/${encodeURIComponent(ref.name)}`;
}

export const ENTRY_TYPES: EntryType[] = [
  "host",
  "hostname",
  "os",
  "ip",
  "mac",
  "port",
  "software",
  "user",
  "group",
];

export function isEntryType(value: string): value is EntryType {
  return (ENTRY_TYPES as string[]).includes(value);
}

// Hard coded, operator-editable descriptions of well-known ports and
// software, so a user can e.g. click on port 22 and read what it is for.
// An external source of information about an entry, e.g. a Wikipedia
// article: `title` is the article's title and `source` the site it is on.
export interface ExternalLink {
  title: string;
  source?: string;
  url: string;
}

// '"Secure Shell" on Wikipedia', or just the title if the source is unknown.
export function externalLinkLabel(link: ExternalLink): string {
  return link.source ? `"${link.title}" on ${link.source}` : link.title;
}

export interface DescribedInfo {
  description: string;
  links?: ExternalLink[];
}

export interface PortInfo extends DescribedInfo {
  // Short common name, e.g. "ssh" for port 22.
  name: string;
}

export type SoftwareInfo = DescribedInfo;

interface Info {
  ports: Record<string, PortInfo>;
  software: Record<string, SoftwareInfo>;
  users: Record<string, DescribedInfo>;
  os: Record<string, DescribedInfo>;
}

const info = infoJson as Info;

export function getPortInfo(port: string | number): PortInfo | undefined {
  return info.ports[String(port)];
}

export function getSoftwareInfo(name: string): SoftwareInfo | undefined {
  return info.software[name];
}

export function getUserInfo(name: string): DescribedInfo | undefined {
  return info.users[name];
}

export function getOsInfo(name: string): DescribedInfo | undefined {
  return info.os[name];
}

// External links for an entry, from info.json. Empty for entry types
// without hard coded information (hosts, IPs, ...).
export function getEntryLinks(entry: EntryRef): ExternalLink[] {
  switch (entry.type) {
    case "port":
      return getPortInfo(entry.name)?.links ?? [];
    case "software":
      return getSoftwareInfo(entry.name)?.links ?? [];
    case "user":
      return getUserInfo(entry.name)?.links ?? [];
    case "os":
      return getOsInfo(entry.name)?.links ?? [];
    default:
      return [];
  }
}

export const NO_USER_INFO = "No information available about this user.";
export const NO_OS_INFO = "No information available about this operating system.";

const TYPE_DESCRIPTIONS: Record<EntryType, string> = {
  host: "A machine reporting data to CFEngine, identified by its SHA-256 host key.",
  hostname: "The configured name of a host.",
  os: "An operating system.",
  ip: "An IP address (IPv4 or IPv6).",
  mac: "A MAC address, the hardware address of a network interface.",
  port: "A network port a host is listening on.",
  software: "A software package installed on a host.",
  user: "A local user account present on a host.",
  group: "A group of hosts, defined in groups.json.",
};

export function describeEntry(entry: EntryRef): string {
  if (entry.type === "port") {
    const known = getPortInfo(entry.name);
    if (known) return `Port ${entry.name} (${known.name}): ${known.description}`;
  }
  if (entry.type === "software") {
    const known = getSoftwareInfo(entry.name);
    if (known) return known.description;
  }
  if (entry.type === "group") {
    const group = getGroup(entry.name);
    if (group) return group.description;
  }
  if (entry.type === "user") {
    return getUserInfo(entry.name)?.description ?? NO_USER_INFO;
  }
  if (entry.type === "os") {
    return getOsInfo(entry.name)?.description ?? NO_OS_INFO;
  }
  return TYPE_DESCRIPTIONS[entry.type];
}

export interface SearchResult {
  entry: Entry;
  description: string;
}

// Rank of a match: lower sorts first.
function matchRank(entry: Entry, description: string, q: string): number {
  const name = entry.name.toLowerCase();
  const host = entry.type === "host" ? hostsByKey.get(entry.name) : undefined;
  const hostname = host?.hostname.toLowerCase();
  if (name === q || hostname === q) return 0;
  if (name.startsWith(q) || hostname?.startsWith(q)) return 1;
  if (name.includes(q) || hostname?.includes(q)) return 2;
  if (entry.type === "port" && getPortInfo(entry.name)?.name.toLowerCase() === q)
    return 1;
  if (description.toLowerCase().includes(q)) return 3;
  return -1;
}

// Search "anything": entry names, hostnames, host keys, port names, and
// the descriptions of entries. Case-insensitive substring matching.
// Hostname entries are left out when they resolve to a single host, since
// that host is found by its hostname anyway.
export function searchEntries(query: string, limit = 200): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: (SearchResult & { rank: number })[] = [];
  for (const raw of entries.values()) {
    if (raw.type === "hostname" && uniqueHostForHostname(raw.name)) continue;
    const entry: Entry = { type: raw.type, name: raw.name, hosts: [...raw.hosts].sort() };
    const description = describeEntry(entry);
    const rank = matchRank(entry, description, q);
    if (rank >= 0) results.push({ entry, description, rank });
  }
  results.sort(
    (a, b) =>
      a.rank - b.rank ||
      ENTRY_TYPES.indexOf(a.entry.type) - ENTRY_TYPES.indexOf(b.entry.type) ||
      a.entry.name.localeCompare(b.entry.name),
  );
  return results.slice(0, limit).map(({ entry, description }) => ({ entry, description }));
}

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

// One sentence with numbers from your infrastructure, shown below the
// description of an entry, e.g. "cron is installed on 87 hosts in your
// infrastructure, across 10 operating systems."
export function summarizeEntry(entry: Entry): string {
  const n = entry.hosts.length;
  const hosts = plural(n, "host");
  const oses = () => plural(aggregateOs(entry.hosts).length, "operating system");
  const ports = () => plural(aggregatePorts(entry.hosts).length, "different port");
  switch (entry.type) {
    case "software":
      return `${entry.name} is installed on ${hosts} in your infrastructure, across ${oses()}.`;
    case "os":
      return `In your infrastructure, you have ${entry.name} installed on ${hosts}, and these hosts are listening to ${ports()}.`;
    case "port":
      return `Port ${entry.name} is open on ${hosts} in your infrastructure, across ${oses()}.`;
    case "user":
      return `The user ${entry.name} exists on ${hosts} in your infrastructure, across ${oses()}.`;
    case "group":
      return `This group has ${hosts} in your infrastructure, running ${oses()} and listening to ${ports()}.`;
    case "ip":
      return `This IP address is used by ${hosts} in your infrastructure.`;
    case "mac":
      return `This MAC address belongs to ${hosts} in your infrastructure.`;
    case "hostname":
      return `${hosts} in your infrastructure ${n === 1 ? "has" : "share"} this hostname.`;
    case "host": {
      const host = hostsByKey.get(entry.name);
      if (!host) return "";
      return (
        `This host has ${plural(host.ips.length, "IP address", "IP addresses")} and ` +
        `${plural(host.macs.length, "MAC address", "MAC addresses")}, listens on ` +
        `${plural(host["ports-listening"].length, "port")}, has ` +
        `${plural(host.software.length, "software package")} and ` +
        `${plural(host["local-users"].length, "local user")}, and is in ` +
        `${plural(getHostGroups(host.id).length, "group")}.`
      );
    }
  }
}
