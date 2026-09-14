The human wants you to work on one thing at a time, from the TODOS folder.
When you have finished something, delete the TODO file and commit your work.
Then look for new TODOs.

If something is really unclear, you can create a FAQ entry with a question, similar to what-is-this.md for the human operator to answer.
In most cases this should not be necessary, but it can be useful to build a knowledge base on what this project is and should be.

Add tests using playwright.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
