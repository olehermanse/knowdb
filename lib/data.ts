import hostsJson from "@/data/hosts.json";
import infoJson from "@/data/info.json";
import groupsJson from "@/data/groups.json";
import commentsJson from "@/data/comments.json";
import filesJson from "@/data/files.json";
import policyJson from "@/data/policy.json";
import functionsJson from "@/data/functions.json";

export interface Host {
  os: string;
  id: string;
  hostname: string;
  ips: string[];
  macs: string[];
  "ports-listening": number[];
  software: string[];
  // Running systemd services (unit names); empty on Windows.
  services: string[];
  // Version of each installed software, keyed by software name.
  "software-versions": Record<string, string>;
  "local-users": string[];
  // Details of each local user, keyed by user name.
  "user-details": Record<string, UserDetails>;
  // Disk space and memory, total and currently free.
  disk: { "total-gb": number; "free-gb": number };
  memory: { "total-mb": number; "free-mb": number };
  // CFEngine classes reported by the host, e.g. "linux", "ubuntu_22".
  classes: string[];
  // The host's CFEngine role, and the IP address of the hub it reports to
  // (a hub's own address for hubs).
  role: Role;
  hub: string;
  // CFEngine special variables (sys.*) and their values on this host.
  // Every host defines the same variables, with differing values.
  variables: Record<string, string>;
  // Whether the host has reported in recently.
  online: boolean;
  // Cloud provider the host runs in, or "" for your own data center.
  "cloud-provider": string;
  // When the host first and most recently reported in (ISO 8601, UTC).
  "first-seen": string;
  "last-seen": string;
  // Notable files on the host (the CFEngine policy, files CFEngine edits,
  // the cf-agent binary): absolute path -> SHA-256 checksum of the content.
  files: Record<string, string>;
}

// The content of a file, from data/files.json, keyed by checksum. Binaries
// have no content, only a size.
export interface FileContent {
  size: number;
  content: string | null;
}
const fileContents = (filesJson as unknown as { files: Record<string, FileContent> }).files;

export function getFileContent(checksum: string): FileContent | undefined {
  return fileContents[checksum];
}

// The last component of an absolute path, Unix or Windows.
export function fileNameOf(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

// "3.2 kB", "9.8 MB", "512 B".
export function formatBytes(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))} MB`;
  if (n >= 1000) return `${Number((n / 1000).toFixed(1))} kB`;
  return `${n} B`;
}

// The first 16 hex digits of a checksum, for lists and links.
export function abbreviateChecksum(checksum: string): string {
  return checksum.length > 16 ? checksum.slice(0, 16) : checksum;
}

// The built-in CFEngine functions, from data/functions.json (the functions
// section of the CFEngine CLI's syntax-description.json, copied by
// scripts/import_functions.py).
export interface FunctionParameter {
  description: string;
  // The allowed values: a regular expression or a "min,max" range.
  range: string;
  type: string;
}
export interface FunctionSyntax {
  category: string;
  parameters: FunctionParameter[];
  returnType: string;
  // "normal" or "deprecated".
  status: string;
  variadic: boolean;
  minArgs?: number;
  maxArgs?: number;
  cached: boolean;
  collecting: boolean;
}
const builtinFunctions = (functionsJson as unknown as { functions: Record<string, FunctionSyntax> }).functions;

export function getFunctionSyntax(name: string): FunctionSyntax | undefined {
  return builtinFunctions[name];
}

// "ifelse(string[, string], ...)": the parameter types, the optional ones
// in brackets, and "..." for a variadic function.
export function functionSignature(name: string, fn: FunctionSyntax): string {
  const required = fn.minArgs ?? fn.parameters.length;
  const parts = fn.parameters.map((p, i) => (i < required ? p.type : `[${p.type}]`));
  if (fn.variadic) parts.push("...");
  return `${name}(${parts.join(", ")})`;
}

// "a string", "a class", "a list of strings", ... for a return type.
const RETURN_WORDS: Record<string, string> = {
  context: "a class",
  string: "a string",
  int: "an integer",
  real: "a real number",
  slist: "a list of strings",
  ilist: "a list of integers",
  rlist: "a list of real numbers",
  irange: "an integer range",
  rrange: "a real number range",
  data: "a data container",
};

// What the CFEngine policy files define, from data/policy.json (written by
// scripts/index_policy.mjs), keyed by the file's checksum.
export interface PolicyBlockRef {
  type: "bundle" | "body" | "custom-promise-type";
  // "bundle agent main" or "body common control" (keyword, type and name)
  // for a bundle or body, the name for a promise type: the name of the
  // corresponding entry.
  name: string;
}
interface PolicyDefinition {
  type: string;
  name: string;
  line: number;
  parameters?: string[];
}
interface PolicyItem {
  name: string;
  line: number;
  block: PolicyBlockRef;
  // The type of a variable (string, slist, data, ...), if given.
  type?: string;
}
interface PolicyCall {
  name: string;
  line: number;
  block: PolicyBlockRef;
  // The attribute the call is the value of, e.g. "if" or "usebundle".
  attribute?: string;
}

// What a call (that is not of a built-in function) refers to: a bundle
// (`usebundle => name(...)`, or a bare call) or a body (`perms => mog(...)`,
// the value of an attribute).
export type CallKind = "bundle" | "body";
export interface PolicyFile {
  bundles: PolicyDefinition[];
  bodies: PolicyDefinition[];
  "promise-types": { name: string; line: number }[];
  vars: PolicyItem[];
  classes: PolicyItem[];
  calls: PolicyCall[];
  errors: boolean;
}
const policyFiles = (policyJson as unknown as { files: Record<string, PolicyFile> }).files;

export function getPolicyFile(checksum: string): PolicyFile | undefined {
  return policyFiles[checksum];
}

// A place in a policy file where an entry is defined or used.
export interface PolicyRef {
  checksum: string;
  line: number;
  // The bundle or body the definition or call is in, for variables,
  // classes and calls.
  block?: PolicyBlockRef;
  // For calls: what is called.
  kind?: CallKind;
  // Extra words: a variable's type, a bundle's parameters, the attribute
  // a function call is the value of.
  detail?: string;
}

// Something defined or called inside a block or file, for Contents tabs.
export interface PolicyContent {
  entry: EntryRef;
  checksum: string;
  line: number;
  // The bundle or body the item is in, for a file's variables, classes
  // and calls.
  block?: PolicyBlockRef;
}

// The Contents tabs of a file or block: its blocks (a file only), calls
// (of functions, bundles and bodies), variables and classes.
export type ContentGroup = "blocks" | "calls" | "variables" | "classes";
export const CONTENT_GROUPS: ContentGroup[] = ["blocks", "calls", "variables", "classes"];
const GROUP_OF_TYPE: Partial<Record<EntryType, ContentGroup>> = {
  bundle: "blocks",
  body: "blocks",
  "custom-promise-type": "blocks",
  call: "calls",
  "function-call": "calls",
  variable: "variables",
  class: "classes",
};

// Link to a line of a file: the file page with a #L<n> anchor.
export function fileLineHref(checksum: string, line: number): string {
  return `${entryHref({ type: "file", name: checksum })}#L${line}`;
}

