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
  // Version of each installed software, keyed by software name.
  "software-versions": Record<string, string>;
  "local-users": string[];
  // CFEngine classes reported by the host, e.g. "linux", "ubuntu_22".
  classes: string[];
  // Whether the host has reported in recently.
  online: boolean;
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
  | "group"
  | "class"
  // A specific version of a piece of software, named "<software> <version>".
  | "version";

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

const hosts = hostsJson as unknown as Host[];
// Hard coded descriptions, links and logos; the type is defined further down.
const info = infoJson as Info;

function entryKey(type: EntryType, name: string): string {
  return `${type}:${name}`;
}

// Version entries are named "<software> <version>", e.g. "apache 2.4.62".
export function versionEntryName(software: string, version: string): string {
  return `${software} ${version}`;
}

export function parseVersionEntryName(name: string): { software: string; version: string } {
  const i = name.indexOf(" ");
  return i < 0
    ? { software: name, version: "" }
    : { software: name.slice(0, i), version: name.slice(i + 1) };
}

// Names of different entry types often refer to the same thing: the group
// "Linux" and the class "linux", the class "ubuntu_24" and the OS
// "Ubuntu 24". Normalising lowercases and turns runs of anything that is
// not a letter or digit into "_" so such names compare equal.
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Entry types whose names are worth matching against each other.
const NAME_MATCH_TYPES: EntryType[] = ["os", "software", "user", "group", "class", "port"];

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
    for (const sw of host.software) {
      link("software", sw, host.id);
      const version = host["software-versions"]?.[sw];
      if (version) link("version", versionEntryName(sw, version), host.id);
    }
    for (const user of host["local-users"]) link("user", user, host.id);
    for (const cls of host.classes ?? []) link("class", cls, host.id);
    const hostGroups = groups.filter((g) => hostInGroup(host, g)).map((g) => g.name);
    for (const name of hostGroups) link("group", name, host.id);
    groupsByHost.set(host.id, hostGroups);
  }

  // Entries of matchable types by normalised name; ports also under their
  // common name (5308 is also "cfengine").
  const byNormalizedName = new Map<string, EntryRef[]>();
  const addName = (name: string, ref: EntryRef) => {
    const key = normalizeName(name);
    if (!key) return;
    const list = byNormalizedName.get(key) ?? [];
    if (!list.some((r) => r.type === ref.type && r.name === ref.name)) list.push(ref);
    byNormalizedName.set(key, list);
  };
  for (const { type, name } of entries.values()) {
    if (!NAME_MATCH_TYPES.includes(type)) continue;
    addName(name, { type, name });
    if (type === "port") {
      const common = info.ports[name]?.name;
      if (common) addName(common, { type, name });
    }
  }

  return { hostsByKey, entries, groupsByHost, byNormalizedName };
}

const { hostsByKey, entries, groupsByHost, byNormalizedName } = buildIndex();

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

export interface VersionCount {
  version: string;
  // Number of the given hosts having this version installed.
  hosts: number;
}

// The versions of a piece of software across the given hosts, most hosts
// first; ties are broken by version string, newest-looking first.
export function aggregateVersions(software: string, hostkeys: string[]): VersionCount[] {
  const counts = new Map<string, number>();
  for (const hostkey of hostkeys) {
    const version = hostsByKey.get(hostkey)?.["software-versions"]?.[software];
    if (version) counts.set(version, (counts.get(version) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([version, hosts]) => ({ version, hosts }))
    .sort((a, b) => b.hosts - a.hosts || compareVersions(b.version, a.version));
}

// Compare dotted version strings numerically where possible.
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-p]/);
  const pb = b.split(/[.\-p]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i] ?? 0);
    const nb = Number(pb[i] ?? 0);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      const c = (pa[i] ?? "").localeCompare(pb[i] ?? "");
      if (c !== 0) return c;
    } else if (na !== nb) {
      return na - nb;
    }
  }
  return 0;
}

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
  "class",
  "version",
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

