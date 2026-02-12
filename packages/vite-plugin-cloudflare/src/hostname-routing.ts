import type { Worker } from "./plugin-config";

const ALIAS_RE = /^[a-z0-9]([a-z0-9_-]{0,61}[a-z0-9])?$/;

function toAlias(name: string): string {
	return name.toLowerCase();
}

function validateAlias(alias: string, context: string): void {
	if (!ALIAS_RE.test(alias)) {
		throw new Error(
			`Invalid hostname alias "${alias}" for ${context}. ` +
				`Aliases must contain only lowercase alphanumeric characters, hyphens, and underscores, ` +
				`must not start or end with a hyphen or underscore, and must be 1-63 characters long.`
		);
	}
}

/**
 * Resolves entrypoint routing for a single worker based on its `exposeEntrypoints` config.
 *
 * Returns the `entrypointRouting` record (export name -> hostname alias) to pass
 * to the worker's miniflare options, or `undefined` if the worker doesn't opt in.
 *
 * - `true`: all WorkerEntrypoint exports are exposed with lowercased names as hostname aliases
 * - `Record<string, string | true>`: explicit mapping of export names to hostname aliases
 *   (`true` values become the lowercased export name)
 */
export function resolveEntrypointRouting(
	worker: Worker,
	exportTypes: Record<string, string> | undefined
): Record<string, string> | undefined {
	const { exposeEntrypoints } = worker;
	if (!exposeEntrypoints) {
		return undefined;
	}

	const workerName = worker.config.name;
	const normalizedWorkerName = toAlias(workerName);
	validateAlias(normalizedWorkerName, `worker "${workerName}"`);

	const entrypoints: Record<string, string> = {};
	const seenAliases = new Map<string, string>();

	if (exposeEntrypoints === true) {
		// Expose all WorkerEntrypoint exports
		if (exportTypes) {
			for (const [exportName, exportType] of Object.entries(exportTypes)) {
				if (exportType !== "WorkerEntrypoint") {
					continue;
				}
				const alias = toAlias(exportName);
				validateAlias(
					alias,
					`entrypoint "${exportName}" of worker "${workerName}"`
				);

				const existing = seenAliases.get(alias);
				if (existing) {
					throw new Error(
						`Alias collision in worker "${workerName}": ` +
							`entrypoints "${existing}" and "${exportName}" both map to alias "${alias}".`
					);
				}
				seenAliases.set(alias, exportName);
				entrypoints[exportName] = alias;
			}
		}
	} else {
		// Explicit mapping
		for (const [exportName, aliasOrTrue] of Object.entries(exposeEntrypoints)) {
			const alias = aliasOrTrue === true ? toAlias(exportName) : aliasOrTrue;
			validateAlias(
				alias,
				`entrypoint "${exportName}" of worker "${workerName}"`
			);

			const existing = seenAliases.get(alias);
			if (existing) {
				throw new Error(
					`Alias collision in worker "${workerName}": ` +
						`entrypoints "${existing}" and "${exportName}" both map to alias "${alias}".`
				);
			}
			seenAliases.set(alias, exportName);
			entrypoints[exportName] = alias;
		}
	}

	return entrypoints;
}
