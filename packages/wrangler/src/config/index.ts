import assert from "node:assert";
import path from "node:path";
import {
	configFileName,
	experimental_readRawConfig,
	FatalError,
	isPagesConfig,
	normalizeAndValidateConfig,
	UserError,
	validatePagesConfig,
} from "@cloudflare/workers-utils";
import dedent from "ts-dedent";
import { logger } from "../logger";
import { EXIT_CODE_INVALID_PAGES_CONFIG } from "../pages/errors";
import type {
	Config,
	NormalizeAndValidateConfigArgs,
	RawConfig,
	ResolveConfigPathOptions,
} from "@cloudflare/workers-utils";

export type ReadConfigCommandArgs = NormalizeAndValidateConfigArgs & {
	config?: string;
	script?: string;
};

export type ReadConfigOptions = ResolveConfigPathOptions & {
	hideWarnings?: boolean;
	// Used by the Vite plugin
	// If set to `true`, the `main` field is not converted to an absolute path
	preserveOriginalMain?: boolean;
};

export type ConfigBindingOptions = Pick<
	Config,
	| "ai"
	| "browser"
	| "d1_databases"
	| "dispatch_namespaces"
	| "durable_objects"
	| "queues"
	| "r2_buckets"
	| "services"
	| "kv_namespaces"
	| "mtls_certificates"
	| "vectorize"
	| "workflows"
	| "vpc_services"
>;

/**
 * Convert the result of experimental_readRawConfig into a Config shape that can be used across the codebase
 */
function convertRawConfigToConfig(
	args: ReadConfigCommandArgs,
	options: ReadConfigOptions = {},
	{
		rawConfig,
		configPath,
		userConfigPath,
		deployConfigPath,
		redirected,
	}: Awaited<ReturnType<typeof experimental_readRawConfig>>
): Config {
	if (redirected) {
		assert(configPath, "Redirected config found without a configPath");
		assert(
			deployConfigPath,
			"Redirected config found without a deployConfigPath"
		);
		logger.info(dedent`
				Using redirected Wrangler configuration.
				 - Configuration being used: "${path.relative(".", configPath)}"
				 - Original user's configuration: "${userConfigPath ? path.relative(".", userConfigPath) : "<no user config found>"}"
				 - Deploy configuration file: "${path.relative(".", deployConfigPath)}"
			`);
	}

	const { config, diagnostics } = normalizeAndValidateConfig(
		rawConfig,
		configPath,
		userConfigPath,
		args,
		options.preserveOriginalMain
	);

	if (diagnostics.hasWarnings() && !options?.hideWarnings) {
		logger.warn(diagnostics.renderWarnings());
	}
	if (diagnostics.hasErrors()) {
		throw new UserError(diagnostics.renderErrors());
	}

	return config;
}

/**
 * Get the Wrangler configuration; read it from the give `configPath` if available.
 */
export function readConfig(
	args: ReadConfigCommandArgs,
	options: ReadConfigOptions = {}
): Config | Promise<Config> {
	const configOrPromise = experimental_readRawConfig(args, options);
	if ("then" in configOrPromise) {
		return configOrPromise.then((raw) =>
			convertRawConfigToConfig(args, options, raw)
		);
	} else {
		return convertRawConfigToConfig(args, options, configOrPromise);
	}
}

export async function readPagesConfig(
	args: ReadConfigCommandArgs,
	options: ReadConfigOptions = {}
): Promise<
	Omit<Config, "pages_build_output_dir"> & { pages_build_output_dir: string }
> {
	let rawConfig: RawConfig;
	let configPath: string | undefined;
	let userConfigPath: string | undefined;
	let redirected: boolean;
	let deployConfigPath: string | undefined;
	try {
		({ rawConfig, configPath, userConfigPath, deployConfigPath, redirected } =
			await experimental_readRawConfig(args, options));
		if (redirected) {
			assert(configPath, "Redirected config found without a configPath");
			assert(
				deployConfigPath,
				"Redirected config found without a deployConfigPath"
			);
			logger.info(dedent`
				Using redirected Wrangler configuration.
				 - Configuration being used: "${path.relative(".", configPath)}"
				 - Original user's configuration: "${userConfigPath ? path.relative(".", userConfigPath) : "<no user config found>"}"
				 - Deploy configuration file: "${path.relative(".", deployConfigPath)}"
			`);
		}
	} catch (e) {
		logger.error(e);
		throw new FatalError(
			`Your ${configFileName(configPath)} file is not a valid Pages configuration file`,
			EXIT_CODE_INVALID_PAGES_CONFIG
		);
	}

	if (!isPagesConfig(rawConfig)) {
		throw new FatalError(
			`Your ${configFileName(configPath)} file is not a valid Pages configuration file`,
			EXIT_CODE_INVALID_PAGES_CONFIG
		);
	}

	const { config, diagnostics } = normalizeAndValidateConfig(
		rawConfig,
		configPath,
		userConfigPath,
		args
	);

	if (diagnostics.hasWarnings() && !options.hideWarnings) {
		logger.warn(diagnostics.renderWarnings());
	}
	if (diagnostics.hasErrors()) {
		throw new UserError(diagnostics.renderErrors());
	}

	logger.debug(
		`Configuration file belonging to ⚡️ Pages ⚡️ project detected.`
	);

	const envNames = rawConfig.env ? Object.keys(rawConfig.env) : [];
	const projectName = rawConfig?.name;
	const pagesDiagnostics = validatePagesConfig(config, envNames, projectName);

	if (pagesDiagnostics.hasWarnings()) {
		logger.warn(pagesDiagnostics.renderWarnings());
	}
	if (pagesDiagnostics.hasErrors()) {
		throw new UserError(pagesDiagnostics.renderErrors());
	}

	return config as Omit<Config, "pages_build_output_dir"> & {
		pages_build_output_dir: string;
	};
}
