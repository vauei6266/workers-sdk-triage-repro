import type { Worker } from "./plugin-config";

const HOSTNAME_LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function toHostnameLabel(name: string): string {
	return name.toLowerCase().replaceAll("_", "-");
}

function validateHostnameLabel(label: string, context: string): void {
	if (!HOSTNAME_LABEL_RE.test(label)) {
		throw new Error(
			`Invalid hostname label "${label}" for ${context}. ` +
				`Labels must contain only lowercase alphanumeric characters and hyphens, ` +
				`must not start or end with a hyphen, and must be 1-63 characters long.`
		);
	}
}

/**
 * Resolves entrypoint routing for a single worker based on its `exposeEntrypoints` config.
 *
 * Returns the `entrypointRouting` record (hostname label -> export name) to pass
 * to the worker's miniflare options, or `undefined` if the worker doesn't opt in.
 *
 * - `true`: all WorkerEntrypoint exports are exposed with lowercased names as hostname labels
 * - `Record<string, string | true>`: explicit mapping of export names to hostname labels
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
	const workerLabel = toHostnameLabel(workerName);
	validateHostnameLabel(workerLabel, `worker "${workerName}"`);

	const entrypoints: Record<string, string> = {};
	const seenLabels = new Map<string, string>();

	if (exposeEntrypoints === true) {
		// Expose all WorkerEntrypoint exports
		if (exportTypes) {
			for (const [exportName, exportType] of Object.entries(exportTypes)) {
				if (exportType !== "WorkerEntrypoint") {
					continue;
				}
				const label = toHostnameLabel(exportName);
				validateHostnameLabel(
					label,
					`entrypoint "${exportName}" of worker "${workerName}"`
				);

				const existing = seenLabels.get(label);
				if (existing) {
					throw new Error(
						`Hostname label collision in worker "${workerName}": ` +
							`entrypoints "${existing}" and "${exportName}" both map to label "${label}".`
					);
				}
				seenLabels.set(label, exportName);
				entrypoints[label] = exportName;
			}
		}
	} else {
		// Explicit mapping
		for (const [exportName, labelOrTrue] of Object.entries(exposeEntrypoints)) {
			const label =
				labelOrTrue === true ? toHostnameLabel(exportName) : labelOrTrue;
			validateHostnameLabel(
				label,
				`entrypoint "${exportName}" of worker "${workerName}"`
			);

			const existing = seenLabels.get(label);
			if (existing) {
				throw new Error(
					`Hostname label collision in worker "${workerName}": ` +
						`entrypoints "${existing}" and "${exportName}" both map to label "${label}".`
				);
			}
			seenLabels.set(label, exportName);
			entrypoints[label] = exportName;
		}
	}

	return entrypoints;
}
