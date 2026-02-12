import { describe, test } from "vitest";
import { getJsonResponse, getResponse, isBuild } from "../../__test-utils__";

describe.skipIf(isBuild)("entrypoint routing", () => {
	test("routes to worker-a entrypoint via hostname", async ({ expect }) => {
		const result = await getJsonResponse("/", "greet.worker-a.localhost");
		expect(result).toEqual({ name: "Hello from Named entrypoint" });
	});

	test("routes to worker-b entrypoint via hostname", async ({ expect }) => {
		const result = await getJsonResponse(
			"/",
			"namedentrypoint.worker-b.localhost"
		);
		expect(result).toEqual({ name: "Worker B: Named entrypoint" });
	});

	test("returns 404 for unknown entrypoint", async ({ expect }) => {
		const response = await getResponse("/", "unknown.worker-a.localhost");
		expect(response.status()).toBe(404);
	});

	test("returns 404 for unknown worker", async ({ expect }) => {
		const response = await getResponse("/", "greet.unknown.localhost");
		expect(response.status()).toBe(404);
	});
});
