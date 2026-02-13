import { describe, test } from "vitest";
import { getJsonResponse, getResponse, isBuild } from "../../../__test-utils__";

describe.skipIf(isBuild)("localhost routing (multi-worker)", () => {
	test("routes to worker-a entrypoint via {entrypoint}.{worker}.localhost", async ({
		expect,
	}) => {
		const result = await getJsonResponse("/", "greet.worker-a.localhost");
		expect(result).toEqual({ greet: "Hello from worker-a" });
	});

	test("routes to worker-b entrypoint", async ({ expect }) => {
		const result = await getJsonResponse("/", "echo.worker-b.localhost");
		expect(result).toEqual({ echo: "/" });
	});

	test("plain localhost falls through to default", async ({ expect }) => {
		const result = await getJsonResponse("/");
		expect(result).toEqual({ worker: "worker-a default" });
	});

	test("returns 404 for single-level subdomain", async ({ expect }) => {
		const response = await getResponse("/", "greet.localhost");
		expect(response.status()).toBe(404);
	});

	test("returns 404 for unknown worker", async ({ expect }) => {
		const response = await getResponse("/", "greet.unknown.localhost");
		expect(response.status()).toBe(404);
	});

	test("returns 404 for unknown entrypoint on known worker", async ({
		expect,
	}) => {
		const response = await getResponse("/", "nonexistent.worker-a.localhost");
		expect(response.status()).toBe(404);
	});
});
