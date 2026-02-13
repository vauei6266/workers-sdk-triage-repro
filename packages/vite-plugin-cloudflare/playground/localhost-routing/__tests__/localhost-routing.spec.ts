import { describe, test } from "vitest";
import { getJsonResponse, getResponse, isBuild } from "../../__test-utils__";

describe.skipIf(isBuild)("localhost routing (single worker)", () => {
	test("routes to entrypoint via {entrypoint}.localhost", async ({
		expect,
	}) => {
		const result = await getJsonResponse("/", "greet.localhost");
		expect(result).toEqual({ greet: "Hello from worker-a" });
	});

	test("routes to another entrypoint", async ({ expect }) => {
		const result = await getJsonResponse("/", "farewell.localhost");
		expect(result).toEqual({
			farewell: "Goodbye from worker-a",
		});
	});

	test("plain localhost falls through to default", async ({ expect }) => {
		const result = await getJsonResponse("/");
		expect(result).toEqual({ worker: "worker-a default" });
	});

	test("returns 404 for unknown entrypoint", async ({ expect }) => {
		const response = await getResponse("/", "unknown.localhost");
		expect(response.status()).toBe(404);
	});

	test("returns 404 for multi-level subdomain", async ({ expect }) => {
		const response = await getResponse("/", "greet.worker-a.localhost");
		expect(response.status()).toBe(404);
	});
});