export type Role = "Hub" | "Client";
export const ROLE_HUB: Role = "Hub";
export const ROLE_CLIENT: Role = "Client";

export interface UserDetails {
  home: string | null;
  shell: string | null;
  groups: string[];
  // ISO 8601 timestamps, or null if never.
  "last-login": string | null;
  "last-failed-login": string | null;
}

// A user's details gathered across the hosts that have the user: distinct
// homes, shells and groups, and the most recent logins with their host.
export interface UserSummary {
  homes: string[];
  shells: string[];
  groups: string[];
  lastLogin?: { time: string; hostkey: string };
  lastFailedLogin?: { time: string; hostkey: string };
}

export function summarizeUser(entry: Entry): UserSummary {
  const homes = new Set<string>();
  const shells = new Set<string>();
  const groups = new Set<string>();
  let lastLogin: UserSummary["lastLogin"];
  let lastFailedLogin: UserSummary["lastFailedLogin"];
  for (const hostkey of entry.hosts) {
    const details = hostsByKey.get(hostkey)?.["user-details"]?.[entry.name];
    if (!details) continue;
    if (details.home) homes.add(details.home);
    if (details.shell) shells.add(details.shell);
    for (const g of details.groups) groups.add(g);
    const login = details["last-login"];
    if (login && (!lastLogin || login > lastLogin.time)) lastLogin = { time: login, hostkey };
    const failed = details["last-failed-login"];
    if (failed && (!lastFailedLogin || failed > lastFailedLogin.time)) {
      lastFailedLogin = { time: failed, hostkey };
    }
  }
  return {
    homes: [...homes].sort(),
    shells: [...shells].sort(),
    groups: [...groups].sort(),
    lastLogin,
    lastFailedLogin,
  };
}

export interface Seen {
  first: string;
  last: string;
}

