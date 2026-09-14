import hostsJson from "@/data/hosts.json";
import infoJson from "@/data/info.json";

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
  | "user";

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

  const link = (type: EntryType, name: string, hostkey: string) => {
    const key = entryKey(type, name);
    let entry = entries.get(key);
    if (!entry) {
      entry = { type, name, hosts: new Set() };
      entries.set(key, entry);
    }
    entry.hosts.add(hostkey);
  };

  for (const host of hosts) {
    hostsByKey.set(host.id, host);
    link("host", host.id, host.id);
    link("hostname", host.hostname, host.id);
    link("os", host.os, host.id);
    for (const ip of host.ips) link("ip", ip, host.id);
    for (const port of host["ports-listening"]) link("port", String(port), host.id);
    for (const sw of host.software) link("software", sw, host.id);
    for (const user of host["local-users"]) link("user", user, host.id);
  }

  return { hostsByKey, entries };
}

const { hostsByKey, entries } = buildIndex();

export function getEntry(type: EntryType, name: string): Entry | undefined {
  const entry = entries.get(entryKey(type, name));
  if (!entry) return undefined;
  return { type: entry.type, name: entry.name, hosts: [...entry.hosts].sort() };
}

export function getHost(hostkey: string): Host | undefined {
  return hostsByKey.get(hostkey);
}

export function allEntries(): EntryRef[] {
  return [...entries.values()].map(({ type, name }) => ({ type, name }));
}

export function randomEntries(count: number): EntryRef[] {
  const all = allEntries();
  // Fisher-Yates shuffle, then take the first `count`.
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count);
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
  return TYPE_DESCRIPTIONS[entry.type];
}
