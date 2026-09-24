#!/usr/bin/env python3
"""Copy the built-in functions and promise types from the CFEngine CLI's
syntax description.

The CFEngine CLI (https://github.com/cfengine/cfengine-cli) ships
syntax-description.json, generated from cf-agent. Its "functions" section
lists every built-in function with its category, parameters, return type
and status, and its "promiseTypes" section every built-in promise type
with its attributes; "bundleTypes" says which promise types each bundle
type allows. This writes them to data/functions.json and
data/promise-types.json.

    python3 scripts/import_syntax.py [path/to/syntax-description.json]

Without a path, the file is taken from a checkout of cfengine-cli next to
this repository, or else from the installed cfengine package.
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUTPUT_PATH = ROOT / "data" / "functions.json"
PROMISE_TYPES_PATH = ROOT / "data" / "promise-types.json"
CHECKOUT_PATH = ROOT.parent / "cfengine-cli" / "src" / "cfengine_cli" / "syntax-description.json"


def find_installed():
    """The syntax description inside the installed cfengine CLI, if any."""
    try:
        out = subprocess.run(
            ["cfengine", "--help"], capture_output=True, text=True, check=False
        )
    except FileNotFoundError:
        return None
    if out.returncode != 0:
        return None
    # The CLI is a Python package; ask its interpreter where it lives.
    which = subprocess.run(["which", "cfengine"], capture_output=True, text=True).stdout.strip()
    if not which:
        return None
    interpreter = Path(which).read_text().splitlines()[0].removeprefix("#!").strip()
    code = "import cfengine_cli, os; print(os.path.dirname(cfengine_cli.__file__))"
    where = subprocess.run([interpreter, "-c", code], capture_output=True, text=True, check=False)
    path = Path(where.stdout.strip()) / "syntax-description.json"
    return path if path.is_file() else None


def main():
    if len(sys.argv) > 1:
        source = Path(sys.argv[1])
    elif CHECKOUT_PATH.is_file():
        source = CHECKOUT_PATH
    else:
        source = find_installed()
    if not source or not source.is_file():
        sys.exit("Cannot find syntax-description.json; pass its path")
    with open(source) as f:
        syntax = json.load(f)
    functions = syntax["functions"]
    with open(OUTPUT_PATH, "w") as f:
        json.dump(
            {
                "_comment": "The built-in CFEngine functions, from the functions section of the "
                "CFEngine CLI's syntax-description.json (https://github.com/cfengine/cfengine-cli, "
                "generated from cf-agent): category, parameters (type, description, range), "
                "returnType, whether the function is variadic (with minArgs/maxArgs), cached or "
                "collecting, and status (normal or deprecated). Written by "
                "scripts/import_syntax.py; the frontend reads this file at build time and "
                "shows every function as an entry.",
                "functions": dict(sorted(functions.items())),
            },
            f,
            indent=1,
        )
        f.write("\n")
    print(f"Wrote {len(functions)} functions from {source} to {OUTPUT_PATH}")
    # Promise types, each with the bundle types that allow it.
    promise_types = {}
    for name, spec in sorted(syntax["promiseTypes"].items()):
        bundle_types = sorted(
            bt for bt, b in syntax["bundleTypes"].items() if name in b.get("promiseTypes", [])
        )
        promise_types[name] = {
            "status": spec["status"],
            "bundle-types": bundle_types,
            "attributes": {
                attr: {k: v for k, v in a.items() if k != "attribute"}
                for attr, a in sorted(spec["attributes"].items())
            },
        }
    with open(PROMISE_TYPES_PATH, "w") as f:
        json.dump(
            {
                "_comment": "The built-in CFEngine promise types, from the promiseTypes section of "
                "the CFEngine CLI's syntax-description.json (https://github.com/cfengine/cfengine-cli, "
                "generated from cf-agent): status (normal or deprecated), the bundle types that "
                "allow the promise type (from bundleTypes), and the attributes with their type, "
                "range, status and visibility (global attributes are common to all promise types). "
                "Written by scripts/import_syntax.py; the frontend reads this file at build time "
                "and shows every promise type as an entry.",
                "promise-types": promise_types,
            },
            f,
            indent=1,
        )
        f.write("\n")
    print(f"Wrote {len(promise_types)} promise types to {PROMISE_TYPES_PATH}")


if __name__ == "__main__":
    main()
