---
"wrangler": minor
"@cloudflare/vite-plugin": minor
"@cloudflare/vitest-pool-workers": minor
---

Make the exported APIs from Wrangler `experimental_readRawConfig()`, `unstable_getMiniflareWorkerOptions()`, and `unstable_readConfig()` async.

If you'd previously been relying on these unstable APIs, update the callsite to `await` the promise:

```diff
- const config = wrangler.unstable_readConfig()
+ const config = await wrangler.unstable_readConfig()
```
