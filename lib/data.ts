import hostsJson from "@/data/hosts.json";
import infoJson from "@/data/info.json";
import groupsJson from "@/data/groups.json";

export interface Host {
  os: string;
  id: string;
  hostname: string;
  ips: string[];
  "ports-listening": number[];
  software: string[];
  "local-users": string[];
}

export type EntryType =
  | "host"
  | "hostname"
  | "os"
  | "ip"
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
export interface PortInfo {
  // Short common name, e.g. "ssh" for port 22.
  name: string;
  description: string;
}

export interface SoftwareInfo {
  description: string;
}

interface Info {
  ports: Record<string, PortInfo>;
  software: Record<string, SoftwareInfo>;
}

const info = infoJson as Info;

export function getPortInfo(port: string | number): PortInfo | undefined {
  return info.ports[String(port)];
}

export function getSoftwareInfo(name: string): SoftwareInfo | undefined {
  return info.software[name];
}

const TYPE_DESCRIPTIONS: Record<EntryType, string> = {
  host: "A machine reporting data to CFEngine, identified by its SHA-256 host key.",
  hostname: "The configured name of a host.",
  os: "An operating system.",
  ip: "An IP address (IPv4 or IPv6).",
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
  return TYPE_DESCRIPTIONS[entry.type];
}
