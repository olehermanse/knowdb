#!/usr/bin/env node
// Index the CFEngine policy found on the hosts: the bundles, bodies and
// promise types each .cf file defines, and the variables, classes and
// calls (of functions, bundles and bodies) inside them, with line numbers. Reads data/hosts.json and
// data/files.json and writes data/policy.json.
//
// The files are parsed with the tree-sitter grammar for CFEngine
// (public/tree-sitter-cfengine.wasm, the same grammar as
// `cfengine dev syntax-tree`). That command prints only the shape of the
// tree, without names or positions, so it cannot drive the extraction
// itself; instead, when the CFEngine CLI is installed, its tree for every
// file is compared with ours and any difference is reported (pass
// --skip-cli to leave the CLI out).
//
//   node scripts/index_policy.mjs [--skip-cli]

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Language, Parser } from "web-tree-sitter";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipCli = process.argv.includes("--skip-cli");

const hosts = JSON.parse(readFileSync(path.join(root, "data/hosts.json"), "utf8"));
const files = JSON.parse(readFileSync(path.join(root, "data/files.json"), "utf8")).files;

// The .cf files on any host, by checksum, with one of their filenames.
const policyFiles = new Map();
for (const host of hosts) {
  for (const [p, checksum] of Object.entries(host.files ?? {})) {
    const name = p.split(/[\\/]/).pop();
    if (/\.cf$/i.test(name) && files[checksum]?.content != null) policyFiles.set(checksum, name);
  }
}

await Parser.init();
const language = await Language.load(
  new Uint8Array(readFileSync(path.join(root, "public/tree-sitter-cfengine.wasm"))),
);
const parser = new Parser();
parser.setLanguage(language);

const unquote = (text) => text.replace(/^"([\s\S]*)"$/, "$1").replace(/^'([\s\S]*)'$/, "$1");
const line = (node) => node.startPosition.row + 1;
const child = (node, type) => node.namedChildren.find((c) => c.type === type);

// Walk a block body: the promise sections (files:, vars:, ...) with how
// many promises each makes, the promises under vars: and classes:, and
// every call (of a function, bundle or body), with the block they are in.
function indexBlock(block, blockRef, out) {
  const walk = (node, guard) => {
    if (node.type === "promise_guard") return;
    if (node.type === "bundle_section") {
      guard = child(node, "promise_guard")?.text.replace(/:$/, "") ?? guard;
      const promises = node.descendantsOfType(["promise", "half_promise"]).length;
      out.sections.push({ type: guard, line: line(node), block: blockRef, promises });
    }
    if (node.type === "promise" || node.type === "half_promise") {
      const promiser = child(node, "promiser");
      if (promiser && (guard === "vars" || guard === "classes")) {
        const attributes = node.namedChildren.filter((c) => c.type === "attribute");
        const entry = { name: unquote(promiser.text), line: line(node), block: blockRef };
        if (guard === "vars") {
          // The attribute naming the type: string, slist, data, int, ...
          const typeAttr = attributes
            .map((a) => child(a, "attribute_name")?.text)
            .find((t) => t && /^(string|int|real|slist|ilist|rlist|data)$/.test(t));
          if (typeAttr) entry.type = typeAttr;
          out.vars.push(entry);
        } else {
          out.classes.push(entry);
        }
      }
    }
    if (node.type === "call") {
      const callee = child(node, "calling_identifier")?.text;
      const attribute = node.parent?.type === "attribute" ? child(node.parent, "attribute_name")?.text : undefined;
      if (callee) {
        const call = { name: callee, line: line(node), block: blockRef };
        if (attribute) call.attribute = attribute;
        out.calls.push(call);
      }
    }
    for (const c of node.namedChildren) walk(c, guard);
  };
  walk(block, undefined);
}

