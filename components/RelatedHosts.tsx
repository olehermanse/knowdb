import Link from "next/link";
import EntryLink from "@/components/EntryLink";
import Comments from "@/components/Comments";
import Pagination, { paginate } from "@/components/Pagination";
import { hostsLabel } from "@/components/PortsSection";
import { highlightCfengine, isCfengineFile, plainLines } from "@/lib/highlight";
import {
  describeEntry,
  fileNames,
  similarEntries,
  TYPE_LABELS,
  aggregateFilesAtPath,
  aggregateFilesOfFilename,
  aggregatePathsOfFile,
  aggregatePathsOfFilename,
  aggregateValues,
  aggregateVersions,
  Entry,
  entryHref,
  externalLinkLabel,
  FileCount,
  fileLineHref,
  formatBytes,
  getComments,
  getEntryLinks,
  getFileContent,
  getPolicyContents,
  getPolicyRefs,
  filterSearchHref,
  abbreviateChecksum,
  parseValueEntryName,
  PathCount,
  valueEntryName,
  versionEntryName,
} from "@/lib/data";

// The entry's own tabs, shown on the left of an entry page: versions (for
// software), values (for variables), content, paths and contents (for
// files), files (for paths), paths and files (for filenames), references
// and contents (for things defined in policy), similar entries, resources
// and comments. The hosts' ports are a tab on the right, with the hosts.
export type Tab =
  | "content"
  | "references"
  | "contents"
  | "versions"
  | "values"
  | "paths"
  | "files"
  | "similar"
  | "resources"
  | "comments";
const TAB_ORDER: Tab[] = [
  "content",
  "references",
  "contents",
  "versions",
  "values",
  "paths",
  "files",
  "similar",
  "resources",
  "comments",
];

export function parseTab(raw: string | string[] | undefined): Tab | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (TAB_ORDER as string[]).includes(value ?? "") ? (value as Tab) : undefined;
}

// Versions only for software, values only for variables hosts report, the
// file tabs for files, paths and filenames, and References for anything
// the policy defines or calls (bundles, bodies, promise types, calls, and
// the variables and classes promised in the policy).
export function entryTabs(entry: Entry): Tab[] {
  const tabs: Tab[] = [];
  if (entry.type === "software") tabs.push("versions");
  if (entry.type === "variable" && aggregateValues(entry.name, entry.hosts).length > 0) tabs.push("values");
  if (entry.type === "file") tabs.push("content", "paths");
  if (entry.type === "path") tabs.push("files");
  if (entry.type === "filename") tabs.push("paths", "files");
  if (getPolicyRefs(entry).length > 0) tabs.push("references");
  // Policy files and blocks list what they define; empty for other files.
  if (entry.type === "file" || entry.type === "bundle" || entry.type === "body" || entry.type === "promise-type") {
    if (getPolicyContents(entry).length > 0) tabs.push("contents");
  }
  tabs.push("similar", "resources", "comments");
  return tabs;
}

// The paths of a file or filename, and the files at a path or with a
// filename, across the entry's hosts.
function pathsOf(entry: Entry): PathCount[] {
  if (entry.type === "file") return aggregatePathsOfFile(entry.name, entry.hosts);
  if (entry.type === "filename") return aggregatePathsOfFilename(entry.name, entry.hosts);
  return [];
}
function filesOf(entry: Entry): FileCount[] {
  if (entry.type === "path") return aggregateFilesAtPath(entry.name, entry.hosts);
  if (entry.type === "filename") return aggregateFilesOfFilename(entry.name, entry.hosts);
  return [];
}

// Query parameters belonging to the other side of the page (e.g. the
// right pane's htab and page), kept as they are when following a link.
export type KeptQuery = Record<string, string | undefined>;

// Link to a tab (and a page of its list); the first tab and first page
// need no query parameters. The tab lists page with `tpage`, separate from
// the host list's `page` on the right, whose parameters are kept.
export function tabHref(entry: Entry, tabs: Tab[], tab: Tab, page = 1, keep: KeptQuery = {}): string {
  const params = new URLSearchParams();
  if (tab !== tabs[0]) params.set("tab", tab);
  if (page > 1) params.set("tpage", String(page));
  for (const [key, value] of Object.entries(keep)) if (value) params.set(key, value);
  const q = params.toString();
  return `${entryHref(entry)}${q ? `?${q}` : ""}`;
}

// Props shared by the paginated tab panels.
interface PanelProps {
  entry: Entry;
  tabs: Tab[];
  page: number;
  keep: KeptQuery;
}