// When an entry was first and last seen: a host's own timestamps, or for
// any other entry the earliest first-seen and latest last-seen of its
// hosts. Undefined for entries without hosts.
export function entrySeen(entry: Entry): Seen | undefined {
  let first: string | undefined;
  let last: string | undefined;
  for (const hostkey of entry.hosts) {
    const host = hostsByKey.get(hostkey);
    if (!host) continue;
    if (!first || host["first-seen"] < first) first = host["first-seen"];
    if (!last || host["last-seen"] > last) last = host["last-seen"];
  }
  return first && last ? { first, last } : undefined;
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
  | "software-version"
  // A cloud provider hosts run in (AWS, Azure, ...).
  | "cloud"
  // A running systemd service, e.g. "sshd".
  | "service"
  // A host's CFEngine role: "Hub" or "Client".
  | "role"
  // A CFEngine variable, e.g. "sys.arch", defined on every host.
  | "variable"
  // One value of a variable, named "<variable>=<value>", e.g. "sys.arch=x86_64".
  | "value"
  // A file, identified by the SHA-256 checksum of its content (the name).
  | "file"
  // An absolute path a file is found at, e.g. "/var/cfengine/inputs/promises.cf".
  | "path"
  // The last component of a path, e.g. "promises.cf".
  | "filename"
  // Things defined in CFEngine policy files (data/policy.json): a bundle
  // or body named "<keyword> <type> <name>" ("bundle agent main"), a custom promise type
  // defined with a `promise agent` block, and something called from the
  // policy: a built-in function ("function-call") or a bundle or body
  // ("call"). Variables promised in a vars: section ("def.domain") and
  // classes promised in a classes: section are "variable" and "class"
  // entries, like the ones hosts report.
  | "bundle"
  | "body"
  | "custom-promise-type"
  | "call"
  | "function-call"
  // A built-in CFEngine function (data/functions.json), whether the
  // policy calls it or not.
  | "function";

export const POLICY_TYPES: EntryType[] = ["bundle", "body", "custom-promise-type", "call", "function-call", "function"];

// Names in the policy may carry the default namespace: "default:mog" is
// the body "mog".
export function stripNamespace(name: string): string {
  return name.replace(/^default:/, "");
}

export function isPolicyType(type: EntryType): boolean {
  return POLICY_TYPES.includes(type);
}

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

// Value entries are named "<variable>=<value>", e.g. "sys.arch=x86_64".
export function valueEntryName(variable: string, value: string): string {
  return `${variable}=${value}`;
}

export function parseValueEntryName(name: string): { variable: string; value: string } {
  const i = name.indexOf("=");
  return i < 0
    ? { variable: name, value: "" }
    : { variable: name.slice(0, i), value: name.slice(i + 1) };
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
const NAME_MATCH_TYPES: EntryType[] = ["os", "software", "user", "group", "class", "port", "cloud", "service", "role"];

// Index the policy files: the entries each file gives rise to (to link
// them to the hosts having the file), where each entry is defined or
// called, and what each block and file contains. A call whose name is a
// built-in function is a function call; any other call is of a body when
// it is the value of an attribute (`perms => mog(...)`) and of a bundle
// otherwise (`usebundle => name(...)`, or a bare call).
function indexPolicy() {
  const entriesByFile = new Map<string, EntryRef[]>();
  const refs = new Map<string, PolicyRef[]>();
  const contents = new Map<string, PolicyContent[]>();
  const kindOf = (call: PolicyCall): CallKind =>
    call.attribute && call.attribute !== "usebundle" ? "body" : "bundle";
  for (const [checksum, file] of Object.entries(policyFiles)) {
    const own: EntryRef[] = [];
    const seen = new Set<string>();
    const add = (ref: EntryRef, line: number, extra: Omit<PolicyRef, "checksum" | "line"> = {}) => {
      const key = entryKey(ref.type, ref.name);
      if (!seen.has(key)) {
        seen.add(key);
        own.push(ref);
      }
      refs.set(key, [...(refs.get(key) ?? []), { checksum, line, ...extra }]);
    };
    const contain = (holder: EntryRef, entry: EntryRef, line: number, block?: PolicyBlockRef) => {
      const key = entryKey(holder.type, holder.name);
      contents.set(key, [...(contents.get(key) ?? []), { entry, checksum, line, block }]);
    };
    const fileRef: EntryRef = { type: "file", name: checksum };
    // Something inside a block is a content of the block and of the file.
    const containInBlock = (block: PolicyBlockRef, entry: EntryRef, line: number) => {
      contain(block, entry, line);
      contain(fileRef, entry, line, block);
    };
    for (const b of file.bundles) {
      const ref: EntryRef = { type: "bundle", name: `bundle ${b.type} ${b.name}` };
      add(ref, b.line, b.parameters ? { detail: `parameters ${b.parameters.join(", ")}` } : {});
      contain(fileRef, ref, b.line);
    }
    for (const b of file.bodies) {
      const ref: EntryRef = { type: "body", name: `body ${b.type} ${b.name}` };
      add(ref, b.line, b.parameters ? { detail: `parameters ${b.parameters.join(", ")}` } : {});
      contain(fileRef, ref, b.line);
    }
    for (const p of file["promise-types"]) {
      const ref: EntryRef = { type: "custom-promise-type", name: p.name };
      add(ref, p.line);
      contain(fileRef, ref, p.line);
    }
    for (const v of file.vars) {
      const bundle = v.block.name.split(" ").pop() ?? v.block.name;
      const ref: EntryRef = { type: "variable", name: `${bundle}.${v.name}` };
      add(ref, v.line, { block: v.block, detail: v.type });
      containInBlock(v.block, ref, v.line);
    }
    for (const c of file.classes) {
      const ref: EntryRef = { type: "class", name: c.name };
      add(ref, c.line, { block: c.block });
      containInBlock(c.block, ref, c.line);
    }
    for (const call of file.calls) {
      const name = stripNamespace(call.name);
      const detail = call.attribute && `${call.attribute} =>`;
      if (builtinFunctions[name]) {
        // A function call, and a reference of the function itself.
        const ref: EntryRef = { type: "function-call", name };
        add(ref, call.line, { block: call.block, detail });
        add({ type: "function", name }, call.line, { block: call.block, detail });
        containInBlock(call.block, ref, call.line);
      } else {
        const ref: EntryRef = { type: "call", name };
        add(ref, call.line, { block: call.block, kind: kindOf(call), detail });
        containInBlock(call.block, ref, call.line);
      }
    }
    entriesByFile.set(checksum, own);
  }
  return { entriesByFile, refs, contents };
}

const policy = indexPolicy();

// What the calls of a name refer to: the kinds seen across its calls, most
// common first (`mog` is only ever a body; a name used both as a bundle
// and as a body lists both).
export function callKinds(name: string): CallKind[] {
  const counts = new Map<CallKind, number>();
  for (const ref of policy.refs.get(entryKey("call", name)) ?? []) {
    if (ref.kind) counts.set(ref.kind, (counts.get(ref.kind) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([kind]) => kind);
}

// The bundles and bodies a call may refer to, as entries.
export function calledBlocks(name: string): EntryRef[] {
  const found: EntryRef[] = [];
  for (const { type, name: entryName } of entries.values()) {
    if ((type === "bundle" || type === "body") && entryName.split(" ").pop() === name) {
      found.push({ type, name: entryName });
    }
  }
  return found.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

// Where an entry is defined (bundles, bodies, promise types, variables,
// classes) or called (functions): by file, then line.
export function getPolicyRefs(entry: EntryRef): PolicyRef[] {
  return [...(policy.refs.get(entryKey(entry.type, entry.name)) ?? [])].sort(
    (a, b) => a.checksum.localeCompare(b.checksum) || a.line - b.line,
  );
}

// What a block (bundle, body, promise type) or a policy file contains:
// definitions and calls, by file, then line.
export function getPolicyContents(entry: EntryRef): PolicyContent[] {
  return [...(policy.contents.get(entryKey(entry.type, entry.name)) ?? [])].sort(
    (a, b) => a.checksum.localeCompare(b.checksum) || a.line - b.line,
  );
}

// The contents of a file or block split into the Contents tabs.
export function getPolicyContentsByGroup(entry: EntryRef): Record<ContentGroup, PolicyContent[]> {
  const groups: Record<ContentGroup, PolicyContent[]> = { blocks: [], calls: [], variables: [], classes: [] };
  for (const item of getPolicyContents(entry)) {
    const group = GROUP_OF_TYPE[item.entry.type];
    if (group) groups[group].push(item);
  }
  return groups;
}

function buildIndex() {
  const hostsByKey = new Map<string, Host>();
  const entries = new Map<string, { type: EntryType; name: string; hosts: Set<string> }>();
  const groupsByHost = new Map<string, string[]>();
  // Files: the paths each filename is found at, and the names of each file.
  const pathsByFilename = new Map<string, Set<string>>();
  const namesByFile = new Map<string, Set<string>>();

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

  // Groups exist as entries even if no host currently matches them, and
  // every built-in function whether the policy calls it or not.
  for (const group of groups) ensure("group", group.name);
  for (const name of Object.keys(builtinFunctions)) ensure("function", name);

  for (const host of hosts) {
    hostsByKey.set(host.id, host);
    link("host", host.id, host.id);
    link("hostname", host.hostname, host.id);
    link("os", host.os, host.id);
    for (const ip of host.ips) link("ip", ip, host.id);
    for (const mac of host.macs) link("mac", mac, host.id);
    for (const port of host["ports-listening"]) link("port", String(port), host.id);
    for (const svc of host.services ?? []) link("service", svc, host.id);
    for (const sw of host.software) {
      link("software", sw, host.id);
      const version = host["software-versions"]?.[sw];
      if (version) link("software-version", versionEntryName(sw, version), host.id);
    }
    for (const user of host["local-users"]) link("user", user, host.id);
    for (const cls of host.classes ?? []) link("class", cls, host.id);
    if (host["cloud-provider"]) link("cloud", host["cloud-provider"], host.id);
    if (host.role) link("role", host.role, host.id);
    for (const [variable, value] of Object.entries(host.variables ?? {})) {
      link("variable", variable, host.id);
      link("value", valueEntryName(variable, value), host.id);
    }
    for (const [path, checksum] of Object.entries(host.files ?? {})) {
      const filename = fileNameOf(path);
      link("path", path, host.id);
      link("file", checksum, host.id);
      link("filename", filename, host.id);
      // A host has everything its policy files define.
      for (const ref of policy.entriesByFile.get(checksum) ?? []) link(ref.type, ref.name, host.id);
      pathsByFilename.set(filename, (pathsByFilename.get(filename) ?? new Set()).add(path));
      namesByFile.set(checksum, (namesByFile.get(checksum) ?? new Set()).add(filename));
    }
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

  return { hostsByKey, entries, groupsByHost, byNormalizedName, pathsByFilename, namesByFile };
}

const { hostsByKey, entries, groupsByHost, byNormalizedName, pathsByFilename, namesByFile } =
  buildIndex();

// The distinct filenames a file (checksum) is found under, sorted.
export function fileNames(checksum: string): string[] {
  return [...(namesByFile.get(checksum) ?? [])].sort();
}

export interface PathCount {
  path: string;
  // Number of the given hosts having a file at this path.
  hosts: number;
}

export interface FileCount {
  checksum: string;
  // Number of the given hosts having this file.
  hosts: number;
}

function countPaths(hostkeys: string[], wanted: (path: string, checksum: string) => boolean): PathCount[] {
  const counts = new Map<string, number>();
  for (const hostkey of hostkeys) {
    for (const [path, checksum] of Object.entries(hostsByKey.get(hostkey)?.files ?? {})) {
      if (wanted(path, checksum)) counts.set(path, (counts.get(path) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([path, hosts]) => ({ path, hosts }))
    .sort((a, b) => b.hosts - a.hosts || a.path.localeCompare(b.path));
}

function countFiles(hostkeys: string[], wanted: (path: string, checksum: string) => boolean): FileCount[] {
  const counts = new Map<string, number>();
  for (const hostkey of hostkeys) {
    for (const [path, checksum] of Object.entries(hostsByKey.get(hostkey)?.files ?? {})) {
      if (wanted(path, checksum)) counts.set(checksum, (counts.get(checksum) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([checksum, hosts]) => ({ checksum, hosts }))
    .sort((a, b) => b.hosts - a.hosts || a.checksum.localeCompare(b.checksum));
}

// The paths a file (checksum) is found at across the given hosts, most
// hosts first.
export function aggregatePathsOfFile(checksum: string, hostkeys: string[]): PathCount[] {
  return countPaths(hostkeys, (_, c) => c === checksum);
}

// The paths with a given filename across the given hosts, most hosts first.
export function aggregatePathsOfFilename(filename: string, hostkeys: string[]): PathCount[] {
  const candidates = pathsByFilename.get(filename);
  if (!candidates) return [];
  return countPaths(hostkeys, (p) => candidates.has(p));
}

// The files (checksums) found at a path across the given hosts, most hosts
// first: more than one means the file differs between hosts.
export function aggregateFilesAtPath(path: string, hostkeys: string[]): FileCount[] {
  return countFiles(hostkeys, (p) => p === path);
}

// The files (checksums) with a given filename across the given hosts.
export function aggregateFilesOfFilename(filename: string, hostkeys: string[]): FileCount[] {
  const candidates = pathsByFilename.get(filename);
  if (!candidates) return [];
  return countFiles(hostkeys, (p) => candidates.has(p));
}

export function getEntry(type: EntryType, name: string): Entry | undefined {
  const entry = entries.get(entryKey(type, name));
  if (!entry) return undefined;
  return { type: entry.type, name: entry.name, hosts: [...entry.hosts].sort() };
}

export function getHost(hostkey: string): Host | undefined {
  return hostsByKey.get(hostkey);
}

// The hub a host reports to: the host whose addresses include the IP in
// the host's `hub` field. Undefined if no host has that address. A hub is
// its own hub.
export function getHubOf(host: Host): Host | undefined {
  const entry = entries.get(entryKey("ip", host.hub));
  if (!entry) return undefined;
  for (const key of entry.hosts) {
    const candidate = hostsByKey.get(key);
    if (candidate?.role === ROLE_HUB) return candidate;
  }
  return undefined;
}

// The clients reporting to a hub: hosts with the Client role whose `hub`
// field is one of the hub's IP addresses, sorted by hostname.
export function getClientsOfHub(hub: Host): Host[] {
  const addresses = new Set(hub.ips);
  return hosts
    .filter((h) => h.role === ROLE_CLIENT && addresses.has(h.hub))
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
}

// The search URL for the clients of a hub: hosts with the Client role
// whose hub is the given IP address.
export function clientsSearchHref(hubIp: string): string {
  return `/search?q=${encodeURIComponent(`role:${ROLE_CLIENT} hub:${hubIp}`)}`;
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

export interface CloudCount {
  // Cloud provider name, or "" for hosts in your own data center.
  cloud: string;
  hosts: number;
}

// Aggregate the cloud providers of a set of hosts, most hosts first; hosts
// without a provider are counted under "".
export function aggregateClouds(hostkeys: string[]): CloudCount[] {
  const counts = new Map<string, number>();
  for (const hostkey of hostkeys) {
    const host = hostsByKey.get(hostkey);
    if (!host) continue;
    const cloud = host["cloud-provider"] ?? "";
    counts.set(cloud, (counts.get(cloud) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([cloud, hosts]) => ({ cloud, hosts }))
    .sort((a, b) => b.hosts - a.hosts || a.cloud.localeCompare(b.cloud));
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

export interface ValueCount {
  value: string;
  // Number of the given hosts on which the variable has this value.
  hosts: number;
}

// The values of a variable across the given hosts, most hosts first; ties
// are broken by value, numerically where values are numbers.
export function aggregateValues(variable: string, hostkeys: string[]): ValueCount[] {
  const counts = new Map<string, number>();
  for (const hostkey of hostkeys) {
    const value = hostsByKey.get(hostkey)?.variables?.[variable];
    if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const collator = new Intl.Collator(undefined, { numeric: true });
  return [...counts.entries()]
    .map(([value, hosts]) => ({ value, hosts }))
    .sort((a, b) => b.hosts - a.hosts || collator.compare(a.value, b.value));
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

// If a hostname belongs to exactly one host, return that host's key. Used
// to leave such hostnames out of search results, where the host itself is
// found by its hostname.
export function uniqueHostForHostname(hostname: string): string | undefined {
  const entry = entries.get(entryKey("hostname", hostname));
  if (entry && entry.hosts.size === 1) return [...entry.hosts][0];
  return undefined;
}

export function entryHref(ref: EntryRef): string {
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
  "software-version",
  "cloud",
  "service",
  "role",
  "variable",
  "value",
  "file",
  "path",
  "filename",
  "bundle",
  "body",
  "custom-promise-type",
  "call",
  "function-call",
  "function",
];

// Plural, human readable names of the entry types, for buttons and summaries.
export const TYPE_LABELS: Record<EntryType, string> = {
  host: "Hosts",
  hostname: "Hostnames",
  os: "Operating systems",
  ip: "IP addresses",
  mac: "MAC addresses",
  port: "Ports",
  software: "Software",
  user: "Users",
  group: "Groups",
  class: "Classes",
  "software-version": "Software versions",
  cloud: "Clouds",
  service: "Services",
  role: "Roles",
  variable: "Variables",
  value: "Values",
  file: "Files",
  path: "Paths",
  filename: "Filenames",
  bundle: "Bundles",
  body: "Bodies",
  "custom-promise-type": "Custom promise types",
  call: "Calls",
  "function-call": "Function calls",
  function: "Functions",
};

// What to show for an entry in lists and links: its name, except for files
// whose checksum is abbreviated (the full checksum is the page title).
export function entryLabel(ref: EntryRef): string {
  return ref.type === "file" ? abbreviateChecksum(ref.name) : ref.name;
}

// All entries of one type, sorted by name (numerically where names are
// numbers, e.g. ports; hosts by hostname).
export function entriesOfType(type: EntryType): Entry[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const sortKey = (e: Entry) =>
    type === "host" ? (hostsByKey.get(e.name)?.hostname ?? e.name) : e.name;
  return [...entries.values()]
    .filter((e) => e.type === type)
    .map((e) => ({ type: e.type, name: e.name, hosts: [...e.hosts].sort() }))
    .sort((a, b) => collator.compare(sortKey(a), sortKey(b)));
}

// Length of the common case-insensitive prefix of two names.
function commonPrefixLength(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return i;
}

export const SIMILAR_MIN_PREFIX = 3;

export interface SimilarEntry {
  entry: Entry;
  // How many leading characters the names share.
  common: number;
}

// How many leading characters two names of the same type have in common,
// or -1 if they are not similar. Names are similar when they start with the
// same 3 or more characters. Values ("sys.flavor=ubuntu_24") must also be
// of the same variable: the whole variable name and the "=" have to match,
// and then the first 3 characters of the value.
function similarity(type: EntryType, a: string, b: string): number {
  // Checksums sharing a prefix have nothing in common.
  if (type === "file") return -1;
  if (type === "value") {
    const x = parseValueEntryName(a);
    const y = parseValueEntryName(b);
    if (x.variable !== y.variable) return -1;
    const common = commonPrefixLength(x.value, y.value);
    return common < SIMILAR_MIN_PREFIX ? -1 : x.variable.length + 1 + common;
  }
  const common = commonPrefixLength(a, b);
  return common < SIMILAR_MIN_PREFIX ? -1 : common;
}

// Entries of the same type whose names start with the same 3 or more
// characters (for values: the same variable and the first 3 characters of
// the value), longest match first.
export function similarEntries(entry: EntryRef): SimilarEntry[] {
  const found: SimilarEntry[] = [];
  for (const other of entries.values()) {
    if (other.type !== entry.type || other.name === entry.name) continue;
    const common = similarity(entry.type, entry.name, other.name);
    if (common < 0) continue;
    found.push({
      entry: { type: other.type, name: other.name, hosts: [...other.hosts].sort() },
      common,
    });
  }
  return found.sort((a, b) => b.common - a.common || a.entry.name.localeCompare(b.entry.name));
}

export function countOfType(type: EntryType): number {
  let n = 0;
  for (const e of entries.values()) if (e.type === type) n++;
  return n;
}

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
  "cloud-providers": Record<string, DescribedInfo>;
  services: Record<string, ServiceInfo>;
  // The CFEngine roles, "Hub" and "Client".
  roles: Record<string, DescribedInfo>;
  // CFEngine special variables such as "sys.arch".
  variables: Record<string, DescribedInfo>;
  // Well-known filenames such as "promises.cf" or "sshd_config".
  filenames: Record<string, DescribedInfo>;
  // CFEngine built-in functions such as "ifelse".
  functions: Record<string, DescribedInfo>;
}

export interface ServiceInfo extends DescribedInfo {
  // The software this service belongs to, e.g. "openssh" for sshd.
  software?: string;
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

export function getServiceInfo(name: string): ServiceInfo | undefined {
  return info.services[name];
}

export function getCloudProviderInfo(name: string): DescribedInfo | undefined {
  return info["cloud-providers"][name];
}

export function getRoleInfo(name: string): DescribedInfo | undefined {
  return info.roles[name];
}

export function getVariableInfo(name: string): DescribedInfo | undefined {
  return info.variables[name];
}

export function getClassInfo(name: string): DescribedInfo | undefined {
  return info.classes[name];
}

export function getFilenameInfo(name: string): DescribedInfo | undefined {
  return info.filenames[name];
}

export function getFunctionInfo(name: string): DescribedInfo | undefined {
  return info.functions[name];
}

// Every built-in function has a page in the CFEngine reference.
export function functionDocsLink(name: string): ExternalLink {
  return {
    title: `Function ${name}`,
    source: "docs.cfengine.com",
    url: `https://docs.cfengine.com/docs/master/reference-functions-${name}.html`,
  };
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
  if (entry.type === "software-version" || entry.type === "value") return [];
  if (entry.type === "function" || entry.type === "function-call") {
    return getFunctionInfo(entry.name)?.links ?? [functionDocsLink(entry.name)];
  }
  // Bundles and bodies have no reference page.
  if (entry.type === "call") return [];
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
    case "cloud":
      return getCloudProviderInfo(entry.name);
    case "service":
      return getServiceInfo(entry.name);
    case "role":
      return getRoleInfo(entry.name);
    case "variable":
      return getVariableInfo(entry.name);
    case "value":
      // Values share the variable's logo (they have no links of their own).
      return getVariableInfo(parseValueEntryName(entry.name).variable);
    case "software-version":
      // Versions share the software's description, links and logo.
      return getSoftwareInfo(parseVersionEntryName(entry.name).software);
    case "filename":
      return getFilenameInfo(entry.name);
    case "path":
      // Paths and files share the information about their filename.
      return getFilenameInfo(fileNameOf(entry.name));
    case "file":
      return fileNames(entry.name).map(getFilenameInfo).find((i) => i !== undefined);
    case "function-call":
    case "function":
      return getFunctionInfo(entry.name);
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
  if (entry.type === "software-version") {
    related.push({ type: "software", name: parseVersionEntryName(entry.name).software });
  } else if (entry.type === "value") {
    related.push({ type: "variable", name: parseValueEntryName(entry.name).variable });
  } else if (entry.type === "service") {
    const software = getServiceInfo(entry.name)?.software;
    if (software) related.push({ type: "software", name: software });
  } else if (entry.type === "software") {
    for (const [name, svc] of Object.entries(info.services)) {
      if (svc.software === entry.name) related.push({ type: "service", name });
    }
    for (const port of getSoftwareInfo(entry.name)?.ports ?? []) {
      related.push({ type: "port", name: String(port) });
    }
  } else if (entry.type === "port") {
    const port = Number(entry.name);
    for (const [name, sw] of Object.entries(info.software)) {
      if (sw.ports?.includes(port)) related.push({ type: "software", name });
    }
  } else if (entry.type === "path") {
    related.push({ type: "filename", name: fileNameOf(entry.name) });
  } else if (entry.type === "file") {
    for (const name of fileNames(entry.name)) related.push({ type: "filename", name });
  } else if (entry.type === "call") {
    // The bundle(s) or body(ies) the name refers to.
    related.push(...calledBlocks(entry.name));
  } else if (entry.type === "function-call") {
    related.push({ type: "function", name: entry.name });
  } else if (entry.type === "function") {
    // The calls of the function, if the policy calls it.
    related.push({ type: "function-call", name: entry.name });
  } else if (entry.type === "variable" || entry.type === "class") {
    // The bundle(s) defining the variable or class in the policy, if any.
    for (const ref of getPolicyRefs(entry)) {
      if (ref.block && !related.some((r) => r.type === ref.block!.type && r.name === ref.block!.name)) {
        related.push({ type: ref.block.type, name: ref.block.name });
      }
    }
  } else if (entry.type === "role") {
    // The two roles point at each other; both run CFEngine, and hubs are
    // also marked by the policy server classes.
    related.push({ type: "role", name: entry.name === ROLE_HUB ? ROLE_CLIENT : ROLE_HUB });
    related.push({ type: "software", name: "cfengine" });
    if (entry.name === ROLE_HUB) {
      related.push({ type: "class", name: "policy_server" }, { type: "class", name: "am_policy_hub" });
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
export const NO_CLOUD_INFO = "No information available about this cloud provider.";
export const NO_SERVICE_INFO = "No information available about this service.";
export const NO_ROLE_INFO = "No information available about this role.";
export const NO_VARIABLE_INFO = "No information available about this variable.";
export const NO_FILENAME_INFO = "No information available about files with this name.";
export const NO_FUNCTION_INFO = "A function called from the CFEngine policy.";

// "A built-in CFEngine function in the data category that returns a
// string." from data/functions.json; deprecated functions say so.
function describeFunction(name: string): string {
  const fn = builtinFunctions[name];
  if (!fn) return TYPE_DESCRIPTIONS.function;
  const returns = RETURN_WORDS[fn.returnType] ?? fn.returnType;
  const deprecated = fn.status === "deprecated" ? " It is deprecated." : "";
  return `A built-in CFEngine function in the ${fn.category} category that returns ${returns}.${deprecated}`;
}

// What a call refers to: the bundle(s) or body(ies) of that name.
function describeCall(name: string): string {
  const blocks = calledBlocks(name);
  const kinds = callKinds(name);
  const bundles = blocks.filter((b) => b.type === "bundle").map((b) => b.name);
  const bodies = blocks.filter((b) => b.type === "body").map((b) => b.name);
  const parts: string[] = [];
  // A bundle or body not defined in the policy (a dynamic name like
  // `$(handlers)`, or one from elsewhere) is still a bundle or body call.
  if (kinds.includes("bundle")) parts.push(bundles.length > 0 ? `the ${bundles.join(" or the ")}` : "a bundle");
  if (kinds.includes("body")) parts.push(bodies.length > 0 ? `the ${bodies.join(" or the ")}` : "a body");
  if (parts.length === 0) parts.push("a bundle or body");
  const what = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
  return `Calls of ${what} from the CFEngine policy.`;
}

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
  "software-version": "A specific version of a piece of software.",
  cloud: "A cloud provider that hosts run in.",
  service: "A systemd service running on hosts.",
  role: "A host's CFEngine role: a hub the clients report to, or a client.",
  variable: "A CFEngine variable defined on hosts.",
  value: "The value a CFEngine variable has on some hosts.",
  file: "A file, identified by the SHA-256 checksum of its content.",
  path: "The absolute path of a file on a host.",
  filename: "The name of a file, without its directory.",
  bundle: "A bundle defined in the CFEngine policy.",
  body: "A body defined in the CFEngine policy.",
  "custom-promise-type": "A custom promise type defined in the CFEngine policy with a promise agent block.",
  call: "A bundle or body called from the CFEngine policy.",
  "function-call": "A built-in CFEngine function called from the CFEngine policy.",
  function: "A built-in CFEngine function.",
};

// "promises.cf and update.cf": the distinct names of the files an entry
// is defined in, from its references.
function refFileNames(entry: EntryRef): string {
  const names = [...new Set(getPolicyRefs(entry).flatMap((r) => fileNames(r.checksum)))].sort();
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function describePolicyEntry(entry: EntryRef): string {
  const files = refFileNames(entry);
  const where = files ? ` in ${files}` : "";
  switch (entry.type) {
    case "bundle": {
      const params = getPolicyRefs(entry).find((r) => r.detail)?.detail;
      return `The ${entry.name}${params ? ` with ${params}` : ""}, defined${where}.`;
    }
    case "body":
      return `The ${entry.name}, defined${where}.`;
    case "custom-promise-type":
      return `The custom promise type ${entry.name}, defined with a promise agent block${where}.`;
    case "variable": {
      const refs = getPolicyRefs(entry);
      const type = refs.find((r) => r.detail)?.detail;
      const bundle = refs[0]?.block?.name;
      return `The ${type ? `${type} ` : ""}variable ${entry.name}${bundle ? ` of ${bundle}` : ""}, defined${where}.`;
    }
    case "class": {
      const bundles = [...new Set(getPolicyRefs(entry).map((r) => r.block?.name).filter(Boolean))].sort();
      const inBundles = bundles.length > 0 ? ` by ${bundles.join(" and ")}` : "";
      return `The class ${entry.name}, defined${inBundles}${where}.`;
    }
    default:
      return TYPE_DESCRIPTIONS[entry.type];
  }
}

// "The file promises.cf (3.2 kB), identified by its SHA-256 checksum." or,
// for a binary, that only the checksum is known.
function describeFile(checksum: string): string {
  const names = fileNames(checksum);
  const content = getFileContent(checksum);
  const named = names.length > 0 ? ` ${names.join(" or ")}` : "";
  const size = content ? ` (${formatBytes(content.size)})` : "";
  if (content && content.content === null) {
    return `The binary file${named}${size}. Its content is not available, only its checksum.`;
  }
  return `The file${named}${size}, identified by its SHA-256 checksum.`;
}

export function describeEntry(entry: EntryRef): string {
  if (entry.type === "port") {
    const known = getPortInfo(entry.name);
    if (known) return known.description;
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
    // Described in info.json, or by where the policy defines it.
    const known = getClassInfo(entry.name)?.description;
    if (known) return known;
    return getPolicyRefs(entry).length > 0 ? describePolicyEntry(entry) : NO_CLASS_INFO;
  }
  if (entry.type === "cloud") {
    return getCloudProviderInfo(entry.name)?.description ?? NO_CLOUD_INFO;
  }
  if (entry.type === "service") {
    return getServiceInfo(entry.name)?.description ?? NO_SERVICE_INFO;
  }
  if (entry.type === "role") {
    return getRoleInfo(entry.name)?.description ?? NO_ROLE_INFO;
  }
  if (entry.type === "variable") {
    const known = getVariableInfo(entry.name)?.description;
    if (known) return known;
    return getPolicyRefs(entry).length > 0 ? describePolicyEntry(entry) : NO_VARIABLE_INFO;
  }
  if (entry.type === "value") {
    const { variable, value } = parseValueEntryName(entry.name);
    return `The variable ${variable} has the value ${value}.`;
  }
  if (entry.type === "software-version") {
    const { software, version } = parseVersionEntryName(entry.name);
    return `Version ${version} of ${software}.`;
  }
  if (entry.type === "file") {
    return describeFile(entry.name);
  }
  if (entry.type === "filename") {
    return getFilenameInfo(entry.name)?.description ?? NO_FILENAME_INFO;
  }
  if (entry.type === "path") {
    const known = getFilenameInfo(fileNameOf(entry.name));
    if (known) return known.description;
  }
  if (entry.type === "call") {
    return describeCall(entry.name);
  }
  if (entry.type === "function") {
    return getFunctionInfo(entry.name)?.description ?? describeFunction(entry.name);
  }
  if (entry.type === "function-call") {
    return `Calls of the built-in function ${entry.name} from the CFEngine policy.`;
  }
  if (isPolicyType(entry.type)) {
    return describePolicyEntry(entry);
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
  // External resources: their label ("openssh.com") and full address.
  for (const link of getEntryLinks(entry)) {
    if (
      link.url.toLowerCase().includes(q) ||
      externalLinkLabel(link).toLowerCase().includes(q) ||
      link.title.toLowerCase().includes(q)
    ) {
      return 4;
    }
  }
  return -1;
}

// Search "anything": entry names, hostnames, host keys, port names, the
// descriptions of entries and their external resources (titles and
// addresses). Case-insensitive substring matching.
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

// " It is defined in the policy 3 times in 2 policy files, on 100 hosts."
// for a variable or class the policy defines; "" otherwise.
function policySummary(entry: EntryRef): string {
  const refs = getPolicyRefs(entry);
  if (refs.length === 0) return "";
  const files = new Set(refs.map((r) => r.checksum));
  const onHosts = new Set<string>();
  for (const checksum of files) {
    for (const k of entries.get(entryKey("file", checksum))?.hosts ?? []) onHosts.add(k);
  }
  return ` It is defined in the policy ${refs.length === 1 ? "once" : `${refs.length} times`} in ${plural(files.size, "policy file")}, on ${plural(onHosts.size, "host")}.`;
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
    case "software-version":
      // Version pages are kept short: the software page has the numbers.
      return "";
    case "variable": {
      // The hosts reporting the variable; the rest have it in their policy.
      const reporting = entry.hosts.filter((k) => hostsByKey.get(k)?.variables?.[entry.name] !== undefined);
      const values = aggregateValues(entry.name, entry.hosts).length;
      const reported =
        reporting.length > 0
          ? `${entry.name} is defined on ${plural(reporting.length, "host")} in your infrastructure, with ${plural(values, "different value")}.`
          : `${entry.name} is not reported by any host in your infrastructure.`;
      return reported + policySummary(entry);
    }
    case "value":
      return `${hosts} in your infrastructure ${n === 1 ? "has" : "have"} this value.`;
    case "service":
      return `${entry.name} is running on ${hosts} in your infrastructure, across ${oses()}.`;
    case "os":
      return `In your infrastructure, you have ${entry.name} installed on ${hosts}, and these hosts are listening to ${ports()}.`;
    case "port":
      return `Port ${entry.name} is open on ${hosts} in your infrastructure, across ${oses()}.`;
    case "user":
      return `The user ${entry.name} exists on ${hosts} in your infrastructure, across ${oses()}.`;
    case "group":
      return `This group has ${hosts} in your infrastructure, running ${oses()} and listening to ${ports()}.`;
    case "class": {
      // The hosts with the class set; the rest define it in their policy.
      const set = entry.hosts.filter((k) => hostsByKey.get(k)?.classes.includes(entry.name));
      const reported =
        set.length > 0
          ? `This class is set on ${plural(set.length, "host")} in your infrastructure, running ${plural(aggregateOs(set).length, "operating system")} and listening to ${plural(aggregatePorts(set).length, "different port")}.`
          : "This class is not set on any host in your infrastructure.";
      return reported + policySummary(entry);
    }
    case "cloud":
      return `${hosts} in your infrastructure ${n === 1 ? "runs" : "run"} in ${entry.name}, across ${oses()}.`;
    case "role": {
      const role = entry.name.toLowerCase();
      return `${hosts} in your infrastructure ${n === 1 ? `is a CFEngine ${role}` : `are CFEngine ${role}s`}, across ${oses()}.`;
    }
    case "ip":
      return `This IP address is used by ${hosts} in your infrastructure.`;
    case "mac":
      return `This MAC address belongs to ${hosts} in your infrastructure.`;
    case "hostname":
      return `${hosts} in your infrastructure ${n === 1 ? "has" : "share"} this hostname.`;
    case "file":
      return `This file is found on ${hosts} in your infrastructure, at ${plural(aggregatePathsOfFile(entry.name, entry.hosts).length, "different path")}.`;
    case "path":
      return `This path exists on ${hosts} in your infrastructure, with ${plural(aggregateFilesAtPath(entry.name, entry.hosts).length, "different file")} (${n === 1 || aggregateFilesAtPath(entry.name, entry.hosts).length === 1 ? "checksum" : "checksums"}).`;
    case "filename":
      return `Files named ${entry.name} exist on ${hosts} in your infrastructure, at ${plural(aggregatePathsOfFilename(entry.name, entry.hosts).length, "different path")}, with ${plural(aggregateFilesOfFilename(entry.name, entry.hosts).length, "different checksum")}.`;
    case "bundle":
    case "body":
    case "custom-promise-type": {
      const refs = getPolicyRefs(entry);
      const files = new Set(refs.map((r) => r.checksum)).size;
      return `Defined ${refs.length === 1 ? "once" : `${refs.length} times`} in ${plural(files, "policy file")}, on ${hosts} in your infrastructure.`;
    }
    case "call":
    case "function-call":
    case "function": {
      const refs = getPolicyRefs(entry);
      if (refs.length === 0) return `${entry.name} is not called from the policy on your hosts.`;
      const files = new Set(refs.map((r) => r.checksum)).size;
      const blocks = new Set(refs.map((r) => r.block?.name)).size;
      return `${entry.name} is called ${plural(refs.length, "time")} from ${plural(blocks, "bundle or body", "bundles and bodies")} in ${plural(files, "policy file")}, on ${hosts} in your infrastructure.`;
    }
    case "host": {
      const host = hostsByKey.get(entry.name);
      return host ? describeHost(host) : "";
    }
  }
}

// Structured search: a query can contain filters like `port:22` or
// `group:"production Linux"`. Filters of the same type are alternatives
// (`os:"Ubuntu 24" os:"Ubuntu 22"` is either OS); filters of different
// types all have to match. Any remaining free text narrows the hosts by
// hostname or host key.
export interface SearchFilter {
  type: EntryType;
  name: string;
}

// A numeric condition on a host resource: free disk or memory as a
// percentage of the total, e.g. `disk<42%`.
export type Metric = "disk" | "memory";
export type ConditionOp = "<" | "<=" | ">" | ">=";
export interface Condition {
  metric: Metric;
  op: ConditionOp;
  percent: number;
}

export interface ParsedQuery {
  filters: SearchFilter[];
  conditions: Condition[];
  // `hub:<ip>`: only hosts reporting to the hub with this IP address.
  hubs: string[];
  // `type:os`: list everything of one entry type, like the front page
  // buttons do; the first one wins.
  listType?: EntryType;
  text: string;
}

// Percentage of disk or memory that is free on a host, rounded.
export function freePercent(host: Host, metric: Metric): number {
  const ratio =
    metric === "disk"
      ? host.disk["free-gb"] / host.disk["total-gb"]
      : host.memory["free-mb"] / host.memory["total-mb"];
  return Math.round(ratio * 100);
}

function matchesCondition(host: Host, c: Condition): boolean {
  const value = freePercent(host, c.metric);
  switch (c.op) {
    case "<":
      return value < c.percent;
    case "<=":
      return value <= c.percent;
    case ">":
      return value > c.percent;
    case ">=":
      return value >= c.percent;
  }
}

// The search URL for hosts with less free disk or memory than `percent`.
export function conditionHref(metric: Metric, percent: number): string {
  return `/search?q=${encodeURIComponent(`${metric}<${percent}%`)}`;
}

const CONDITION = /^(disk|memory)(<=|>=|<|>)(\d{1,3})%?$/i;

export function parseSearchQuery(query: string): ParsedQuery {
  const filters: SearchFilter[] = [];
  const conditions: Condition[] = [];
  const hubs: string[] = [];
  const rest: string[] = [];
  let listType: EntryType | undefined;
  const token = /(\S+?):(?:"([^"]*)"|(\S+))|"([^"]*)"|(\S+)/g;
  for (const m of query.matchAll(token)) {
    const [, type, quoted, bare, quotedText, word] = m;
    const value = quoted ?? bare ?? "";
    const condition = CONDITION.exec(m[0]);
    if (condition) {
      conditions.push({
        metric: condition[1].toLowerCase() as Metric,
        op: condition[2] as ConditionOp,
        percent: Number(condition[3]),
      });
    } else if (type !== undefined && isEntryType(type)) {
      filters.push({ type, name: value });
    } else if (type?.toLowerCase() === "hub") {
      hubs.push(value);
    } else if (type?.toLowerCase() === "type" && isEntryType(value.toLowerCase())) {
      listType ??= value.toLowerCase() as EntryType;
    } else {
      rest.push(m[0].startsWith('"') ? (quotedText ?? "") : (word ?? m[0]));
    }
  }
  return { filters, conditions, hubs, listType, text: rest.join(" ").trim() };
}

// Filters grouped by type, in the order the types first appear, so that
// `os:"Ubuntu 24" port:443 os:"Ubuntu 22"` gives [[os, os], [port]].
function filtersByType(filters: SearchFilter[]): SearchFilter[][] {
  const byType = new Map<EntryType, SearchFilter[]>();
  for (const f of filters) byType.set(f.type, [...(byType.get(f.type) ?? []), f]);
  return [...byType.values()];
}

function quoteFilterValue(name: string): string {
  return /[\s"]/.test(name) ? `"${name.replace(/"/g, "")}"` : name;
}

// The search URL for hosts matching all of the given filters.
export function filterSearchHref(filters: SearchFilter[]): string {
  const q = filters.map((f) => `${f.type}:${quoteFilterValue(f.name)}`).join(" ");
  return `/search?q=${encodeURIComponent(q)}`;
}

// Hosts matching the filters, sorted by hostname: any one of the filters
// of each type, and every type. Unknown filter values match nothing.
export function searchHosts(parsed: ParsedQuery): Host[] {
  let keys: Set<string> | undefined;
  for (const alternatives of filtersByType(parsed.filters)) {
    const found = new Set<string>();
    for (const filter of alternatives) {
      const entry = entries.get(entryKey(filter.type, filter.name));
      for (const k of entry?.hosts ?? []) found.add(k);
    }
    keys = keys ? new Set([...keys].filter((k) => found.has(k))) : found;
  }
  const text = parsed.text.toLowerCase();
  const hosts = [...(keys ?? hostsByKey.keys())]
    .map((k) => hostsByKey.get(k)!)
    .filter((h) => parsed.conditions.every((c) => matchesCondition(h, c)))
    .filter((h) => parsed.hubs.every((ip) => h.hub === ip))
    .filter(
      (h) =>
        !text ||
        h.hostname.toLowerCase().includes(text) ||
        h.id.toLowerCase().includes(text),
    );
  return hosts.sort((a, b) => a.hostname.localeCompare(b.hostname));
}

// "free disk below 42%" for a summary sentence.
export function describeCondition(c: Condition): string {
  const words: Record<ConditionOp, string> = { "<": "below", "<=": "at most", ">": "above", ">=": "at least" };
  return `free ${c.metric} ${words[c.op]} ${c.percent}%`;
}

// "port 22, group Windows" for a summary sentence; alternatives of one
// type read "os Ubuntu 24 or Ubuntu 22", hub filters "hub 18.130.49.157".
export function describeFilters(filters: SearchFilter[], hubs: string[] = []): string {
  return [
    ...filtersByType(filters).map(
      (group) => `${group[0].type} ${group.map((f) => f.name).join(" or ")}`,
    ),
    ...hubs.map((ip) => `hub ${ip}`),
  ].join(", ");
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
  const cloud = host["cloud-provider"];
  text += cloud ? `, running in ${cloud}.` : ", running in your own data center.";
  if (role) text += ` It looks like ${withArticle(role)}.`;
  return text;
}

// Example comments for the demo (data/comments.json), keyed by
// "<type>:<name>". Comments written in the app live in the browser's local
// storage under the same key; there is no backend.
export interface Comment {
  author: string;
  // ISO 8601 timestamp.
  time: string;
  text: string;
}

const comments = commentsJson as unknown as Record<string, Comment[] | string>;

export function commentKey(entry: EntryRef): string {
  return `${entry.type}:${entry.name}`;
}

export function getComments(entry: EntryRef): Comment[] {
  const list = comments[commentKey(entry)];
  return Array.isArray(list) ? list : [];
}