// Wikipedia links read '"Secure Shell" on Wikipedia'; any other link is
// shown as its address without the scheme, e.g. "openssh.com" or
// "github.com/openssh/openssh-portable".
export function externalLinkLabel(link: ExternalLink): string {
  if (link.source === "Wikipedia") return `"${link.title}" on ${link.source}`;
  return link.url
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

export interface DescribedInfo {
  description: string;
  links?: ExternalLink[];
  // URL of a logo image (SVG or PNG) for well-known software, OSes, ports.
  logo?: string;
}

export interface PortInfo extends DescribedInfo {
  // Short common name, e.g. "ssh" for port 22.
  name: string;
}

export interface SoftwareInfo extends DescribedInfo {
  // Ports this software typically listens on, e.g. [5432] for postgresql.
  ports?: number[];
}

export interface OsInfo extends DescribedInfo {
  // Brand colour (hex) used for the avatars of hosts running this OS.
  color?: string;
}

export interface IpRangeInfo extends DescribedInfo {
  // CIDR notation, e.g. "10.0.0.0/8" or "fe80::/10".
  cidr: string;
}

interface Info {
  ports: Record<string, PortInfo>;
  software: Record<string, SoftwareInfo>;
  users: Record<string, DescribedInfo>;
  os: Record<string, OsInfo>;
  ips: Record<string, DescribedInfo>;
  "ip-ranges": IpRangeInfo[];
  classes: Record<string, DescribedInfo>;
}


export function getPortInfo(port: string | number): PortInfo | undefined {
  return info.ports[String(port)];
}

export function getSoftwareInfo(name: string): SoftwareInfo | undefined {
  return info.software[name];
}

// Parse an IP address into a (version, integer) pair, or undefined.
function parseIp(address: string): { bits: number; value: bigint } | undefined {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) {
    const parts = address.split(".").map(Number);
    if (parts.some((n) => n > 255)) return undefined;
    return { bits: 32, value: parts.reduce((acc, n) => (acc << BigInt(8)) + BigInt(n), BigInt(0)) };
  }
  if (!address.includes(":")) return undefined;
  // IPv6, possibly with an embedded IPv4 tail like ::ffff:10.0.0.1.
  let text = address.toLowerCase();
  const v4tail = /:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (v4tail) {
    const v4 = parseIp(v4tail[1]);
    if (!v4) return undefined;
    const hi = (v4.value >> BigInt(16)).toString(16);
    const lo = (v4.value & BigInt(0xffff)).toString(16);
    text = text.slice(0, v4tail.index) + `:${hi}:${lo}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return undefined;
  const groups = [...head, ...Array(missing).fill("0"), ...tail];
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return undefined;
  return { bits: 128, value: groups.reduce((acc, g) => (acc << BigInt(16)) + BigInt(parseInt(g, 16)), BigInt(0)) };
}

function inCidr(address: string, cidr: string): boolean {
  const [base, prefixText] = cidr.split("/");
  const ip = parseIp(address);
  const net = parseIp(base);
  const prefix = Number(prefixText);
  if (!ip || !net || ip.bits !== net.bits || Number.isNaN(prefix)) return false;
  const shift = BigInt(ip.bits - prefix);
  return ip.value >> shift === net.value >> shift;
}

// Information about an IP address: an exact entry in info.json, or the
// first CIDR range in info.json containing it.
export function getIpInfo(address: string): DescribedInfo | undefined {
  const exact = info.ips[address];
  if (exact) return exact;
  return info["ip-ranges"].find((range) => inCidr(address, range.cidr));
}

export function getClassInfo(name: string): DescribedInfo | undefined {
  return info.classes[name];
}

export function getUserInfo(name: string): DescribedInfo | undefined {
  return info.users[name];
}

export function getOsInfo(name: string): OsInfo | undefined {
  return info.os[name];
}

// Colour for an operating system: from info.json (exact entry, or any
// entry of the same family such as "Ubuntu 24" for "Ubuntu 99"), else a
// stable hue derived from the name.
export function getOsColor(os: string): string {
  const exact = info.os[os]?.color;
  if (exact) return exact;
  const family = os.split(" ")[0];
  for (const [name, entry] of Object.entries(info.os)) {
    if (entry.color && name.split(" ")[0] === family) return entry.color;
  }
  let hash = 0;
  for (const ch of os) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 55% 45%)`;
}

// External links for an entry, from info.json. Empty for entry types
// without hard coded information (hosts, IPs, ...).
export function getEntryLinks(entry: EntryRef): ExternalLink[] {
  if (entry.type === "version") return [];
  return infoFor(entry)?.links ?? [];
}

function infoFor(entry: EntryRef): DescribedInfo | undefined {
  switch (entry.type) {
    case "port":
      return getPortInfo(entry.name);
    case "software":
      return getSoftwareInfo(entry.name);
    case "user":
      return getUserInfo(entry.name);
    case "os":
      return getOsInfo(entry.name);
    case "ip":
      return getIpInfo(entry.name);
    case "class":
      return getClassInfo(entry.name);
    case "version":
      // Versions share the software's description, links and logo.
      return getSoftwareInfo(parseVersionEntryName(entry.name).software);
    default:
      return undefined;
  }
}

// Logo URL for an entry, from info.json, if it has one.
export function getEntryLogo(entry: EntryRef): string | undefined {
  return infoFor(entry)?.logo;
}

// Related entries worth a look: software links to the ports it listens
// on and ports link back to the software, based on info.json. Only
// entries that exist in the infrastructure are returned.
export function getSeeAlso(entry: EntryRef): EntryRef[] {
  const related: EntryRef[] = [];
  if (entry.type === "version") {
    related.push({ type: "software", name: parseVersionEntryName(entry.name).software });
  } else if (entry.type === "software") {
    for (const port of getSoftwareInfo(entry.name)?.ports ?? []) {
      related.push({ type: "port", name: String(port) });
    }
  } else if (entry.type === "port") {
    const port = Number(entry.name);
    for (const [name, sw] of Object.entries(info.software)) {
      if (sw.ports?.includes(port)) related.push({ type: "software", name });
    }
  }
  // Entries of other types with a matching name, e.g. the class "linux"
  // for the group "Linux". Ports are also matched by their common name.
  const names = [entry.name];
  if (entry.type === "port") {
    const common = getPortInfo(entry.name)?.name;
    if (common) names.push(common);
  }
  for (const name of names) {
    for (const ref of byNormalizedName.get(normalizeName(name)) ?? []) {
      if (ref.type === entry.type) continue;
      if (!related.some((r) => r.type === ref.type && r.name === ref.name)) related.push(ref);
    }
  }
  return related.filter((ref) => entries.has(entryKey(ref.type, ref.name)));
}

// "port 5432 (postgresql)", "postgresql (software)", "Ubuntu 24 (OS)", ...
export function seeAlsoLabel(ref: EntryRef): string {
  if (ref.type === "port") {
    const name = getPortInfo(ref.name)?.name;
    return name ? `port ${ref.name} (${name})` : `port ${ref.name}`;
  }
  const typeLabel = ref.type === "os" ? "OS" : ref.type;
  return `${ref.name} (${typeLabel})`;
}

export const NO_USER_INFO = "No information available about this user.";
export const NO_OS_INFO = "No information available about this operating system.";
export const NO_CLASS_INFO = "No information available about this class.";

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
  class: "A CFEngine class reported by hosts, describing something true about them.",
  version: "A specific version of a piece of software.",
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
  if (entry.type === "ip") {
    const known = getIpInfo(entry.name);
    if (known) return known.description;
  }
  if (entry.type === "class") {
    return getClassInfo(entry.name)?.description ?? NO_CLASS_INFO;
  }
  if (entry.type === "version") {
    const { software, version } = parseVersionEntryName(entry.name);
    return `Version ${version} of ${software}.`;
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
    case "software": {
      const versions = aggregateVersions(entry.name, entry.hosts).length;
      const versionsText = versions > 0 ? `, in ${plural(versions, "different version")}` : "";
      return `${entry.name} is installed on ${hosts} in your infrastructure, across ${oses()}${versionsText}.`;
    }
    case "version":
      // Version pages are kept short: the software page has the numbers.
      return "";
    case "os":
      return `In your infrastructure, you have ${entry.name} installed on ${hosts}, and these hosts are listening to ${ports()}.`;
    case "port":
      return `Port ${entry.name} is open on ${hosts} in your infrastructure, across ${oses()}.`;
    case "user":
      return `The user ${entry.name} exists on ${hosts} in your infrastructure, across ${oses()}.`;
    case "group":
      return `This group has ${hosts} in your infrastructure, running ${oses()} and listening to ${ports()}.`;
    case "class":
      return `This class is set on ${hosts} in your infrastructure, running ${oses()} and listening to ${ports()}.`;
    case "ip":
      return `This IP address is used by ${hosts} in your infrastructure.`;
    case "mac":
      return `This MAC address belongs to ${hosts} in your infrastructure.`;
    case "hostname":
      return `${hosts} in your infrastructure ${n === 1 ? "has" : "share"} this hostname.`;
    case "host": {
      const host = hostsByKey.get(entry.name);
      return host ? describeHost(host) : "";
    }
  }
}

