import { readFile } from "node:fs/promises";

const contractPath = new URL("../contracts/a2a.json", import.meta.url);
const contract = JSON.parse(await readFile(contractPath, "utf8"));

function requireContract(condition, message) {
  if (!condition) throw new Error(`Invalid A2A consumer contract: ${message}`);
}

requireContract(
  contract.contract === "contextrocket.a2a.consumer.v1",
  "unexpected contract identifier",
);
requireContract(contract.protocolVersion === contract.requestHeaders["A2A-Version"], "protocol header mismatch");
requireContract(
  contract.discovery.typedCardPaths.includes("/company/{handle}/agent-card.json") &&
    contract.discovery.typedCardPaths.includes("/person/{handle}/agent-card.json"),
  "typed company and person card routes must be recorded",
);
requireContract(
  contract.discovery.cardConsumes.includes("skills[].examples[]"),
  "widget AgentCard example consumption is undocumented",
);
requireContract(
  contract.requestMethods.includes("SendMessage") &&
    contract.requestMethods.includes("SendStreamingMessage"),
  "both sync and streaming sends must be represented",
);

for (const [name, paths] of Object.entries({
  card: contract.discovery.cardReads,
  request: contract.requestReads,
  task: contract.taskReads,
  status: contract.streamReads.status,
  artifact: contract.streamReads.artifact,
})) {
  const sample = name === "status" || name === "artifact"
    ? contract.values.stream[name]
    : contract.values[name];
  for (const path of paths) {
    requireContract(Object.hasOwn(sample, path), `missing ${name} sample for ${path}`);
  }
}

const sdkClient = await readFile(new URL("../packages/sdk/src/a2a-client.ts", import.meta.url), "utf8");
const embedCardReader = await readFile(new URL("../packages/embed-chat/src/element.ts", import.meta.url), "utf8");
for (const method of contract.requestMethods) {
  requireContract(sdkClient.includes(`"${method}"`), `SDK no longer emits ${method}`);
}
requireContract(embedCardReader.includes("(skill as Record<string, unknown>).examples"), "widget no longer reads skill examples");
console.log("A2A consumer contract is valid and matches the SDK entry points.");
