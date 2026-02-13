import { lookup } from "node:dns/promises";
import dedent from "ts-dedent";
import { fetch } from "undici";
import { describe, expect, it } from "vitest";
import { WranglerE2ETestHelper } from "./helpers/e2e-wrangler-test";
import { fetchText } from "./helpers/fetch-text";
import { seed as baseSeed, makeRoot } from "./helpers/setup";

// Check if *.localhost subdomains resolve on this system.
// Some environments (Windows, older macOS, Alpine) don't support this.
let localhostSubdomainsSupported = true;
try {
	const result = await lookup("test.domain.localhost");
	localhostSubdomainsSupported =
		result.address === "127.0.0.1" || result.address === "::1";
} catch {
	localhostSubdomainsSupported = false;
}

// Worker A source: Greet + Farewell entrypoints + default
const workerASrc = dedent/* javascript */ `
	import { WorkerEntrypoint } from "cloudflare:workers";

	export class Greet extends WorkerEntrypoint {
		async fetch() {
			return new Response("Hello from worker-a");
		}
	}

	export class Farewell extends WorkerEntrypoint {
		async fetch() {
			return new Response("Goodbye from worker-a");
		}
	}

	export default {
		fetch() {
			return new Response("worker-a default");
		},
	};
`;

// Worker B source: Echo entrypoint + default
const workerBSrc = dedent/* javascript */ `
	import { WorkerEntrypoint } from "cloudflare:workers";

	export class Echo extends WorkerEntrypoint {
		async fetch(request) {
			return new Response("echo:" + new URL(request.url).pathname);
		}
	}

	export default {
		fetch() {
			return new Response("worker-b default");
		},
	};
`;

