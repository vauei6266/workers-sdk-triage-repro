import { WorkerEntrypoint } from "cloudflare:workers";

export class Echo extends WorkerEntrypoint {
	override fetch(request: Request) {
		const url = new URL(request.url);
		return Response.json({ echo: url.pathname });
	}
}

export default {
	fetch() {
		return Response.json({ worker: "worker-b default" });
	},
} satisfies ExportedHandler;
