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

// Turn the captures into nested <span> elements over the escaped source.
// Captures are sorted by start (outer before inner when they start at the
// same place); a second capture of exactly the same range is dropped, and
// one that only partly overlaps the span it is inside is skipped.
function render(source: string, captures: QueryCapture[]): string {
  const ranges = captures
    .map((c) => ({ name: c.name, start: c.node.startIndex, end: c.node.endIndex }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let html = "";
  let pos = 0;
  const open: { end: number }[] = [];
  let last: { start: number; end: number } | undefined;
  const closeUntil = (index: number) => {
    while (open.length > 0 && open[open.length - 1]!.end <= index) {
      const { end } = open.pop()!;
      html += escapeHtml(source.slice(pos, end)) + "</span>";
      pos = end;
    }
  };
  for (const r of ranges) {
    if (last && last.start === r.start && last.end === r.end) continue;
    closeUntil(r.start);
    const parent = open[open.length - 1];
    if (parent && r.end > parent.end) continue;
    html += escapeHtml(source.slice(pos, r.start)) + `<span class="${captureClass(r.name)}">`;
    pos = r.start;
    open.push({ end: r.end });
    last = r;
  }
  closeUntil(source.length);
  return html + escapeHtml(source.slice(pos));
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