// Structured search: a query can contain filters like `port:22` or
// `group:"production Linux"`; hosts matching every filter are returned.
// Any remaining free text narrows the hosts by hostname or host key.
export interface SearchFilter {
  type: EntryType;
  name: string;
}

export interface ParsedQuery {
  filters: SearchFilter[];
  text: string;
}

export function parseSearchQuery(query: string): ParsedQuery {
  const filters: SearchFilter[] = [];
  const rest: string[] = [];
  const token = /(\S+?):(?:"([^"]*)"|(\S+))|"([^"]*)"|(\S+)/g;
  for (const m of query.matchAll(token)) {
    const [, type, quoted, bare, quotedText, word] = m;
    if (type !== undefined && isEntryType(type)) {
      filters.push({ type, name: quoted ?? bare ?? "" });
    } else {
      rest.push(m[0].startsWith('"') ? (quotedText ?? "") : (word ?? m[0]));
    }
  }
  return { filters, text: rest.join(" ").trim() };
}

function quoteFilterValue(name: string): string {
  return /[\s"]/.test(name) ? `"${name.replace(/"/g, "")}"` : name;
}

// The search URL for hosts matching all of the given filters.
export function filterSearchHref(filters: SearchFilter[]): string {
  const q = filters.map((f) => `${f.type}:${quoteFilterValue(f.name)}`).join(" ");
  return `/search?q=${encodeURIComponent(q)}`;
}

// Hosts matching every filter, sorted by hostname. Unknown filter values
// match nothing.
export function searchHosts(parsed: ParsedQuery): Host[] {
  let keys: Set<string> | undefined;
  for (const filter of parsed.filters) {
    const entry = entries.get(entryKey(filter.type, filter.name));
    const found = entry ? entry.hosts : new Set<string>();
    keys = keys ? new Set([...keys].filter((k) => found.has(k))) : new Set(found);
  }
  const text = parsed.text.toLowerCase();
  const hosts = [...(keys ?? hostsByKey.keys())]
    .map((k) => hostsByKey.get(k)!)
    .filter(
      (h) =>
        !text ||
        h.hostname.toLowerCase().includes(text) ||
        h.id.toLowerCase().includes(text),
    );
  return hosts.sort((a, b) => a.hostname.localeCompare(b.hostname));
}

// "port 22 in group Windows" for a summary sentence.
export function describeFilters(filters: SearchFilter[]): string {
  return filters
    .map((f) => (f.type === "port" ? `port ${f.name}` : `${f.type} ${f.name}`))
    .join(", ");
}

// Environments recognised from the first part of a hostname, e.g.
// "staging2-mail-alpha" is in the staging environment.
const ENVIRONMENTS: Record<string, string> = {
  production: "production",
  prod: "production",
  staging: "staging",
  stage: "staging",
  testing: "testing",
  test: "testing",
  dev: "development",
  development: "development",
};

// Roles recognised from words in a hostname.
const HOSTNAME_ROLES: Record<string, string> = {
  webserver: "web server",
  web: "web server",
  www: "web server",
  mail: "mail server",
  smtp: "mail server",
  imap: "mail server",
  db: "database server",
  database: "database server",
  postgres: "database server",
  mysql: "database server",
  dns: "DNS server",
  ntp: "NTP server",
  lb: "load balancer",
  loadbalancer: "load balancer",
  proxy: "proxy server",
  firewall: "firewall",
  fw: "firewall",
  hub: "CFEngine hub",
  monitor: "monitoring server",
  monitoring: "monitoring server",
  backup: "backup server",
  client: "client machine",
};

// Roles guessed from listening ports when the hostname gives no hint.
const PORT_ROLES: [number[], string][] = [
  [[25, 143, 465, 587, 993], "mail server"],
  [[80, 443], "web server"],
  [[3306, 5432], "database server"],
  [[53], "DNS server"],
  [[123], "NTP server"],
  [[3128], "proxy server"],
  [[9090, 3000], "monitoring server"],
  [[873], "backup server"],
];

export function hostEnvironment(host: Host): string | undefined {
  const first = host.hostname.split(/[-_.]/)[0].toLowerCase().replace(/\d+$/, "");
  return ENVIRONMENTS[first];
}

export function hostRole(host: Host): string | undefined {
  for (const word of host.hostname.toLowerCase().split(/[-_.]/)) {
    const role = HOSTNAME_ROLES[word.replace(/\d+$/, "")];
    if (role) return role;
  }
  const ports = new Set(host["ports-listening"]);
  for (const [candidates, role] of PORT_ROLES) {
    if (candidates.some((p) => ports.has(p))) return role;
  }
  return undefined;
}

// "an" before a vowel, and before acronyms spelled out letter by letter
// whose first letter is pronounced with a vowel sound (NTP, SSH, FTP, ...).
// Acronyms pronounced as words (RHEL, SUSE) keep "a".
const WORD_ACRONYMS = new Set(["RHEL", "SUSE", "MAC"]);
function withArticle(noun: string): string {
  const first = noun.split(/\s/)[0];
  const spelledOut = /^[A-Z]{2,}$/.test(first) && !WORD_ACRONYMS.has(first);
  const vowelSound = spelledOut ? /^[AEFHILMNORSX]/.test(first) : /^[aeiou]/i.test(noun);
  return `${vowelSound ? "an" : "a"} ${noun}`;
}

// "This is an Ubuntu 24 host in the staging environment. It looks like a
// mail server."
export function describeHost(host: Host): string {
  const env = hostEnvironment(host);
  const role = hostRole(host);
  let text = `This is ${withArticle(host.os)} host`;
  if (env) text += ` in the ${env} environment`;
  text += ".";
  if (role) text += ` It looks like ${withArticle(role)}.`;
  return text;
}
