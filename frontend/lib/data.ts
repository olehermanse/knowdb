import hostsJson from "@/data/hosts.json";

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

export function entryHref(ref: EntryRef): string {
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

// Short descriptions for well-known entries, so a user can e.g. click
// on port 22 and read what it is for.
const PORT_DESCRIPTIONS: Record<string, string> = {
  "22": "SSH (Secure Shell) — remote login and command execution.",
  "25": "SMTP — sending email between mail servers.",
  "53": "DNS — domain name resolution.",
  "80": "HTTP — unencrypted web traffic.",
  "123": "NTP — network time synchronization.",
  "143": "IMAP — reading email from a mail server.",
  "443": "HTTPS — encrypted web traffic.",
  "465": "SMTPS — email submission over TLS.",
  "587": "SMTP submission — email submission from clients.",
  "873": "rsync — file synchronization service.",
  "993": "IMAPS — IMAP over TLS.",
  "3000": "Grafana — dashboards and visualization (common default).",
  "3128": "Squid — HTTP proxy (common default).",
  "3306": "MySQL — relational database.",
  "5308": "CFEngine — communication between CFEngine hosts.",
  "5432": "PostgreSQL — relational database.",
  "9090": "Prometheus — metrics and monitoring (common default).",
};

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
    const known = PORT_DESCRIPTIONS[entry.name];
    if (known) return `Port ${entry.name}: ${known}`;
  }
  return TYPE_DESCRIPTIONS[entry.type];
}
