---
"wrangler": patch
"@cloudflare/vite-plugin": patch
"@cloudflare/vitest-pool-workers": patch
---

Make `experimental_readRawConfig` and `unstable_getMiniflareWorkerOptions` async

The `experimental_readRawConfig` function and `unstable_getMiniflareWorkerOptions` function now return Promises. If you are using these experimental/unstable APIs, you will need to await them.
