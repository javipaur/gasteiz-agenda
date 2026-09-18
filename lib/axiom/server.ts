import { Logger, AxiomJSTransport, ConsoleTransport, Transport } from "@axiomhq/logging";
import { createAxiomRouteHandler, nextJsFormatters } from "@axiomhq/nextjs";
import axiomClient from "./axiom";

export const AXIOM_DATASET = process.env.AXIOM_DATASET || "gasteiz-agenda";

const transports: [Transport, ...Transport[]] = [new ConsoleTransport({ prettyPrint: true })];

if (process.env.AXIOM_TOKEN && axiomClient) {
  transports.push(
    new AxiomJSTransport({
      axiom: axiomClient,
      dataset: AXIOM_DATASET,
    })
  );
}

export const logger = new Logger({
  transports,
  formatters: nextJsFormatters,
});

export const withAxiom = createAxiomRouteHandler(logger);