function TabPagination({
  entry,
  tabs,
  tab,
  keep,
  total,
  shown,
  start,
  current,
  totalPages,
  noun,
}: PanelProps & {
  tab: Tab;
  total: number;
  shown: number;
  start: number;
  current: number;
  totalPages: number;
  noun: string;
}) {
  return (
    <Pagination
      total={total}
      shown={shown}
      start={start}
      current={current}
      totalPages={totalPages}
      noun={noun}
      hrefForPage={(n) => tabHref(entry, tabs, tab, n, keep)}
    />
  );
}

// Versions of a piece of software, one card per version, most hosts first.
function VersionsPanel({ entry, tabs, page, keep }: PanelProps) {
  const versions = aggregateVersions(entry.name, entry.hosts);
  const paged = paginate(versions, page);
  return (
    <>
      <p className="muted" data-testid="versions-description">
        Versions of {entry.name} in your infrastructure:
      </p>
      {versions.length === 0 && <p className="muted">None</p>}
      <ul className="entry-list" data-testid="versions">
        {paged.shown.map(({ version, hosts }) => {
          const name = versionEntryName(entry.name, version);
          const searchHref = filterSearchHref([{ type: "version", name }]);
          return (
            <li key={version} className="host-item" data-testid="version-item">
              <span className="type-badge">version</span>
              <div className="host-summary">
                <div>
                  <EntryLink type="version" name={name} />
                </div>
                <div className="muted host-facts">
                  <Link href={searchHref} className="entry-link" data-testid="version-hosts-link">
                    {hostsLabel(hosts)}
                  </Link>
                  <span>{describeEntry({ type: "version", name })}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <TabPagination
        entry={entry}
        tabs={tabs}
        keep={keep}
        tab="versions"
        page={page}
        total={versions.length}
        shown={paged.shown.length}
        start={paged.start}
        current={paged.current}
        totalPages={paged.totalPages}
        noun="versions"
      />
    </>
  );
}

// Values of a variable, one card per value, most hosts first.
function ValuesPanel({ entry, tabs, page, keep }: PanelProps) {
  const values = aggregateValues(entry.name, entry.hosts);
  const paged = paginate(values, page);
  return (
    <>
      <p className="muted" data-testid="values-description">
        Values of {entry.name} in your infrastructure:
      </p>
      {values.length === 0 && <p className="muted">None</p>}
      <ul className="entry-list" data-testid="values">
        {paged.shown.map(({ value, hosts }) => {
          const name = valueEntryName(entry.name, value);
          const searchHref = filterSearchHref([{ type: "value", name }]);
          return (
            <li key={value} className="host-item" data-testid="value-item">
              <span className="type-badge">value</span>
              <div className="host-summary">
                <div>
                  <EntryLink type="value" name={name} />
                </div>
                <div className="muted host-facts">
                  <Link href={searchHref} className="entry-link" data-testid="value-hosts-link">
                    {hostsLabel(hosts)}
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <TabPagination
        entry={entry}
        tabs={tabs}
        keep={keep}
        tab="values"
        page={page}
        total={values.length}
        shown={paged.shown.length}
        start={paged.start}
        current={paged.current}
        totalPages={paged.totalPages}
        noun="values"
      />
    </>
  );
}

// "promises.cf" with the checksum after it, linking to a line of the file.
function FileLineLink({ checksum, line }: { checksum: string; line: number }) {
  const names = fileNames(checksum);
  return (
    <>
      <Link href={fileLineHref(checksum, line)} className="entry-link" data-testid="file-line-link">
        {names.join(", ") || abbreviateChecksum(checksum)}:{line}
      </Link>{" "}
      <span className="muted host-id" title={checksum}>
        ({abbreviateChecksum(checksum)})
      </span>
    </>
  );
}

// Where a bundle, body, promise type, variable or class is defined, or a
// name called: one card per place, with the file and line and, for
// things inside a block, the bundle or body they are in.
function ReferencesPanel({ entry, tabs, page, keep }: PanelProps) {
  const refs = getPolicyRefs(entry);
  const paged = paginate(refs, page);
  const verb = entry.type === "call" || entry.type === "function" ? "called" : "defined";
  return (
    <>
      <p className="muted" data-testid="references-description">
        Where {entry.name} is {verb} in the policy:
      </p>
      {refs.length === 0 && <p className="muted">None</p>}
      <ul className="entry-list" data-testid="references">
        {paged.shown.map((ref, i) => (
          <li key={`${ref.checksum}:${ref.line}:${i}`} className="host-item" data-testid="reference-item">
            <span className="type-badge">file</span>
            <div className="host-summary">
              <div>
                <FileLineLink checksum={ref.checksum} line={ref.line} />
              </div>
              <div className="muted host-facts">
                <span>Line {ref.line}</span>
                {ref.block && (
                  <span data-testid="reference-block">
                    In {ref.block.type === "promise-type" ? "promise type " : ""}
                    <EntryLink type={ref.block.type} name={ref.block.name} />
                  </span>
                )}
                {ref.kind && ref.kind !== "function" && (
                  <span data-testid="reference-kind">{ref.kind === "bundle" ? "Bundle call" : "Body call"}</span>
                )}
                {ref.detail && <span data-testid="reference-detail">{ref.detail}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <TabPagination
        entry={entry}
        tabs={tabs}
        keep={keep}
        tab="references"
        page={page}
        total={refs.length}
        shown={paged.shown.length}
        start={paged.start}
        current={paged.current}
        totalPages={paged.totalPages}
        noun="places"
      />
    </>
  );
}

// What a policy file or block contains: the bundles, bodies and promise
// types of a file; the variables, classes and calls of a block.
function ContentsPanel({ entry, tabs, page, keep }: PanelProps) {
  const contents = getPolicyContents(entry);
  const paged = paginate(contents, page);
  return (
    <>
      <p className="muted" data-testid="contents-description">
        {entry.type === "file"
          ? "Defined in this file:"
          : `Defined or called in ${entry.type === "promise-type" ? "promise type " : ""}${entry.name}:`}
      </p>
      <ul className="entry-list" data-testid="contents">
        {paged.shown.map((item, i) => (
          <li key={`${item.entry.type}:${item.entry.name}:${item.line}:${i}`} className="host-item" data-testid="content-item">
            <span className="type-badge">{item.entry.type}</span>
            <div className="host-summary">
              <div>
                <EntryLink type={item.entry.type} name={item.entry.name} />
              </div>
              <div className="muted host-facts">
                <Link href={fileLineHref(item.checksum, item.line)} className="entry-link" data-testid="content-line-link">
                  Line {item.line}
                </Link>
                {entry.type !== "file" && <span>{fileNames(item.checksum).join(", ")}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <TabPagination
        entry={entry}
        tabs={tabs}
        keep={keep}
        tab="contents"
        page={page}
        total={contents.length}
        shown={paged.shown.length}
        start={paged.start}
        current={paged.current}
        totalPages={paged.totalPages}
        noun="items"
      />
    </>
  );
}

// The full content of a file, or a note that only its checksum is known.
// CFEngine policy (files named *.cf) is syntax highlighted with
// tree-sitter-cfengine (see lib/highlight.ts).
async function ContentPanel({ entry }: { entry: Entry }) {
  const file = getFileContent(entry.name);
  if (!file || file.content === null) {
    return (
      <p className="muted" data-testid="content-unavailable">
        {file
          ? `The content of this ${formatBytes(file.size)} binary file is not available, only its checksum.`
          : "The content of this file is not available, only its checksum."}
      </p>
    );
  }
  const lines = file.content.split("\n").length - (file.content.endsWith("\n") ? 1 : 0);
  const cfengine = fileNames(entry.name).some(isCfengineFile);
  const description = (
    <p className="muted" data-testid="content-description">
      {`${formatBytes(file.size)}, ${lines} ${lines === 1 ? "line" : "lines"}${cfengine ? ", CFEngine policy" : ""}:`}
    </p>
  );
  if (cfengine) {
    const html = await highlightCfengine(file.content);
    return (
      <>
        {description}
        <pre
          className="file-content"
          data-testid="file-content"
          data-language="cfengine"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </>
    );
  }
  return (
    <>
      {description}
      <pre
        className="file-content"
        data-testid="file-content"
        dangerouslySetInnerHTML={{ __html: plainLines(file.content) }}
      />
    </>
  );
}

// The paths where a file or filename is found, one card per path, most
// hosts first; the count links to a search for those hosts.
function PathsPanel({ entry, tabs, page, keep }: PanelProps) {
  const paths = pathsOf(entry);
  const paged = paginate(paths, page);
  return (
    <>
      <p className="muted" data-testid="paths-description">
        {entry.type === "file"
          ? "Paths where this file is found:"
          : `Paths of files named ${entry.name}:`}
      </p>
      {paths.length === 0 && <p className="muted">None</p>}
      <ul className="entry-list" data-testid="paths">
        {paged.shown.map(({ path, hosts }) => (
          <li key={path} className="host-item" data-testid="path-item">
            <span className="type-badge">path</span>
            <div className="host-summary">
              <div>
                <EntryLink type="path" name={path} />
              </div>
              <div className="muted host-facts">
                <Link
                  href={filterSearchHref([{ type: "path", name: path }, { type: entry.type, name: entry.name }])}
                  className="entry-link"
                  data-testid="path-hosts-link"
                >
                  {hostsLabel(hosts)}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <TabPagination
        entry={entry}
        tabs={tabs}
        keep={keep}
        tab="paths"
        page={page}
        total={paths.length}
        shown={paged.shown.length}
        start={paged.start}
        current={paged.current}
        totalPages={paged.totalPages}
        noun="paths"
      />
    </>
  );
}

// The files (checksums) found at a path or under a filename, one card per
// file, most hosts first: more than one means the file differs between hosts.
function FilesPanel({ entry, tabs, page, keep }: PanelProps) {
  const files = filesOf(entry);
  const paged = paginate(files, page);
  return (
    <>
      <p className="muted" data-testid="files-description">
        {entry.type === "path"
          ? files.length > 1
            ? "The file at this path differs between hosts; its checksums:"
            : "The file at this path, by checksum:"
          : `Files named ${entry.name}, by checksum:`}
      </p>
      {files.length === 0 && <p className="muted">None</p>}
      <ul className="entry-list" data-testid="files">
        {paged.shown.map(({ checksum, hosts }) => (
          <li key={checksum} className="host-item" data-testid="file-item">
            <span className="type-badge">file</span>
            <div className="host-summary">
              <div>
                <EntryLink type="file" name={checksum} />
              </div>
              <div className="muted host-facts">
                <Link
                  href={filterSearchHref([{ type: "file", name: checksum }, { type: entry.type, name: entry.name }])}
                  className="entry-link"
                  data-testid="file-hosts-link"
                >
                  {hostsLabel(hosts)}
                </Link>
                <span>{describeEntry({ type: "file", name: checksum })}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <TabPagination
        entry={entry}
        tabs={tabs}
        keep={keep}
        tab="files"
        page={page}
        total={files.length}
        shown={paged.shown.length}
        start={paged.start}
        current={paged.current}
        totalPages={paged.totalPages}
        noun="files"
      />
    </>
  );
}

// Entries of the same type with similar names, longest shared prefix first.
function SimilarPanel({ entry, tabs, page, keep }: PanelProps) {
  const similar = similarEntries(entry);
  const paged = paginate(similar, page);
  return (
    <>
      <p className="muted" data-testid="similar-description">
        {entry.type === "ip" || entry.type === "mac"
          ? `Other similar ${TYPE_LABELS[entry.type]}:`
          : entry.type === "value"
            ? `Other values of ${parseValueEntryName(entry.name).variable} with similar names:`
            : `Other ${TYPE_LABELS[entry.type].toLowerCase()} with similar names:`}
      </p>
      <ul className="entry-list" data-testid="similar">
        {paged.shown.map(({ entry: e, common }) => (
          <li key={e.name} className="host-item" data-testid="similar-item" data-common={common}>
            <span className="type-badge">{e.type}</span>
            <div className="host-summary">
              <div>
                <EntryLink type={e.type} name={e.name} />
              </div>
              <div className="muted host-facts">{describeEntry(e)}</div>
            </div>
          </li>
        ))}
      </ul>
      <TabPagination
        entry={entry}
        tabs={tabs}
        keep={keep}
        tab="similar"
        page={page}
        total={similar.length}
        shown={paged.shown.length}
        start={paged.start}
        current={paged.current}
        totalPages={paged.totalPages}
        noun={TYPE_LABELS[entry.type].toLowerCase()}
      />
    </>
  );
}

// External resources (Wikipedia, official sites, ...) from info.json.
function ResourcesPanel({ entry }: { entry: Entry }) {
  const links = getEntryLinks(entry);
  return (
    <>
      <p className="muted" data-testid="resources-description">
        Read more about {entry.name}:
      </p>
      <ul className="entry-list" data-testid="external-links">
        {links.map((link) => (
          <li key={link.url} className="host-item" data-testid="resource-item">
            <span className="type-badge">link</span>
            <div className="host-summary">
              <div>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="entry-link">
                  {externalLinkLabel(link)}
                </a>
              </div>
              <div className="muted host-facts">{link.url}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

// The ports the related hosts listen on, one card per port, ascending.
export default function RelatedHosts({
  entry,
  tabs,
  tab,
  page,
  keep = {},
  testId,
}: {
  entry: Entry;
  tabs: Tab[];
  tab?: Tab;
  // Page of the current tab's list (the `tpage` query parameter).
  page: number;
  // The other side's query parameters, kept when switching tabs here.
  keep?: KeptQuery;
  testId: string;
}) {
  const similarCount = similarEntries(entry).length;
  const resourceCount = getEntryLinks(entry).length;
  // Tabs with nothing to show are disabled: visible, gray, not clickable.
  const disabled = new Set<Tab>();
  if (similarCount === 0) disabled.add("similar");
  if (resourceCount === 0) disabled.add("resources");
  const enabled = tabs.filter((t) => !disabled.has(t));
  const current = tab && enabled.includes(tab) ? tab : enabled[0];
  const counts: Record<Tab, number> = {
    content: 0,
    references: getPolicyRefs(entry).length,
    contents: getPolicyContents(entry).length,
    similar: similarCount,
    resources: resourceCount,
    comments: getComments(entry).length,
    versions: entry.type === "software" ? aggregateVersions(entry.name, entry.hosts).length : 0,
    values: entry.type === "variable" ? aggregateValues(entry.name, entry.hosts).length : 0,
    paths: pathsOf(entry).length,
    files: filesOf(entry).length,
  };
  // The Content tab shows the file's size instead of a count.
  const file = entry.type === "file" ? getFileContent(entry.name) : undefined;
  const countLabel = (t: Tab) =>
    t === "content" ? (file ? formatBytes(file.size) : "unavailable") : String(counts[t]);
  const labels: Record<Tab, string> = {
    content: "Content",
    references: "References",
    contents: "Contents",
    versions: "Versions",
    values: "Values",
    paths: "Paths",
    files: "Files",
    similar: "Similar",
    resources: "Resources",
    comments: "Comments",
  };
  const testIds: Record<Tab, string> = {
    content: "content-heading",
    references: "references-heading",
    contents: "contents-heading",
    versions: "versions-heading",
    values: "values-heading",
    paths: "paths-heading",
    files: "files-heading",
    similar: "similar-heading",
    resources: "resources-heading",
    comments: "comments-heading",
  };
  return (
    <section className="related-hosts" data-testid={testId}>
      <nav className="tabs" role="tablist" aria-label="Related information">
        {tabs.map((t) =>
          disabled.has(t) ? (
            <span
              key={t}
              role="tab"
              aria-selected={false}
              aria-disabled="true"
              className="tab tab-disabled"
              data-testid={testIds[t]}
            >
              {labels[t]} <span className="muted">({countLabel(t)})</span>
            </span>
          ) : (
            <Link
              key={t}
              href={tabHref(entry, tabs, t, 1, keep)}
              role="tab"
              aria-selected={t === current}
              className={`tab${t === current ? " tab-current" : ""}`}
              data-testid={testIds[t]}
            >
              {labels[t]}{" "}
              {t === "comments" ? (
                <span
                  className="muted"
                  data-comments-count
                  suppressHydrationWarning
                  dangerouslySetInnerHTML={{ __html: `(${counts[t]})` }}
                />
              ) : (
                <span className="muted">({countLabel(t)})</span>
              )}
            </Link>
          ),
        )}
      </nav>
      {current && (
        <div className="tab-panel" role="tabpanel" data-testid={`tab-${current}`}>
          {current === "content" && <ContentPanel entry={entry} />}
          {current === "references" && (
            <ReferencesPanel entry={entry} tabs={tabs} page={page} keep={keep} />
          )}
          {current === "contents" && (
            <ContentsPanel entry={entry} tabs={tabs} page={page} keep={keep} />
          )}
          {current === "versions" && (
            <VersionsPanel entry={entry} tabs={tabs} page={page} keep={keep} />
          )}
          {current === "paths" && <PathsPanel entry={entry} tabs={tabs} page={page} keep={keep} />}
          {current === "files" && <FilesPanel entry={entry} tabs={tabs} page={page} keep={keep} />}
          {current === "values" && (
            <ValuesPanel entry={entry} tabs={tabs} page={page} keep={keep} />
          )}
          {current === "similar" && (
            <SimilarPanel entry={entry} tabs={tabs} page={page} keep={keep} />
          )}
          {current === "resources" && <ResourcesPanel entry={entry} />}
          {current === "comments" && <Comments entry={entry} />}
        </div>
      )}
    </section>
  );
}