describe.skipIf(!localhostSubdomainsSupported)(
	"localhost entrypoint routing",
	() => {
		describe("single worker (expose_entrypoints = true)", () => {
			async function startWorker() {
				const helper = new WranglerE2ETestHelper();
				await helper.seed({
					"wrangler.toml": dedent`
						name = "worker-a"
						main = "src/index.ts"
						compatibility_date = "2025-01-01"

						[dev]
						expose_entrypoints = true
					`,
					"src/index.ts": workerASrc,
					"package.json": dedent`
						{
							"name": "worker-a",
							"version": "0.0.0",
							"private": true
						}
					`,
				});
				const worker = helper.runLongLived("wrangler dev");
				const { url } = await worker.waitForReady();
				const { port } = new URL(url);
				return {
					default: url,
					greet: `http://greet.localhost:${port}`,
					farewell: `http://farewell.localhost:${port}`,
					unknown: `http://unknown.localhost:${port}`,
					"greet.worker-a": `http://greet.worker-a.localhost:${port}`,
				};
			}

			it("routes to a named entrypoint via subdomain", async () => {
				const urls = await startWorker();
				await expect(fetchText(urls.greet)).resolves.toBe(
					"Hello from worker-a"
				);
			});

			it("routes to another named entrypoint via subdomain", async () => {
				const urls = await startWorker();
				await expect(fetchText(urls.farewell)).resolves.toBe(
					"Goodbye from worker-a"
				);
			});

			it("falls through to default export on plain localhost", async () => {
				const urls = await startWorker();
				await expect(fetchText(urls.default)).resolves.toBe("worker-a default");
			});

			it("returns 404 for an unknown entrypoint", async () => {
				const urls = await startWorker();
				const res = await fetch(urls.unknown);
				expect(res.status).toBe(404);
			});

			it("returns 404 for a multi-level subdomain (short mode)", async () => {
				const urls = await startWorker();
				const res = await fetch(urls["greet.worker-a"]);
				expect(res.status).toBe(404);
			});
		});

		describe("single worker (object config with aliases)", () => {
			async function startWorker() {
				const helper = new WranglerE2ETestHelper();
				await helper.seed({
					"wrangler.toml": dedent`
						name = "worker-a"
						main = "src/index.ts"
						compatibility_date = "2025-01-01"

						[dev.expose_entrypoints]
						Greet = "hello"
						Farewell = true
					`,
					"src/index.ts": workerASrc,
					"package.json": dedent`
						{
							"name": "worker-a",
							"version": "0.0.0",
							"private": true
						}
					`,
				});
				const worker = helper.runLongLived("wrangler dev");
				const { url } = await worker.waitForReady();
				const { port } = new URL(url);
				return {
					hello: `http://hello.localhost:${port}`,
					farewell: `http://farewell.localhost:${port}`,
					greet: `http://greet.localhost:${port}`,
				};
			}

			it("routes via custom alias", async () => {
				const urls = await startWorker();
				await expect(fetchText(urls.hello)).resolves.toBe(
					"Hello from worker-a"
				);
			});

			it("routes via lowercased export name when alias is true", async () => {
				const urls = await startWorker();
				await expect(fetchText(urls.farewell)).resolves.toBe(
					"Goodbye from worker-a"
				);
			});

			it("returns 404 for the original export name when aliased", async () => {
				const urls = await startWorker();
				const res = await fetch(urls.greet);
				expect(res.status).toBe(404);
			});
		});

		describe("multi-worker", () => {
			async function startWorkers() {
				const helper = new WranglerE2ETestHelper();

				const a = helper.tmpPath;
				await baseSeed(a, {
					"wrangler.toml": dedent`
						name = "worker-a"
						main = "src/index.ts"
						compatibility_date = "2025-01-01"

						[dev]
						expose_entrypoints = true
					`,
					"src/index.ts": workerASrc,
					"package.json": dedent`
						{
							"name": "worker-a",
							"version": "0.0.0",
							"private": true
						}
					`,
				});

				const b = makeRoot();
				await baseSeed(b, {
					"wrangler.toml": dedent`
						name = "worker-b"
						main = "src/index.ts"
						compatibility_date = "2025-01-01"

						[dev]
						expose_entrypoints = true
					`,
					"src/index.ts": workerBSrc,
					"package.json": dedent`
						{
							"name": "worker-b",
							"version": "0.0.0",
							"private": true
						}
					`,
				});

				const worker = helper.runLongLived(
					`wrangler dev -c wrangler.toml -c ${b}/wrangler.toml`
				);
				const { url } = await worker.waitForReady();
				const { port } = new URL(url);
				return {
					default: url,
					"greet.worker-a": `http://greet.worker-a.localhost:${port}`,
					"echo.worker-b": `http://echo.worker-b.localhost:${port}`,
					greet: `http://greet.localhost:${port}`,
					"greet.unknown": `http://greet.unknown.localhost:${port}`,
					"nonexistent.worker-a": `http://nonexistent.worker-a.localhost:${port}`,
				};
			}

			it("routes to worker-a entrypoint via two-level subdomain", async () => {
				const urls = await startWorkers();
				await expect(fetchText(urls["greet.worker-a"])).resolves.toBe(
					"Hello from worker-a"
				);
			});

			it("routes to worker-b entrypoint via two-level subdomain", async () => {
				const urls = await startWorkers();
				await expect(fetchText(urls["echo.worker-b"])).resolves.toBe("echo:/");
			});

			it("falls through to primary worker default on plain localhost", async () => {
				const urls = await startWorkers();
				await expect(fetchText(urls.default)).resolves.toBe("worker-a default");
			});

			it("returns 404 for a single-level subdomain (full mode)", async () => {
				const urls = await startWorkers();
				const res = await fetch(urls.greet);
				expect(res.status).toBe(404);
			});

			it("returns 404 for an unknown worker name", async () => {
				const urls = await startWorkers();
				const res = await fetch(urls["greet.unknown"]);
				expect(res.status).toBe(404);
			});

			it("returns 404 for an unknown entrypoint on a known worker", async () => {
				const urls = await startWorkers();
				const res = await fetch(urls["nonexistent.worker-a"]);
				expect(res.status).toBe(404);
			});
		});
	}
);