function indexFile(source) {
  const tree = parser.parse(source);
  const out = {
    bundles: [],
    bodies: [],
    "promise-types": [],
    vars: [],
    classes: [],
    calls: [],
    // The promise sections of the bundles: which promise type, where, how
    // many promises.
    sections: [],
    errors: tree.rootNode.hasError,
  };
  for (const block of tree.rootNode.namedChildren) {
    if (block.type === "bundle_block" || block.type === "body_block") {
      const kind = block.type === "bundle_block" ? "bundle" : "body";
      const type = child(block, `${kind}_block_type`)?.text ?? "";
      const name = child(block, `${kind}_block_name`)?.text ?? "";
      const parameters = (child(block, "parameter_list")?.namedChildren ?? [])
        .filter((c) => c.type === "parameter")
        .map((c) => c.text);
      const def = { type, name, line: line(block) };
      if (parameters.length > 0) def.parameters = parameters;
      out[kind === "bundle" ? "bundles" : "bodies"].push(def);
      // Blocks are referred to by their full heading: "bundle agent main".
      indexBlock(block, { type: kind, name: `${kind} ${type} ${name}` }, out);
    } else if (block.type === "promise_block") {
      const name = child(block, "promise_block_name")?.text ?? "";
      out["promise-types"].push({ name, line: line(block) });
      indexBlock(block, { type: "custom-promise-type", name }, out);
    }
  }
  const sexp = tree.rootNode.toString();
  tree.delete();
  return { out, sexp };
}

// Compare our tree with the CFEngine CLI's for the same content.
let cli = !skipCli;
let checked = 0;
let differing = 0;
function checkWithCli(checksum, name, source, sexp) {
  if (!cli) return;
  const dir = path.join(root, "tmp", "policy-check");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${checksum.slice(0, 16)}-${name}`);
  writeFileSync(file, source);
  let theirs;
  try {
    theirs = execFileSync("cfengine", ["dev", "syntax-tree", file], { stdio: ["ignore", "pipe", "pipe"] }).toString();
  } catch (err) {
    console.warn(`Warning: cannot run \`cfengine dev syntax-tree\` (${err.code ?? err.message}); skipping the CLI check`);
    cli = false;
    return;
  }
  checked++;
  if (theirs.replace(/\s+/g, " ").trim() !== sexp.replace(/\s+/g, " ").trim()) {
    differing++;
    console.warn(`Warning: the CLI's syntax tree for ${name} (${checksum.slice(0, 16)}) differs from ours`);
  }
}

const indexed = {};
let withErrors = 0;
for (const [checksum, name] of [...policyFiles.entries()].sort()) {
  const source = files[checksum].content;
  const { out, sexp } = indexFile(source);
  if (out.errors) withErrors++;
  indexed[checksum] = out;
  checkWithCli(checksum, name, source, sexp);
}

const output = {
  _comment:
    "What the CFEngine policy files on the hosts define, keyed by the file's SHA-256 checksum " +
    "(see files.json): bundles, bodies and promise types with their line numbers, and the " +
    "variables, classes and calls (of functions, bundles and bodies) inside them with the block they are in, and the " +
    "promise sections (sections) of each bundle with their promise type, line and number of promises. Generated " +
    "by scripts/index_policy.mjs from hosts.json and files.json with the tree-sitter grammar " +
    "for CFEngine; the frontend reads this file at build time.",
  files: indexed,
};
writeFileSync(path.join(root, "data/policy.json"), JSON.stringify(output, null, 1) + "\n");

const totals = { bundles: 0, bodies: 0, "promise-types": 0, vars: 0, classes: 0, calls: 0, sections: 0 };
for (const f of Object.values(indexed)) for (const k of Object.keys(totals)) totals[k] += f[k].length;
console.log(`Indexed ${policyFiles.size} policy files (${withErrors} with parse errors) into data/policy.json:`, totals);
if (checked > 0) console.log(`Checked ${checked} syntax trees against \`cfengine dev syntax-tree\`, ${differing} differ.`);
