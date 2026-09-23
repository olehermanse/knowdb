#!/usr/bin/env python3
"""Copy the built-in functions from the CFEngine CLI's syntax description.

The CFEngine CLI (https://github.com/cfengine/cfengine-cli) ships
syntax-description.json, generated from cf-agent, whose "functions" section
lists every built-in function with its category, parameters, return type
and status. This writes that section to data/functions.json.

    python3 scripts/import_functions.py [path/to/syntax-description.json]

Without a path, the file is taken from a checkout of cfengine-cli next to
this repository, or else from the installed cfengine package.
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUTPUT_PATH = ROOT / "data" / "functions.json"
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
        functions = json.load(f)["functions"]
    with open(OUTPUT_PATH, "w") as f:
        json.dump(
            {
                "_comment": "The built-in CFEngine functions, from the functions section of the "
                "CFEngine CLI's syntax-description.json (https://github.com/cfengine/cfengine-cli, "
                "generated from cf-agent): category, parameters (type, description, range), "
                "returnType, whether the function is variadic (with minArgs/maxArgs), cached or "
                "collecting, and status (normal or deprecated). Written by "
                "scripts/import_functions.py; the frontend reads this file at build time and "
                "shows every function as an entry.",
                "functions": dict(sorted(functions.items())),
            },
            f,
            indent=1,
        )
        f.write("\n")
    print(f"Wrote {len(functions)} functions from {source} to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
