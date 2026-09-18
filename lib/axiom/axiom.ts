import { Axiom, AxiomWithoutBatching } from "@axiomhq/js";

export const axiomClient: Axiom | AxiomWithoutBatching | undefined = process.env
  .AXIOM_TOKEN
  ? new Axiom({ token: process.env.AXIOM_TOKEN })
  : undefined;

export default axiomClient;