import { readFile } from "fs/promises";
import path from "path";
import { Language, Parser, Query, type QueryCapture } from "web-tree-sitter";

// Syntax highlighting of CFEngine policy with tree-sitter-cfengine
// (https://github.com/olehermanse/tree-sitter-cfengine), running as
// WebAssembly on the server. public/tree-sitter-cfengine.wasm is the
// grammar built with `tree-sitter build --wasm` from the npm package
// tree-sitter-cfengine (see AGENTS.md for how to rebuild it), and the
// query below is the highlights.scm of the Zed extension for CFEngine
// (https://github.com/olehermanse/zed-cfengine). Each capture name becomes
// a CSS class: @punctuation.bracket is `hl-punctuation-bracket`.
const HIGHLIGHTS = `
(comment) @comment

(macro) @keyword
(bundle_block_keyword) @keyword
(bundle_block_type) @keyword
(bundle_block_name) @variable
(body_block_keyword) @keyword
(body_block_type) @keyword
(body_block_name) @variable
(promise_block_keyword) @keyword
(promise_block_type) @keyword
(promise_block_name) @variable

(promise_guard) @type
(class_guard) @attribute
(promiser) @string
(attribute_name) @variable

(quoted_string) @string
(qualified_identifier) @property
(calling_identifier) @attribute

(dollar_expression) @operator
(at_expression) @operator
(dollar_expression_reference) @property
(at_expression_reference) @property

[";" ","] @punctuation.delimiter

["(" ")"] @punctuation.bracket

["{" "}"] @punctuation.bracket

["=>" "->"] @operator
`;

const GRAMMAR_PATH = path.join(process.cwd(), "public", "tree-sitter-cfengine.wasm");

// CFEngine policy files end in .cf.
export function isCfengineFile(filename: string): boolean {
  return /\.cf$/i.test(filename);
}

// The parser and query are loaded once and shared; parsing is fast (a few
// milliseconds for the largest policy file).
let loading: Promise<{ parser: Parser; query: Query }> | undefined;

function load() {
  loading ??= (async () => {
    await Parser.init();
    const language = await Language.load(new Uint8Array(await readFile(GRAMMAR_PATH)));
    const parser = new Parser();
    parser.setLanguage(language);
    return { parser, query: new Query(language, HIGHLIGHTS) };
  })();
  return loading;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function captureClass(name: string): string {
  return `hl-${name.replace(/\./g, "-")}`;
}

// Turn the captures into nested <span> elements over the escaped source,
// with every line wrapped in <span class="line" id="L<n>"> so links can
// point at a line. Captures are sorted by start (outer before inner when
// they start at the same place); a second capture of exactly the same
// range is dropped, and one that only partly overlaps the span it is
// inside is skipped. A capture spanning several lines is closed at the end
// of each line and reopened on the next.
function render(source: string, captures: QueryCapture[]): string {
  const ranges = captures
    .map((c) => ({ name: c.name, start: c.node.startIndex, end: c.node.endIndex }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let html = `<span class="line" id="L1">`;
  let lineNo = 1;
  let pos = 0;
  const open: { end: number; cls: string }[] = [];
  let last: { start: number; end: number } | undefined;
  // Escaped text with the line spans (and the open highlight spans) broken
  // around every newline.
  const emit = (text: string) => {
    const lines = text.split("\n");
    lines.forEach((part, i) => {
      html += escapeHtml(part);
      if (i === lines.length - 1) return;
      for (let k = 0; k < open.length; k++) html += "</span>";
      html += "</span>\n";
      lineNo++;
      html += `<span class="line" id="L${lineNo}">`;
      for (const o of open) html += `<span class="${o.cls}">`;
    });
  };
  const closeUntil = (index: number) => {
    while (open.length > 0 && open[open.length - 1]!.end <= index) {
      const { end } = open[open.length - 1]!;
      emit(source.slice(pos, end));
      open.pop();
      html += "</span>";
      pos = end;
    }
  };
  for (const r of ranges) {
    if (last && last.start === r.start && last.end === r.end) continue;
    closeUntil(r.start);
    const parent = open[open.length - 1];
    if (parent && r.end > parent.end) continue;
    emit(source.slice(pos, r.start));
    const cls = captureClass(r.name);
    html += `<span class="${cls}">`;
    pos = r.start;
    open.push({ end: r.end, cls });
    last = r;
  }
  closeUntil(source.length);
  // A trailing newline ends the last line rather than starting an empty one.
  const rest = source.slice(pos);
  emit(rest.endsWith("\n") ? rest.slice(0, -1) : rest);
  return html + "</span>";
}

// Plain text with line anchors, for files that are not highlighted.
export function plainLines(source: string): string {
  return render(source, []);
}

// The source as HTML with highlighting spans; plain escaped text if the
// parser could not handle it.
export async function highlightCfengine(source: string): Promise<string> {
  const { parser, query } = await load();
  const tree = parser.parse(source);
  if (!tree) return escapeHtml(source);
  try {
    return render(source, query.captures(tree.rootNode));
  } finally {
    tree.delete();
  }
}
