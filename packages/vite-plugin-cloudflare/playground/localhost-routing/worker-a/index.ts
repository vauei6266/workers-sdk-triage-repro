import { WorkerEntrypoint } from "cloudflare:workers";

export class Greet extends WorkerEntrypoint {
	override fetch() {
		return Response.json({ greet: "Hello from worker-a" });
	}
}

export class Farewell extends WorkerEntrypoint {
	override fetch() {
		return Response.json({ farewell: "Goodbye from worker-a" });
	}
}

export default {
	fetch() {
		return Response.json({ worker: "worker-a default" });
	},
} satisfies ExportedHandler;
