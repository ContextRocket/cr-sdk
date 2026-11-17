import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
  requireContract(
    new RegExp(`buildJSONRPCRequest\\(\\s*["']${method}["']`).test(sdkClient),
    `SDK no longer emits ${method}`,
  );
}
requireContract(embedCardReader.includes("(skill as Record<string, unknown>).examples"), "widget no longer reads skill examples");

// --- Credentials and handle resolution (contracts/publishable-key.json) ------
const credentialsContract = JSON.parse(
  await readFile(new URL("../contracts/publishable-key.json", import.meta.url), "utf8"),
);

function requireCredentials(condition, message) {
  if (!condition) throw new Error(`Invalid credentials contract: ${message}`);
}

const publishToken = credentialsContract.credentials.publish_token;
const websiteKey = credentialsContract.credentials.publishable_website_key;
requireCredentials(
  credentialsContract.schema_version === "cr.sdk-credentials-contract.v1",
  "unexpected contract identifier",
);
requireCredentials(publishToken.env === "CR_API_TOKEN", "publish token env moved");
requireCredentials(
  publishToken.header === `authorization: Bearer <token>`,
  "publish token transport or header moved",
);
requireCredentials(
  websiteKey.kind === "api_key (or demo)" &&
    websiteKey.scope_token === "chat" &&
    websiteKey.origin_bound === true &&
    websiteKey.grants_org_membership === false,
  "the publishable website key must stay origin-bound, chat-scoped and non-authorizing",
);
requireCredentials(
  publishToken.kind_today === "standard" &&
    publishToken.kind_future === "site_publish",
  "the publish credential kinds drifted from the ContextRocket registry",
);
requireCredentials(
  credentialsContract.handle_resolution.order.join(">") ===
    "explicit --org>CR_ORG_HANDLE>PUBLIC_CONTEXTROCKET_HANDLE>config/site.json -> contextrocket.handle",
  "handle resolution order moved",
);

const publisherConfig = await readFile(
  new URL("../packages/site-publisher/src/config.ts", import.meta.url),
  "utf8",
);
const publisherClient = await readFile(
  new URL("../packages/site-publisher/src/client.ts", import.meta.url),
  "utf8",
);
requireCredentials(
  /if \(explicit\?\.trim\(\)\) return explicit/.test(publisherConfig) &&
    publisherConfig.includes("env.CR_ORG_HANDLE ?? env.PUBLIC_CONTEXTROCKET_HANDLE") &&
    publisherConfig.includes("config/site.json"),
  "the publisher no longer resolves the handle in the contracted order",
);
requireCredentials(
  /authorization: `Bearer \$\{/.test(publisherClient),
  "the publisher no longer sends the contracted Bearer authorization header",
);
requireCredentials(
  publisherClient.includes("/crk_[A-Za-z0-9_-]+/g"),
  "the publisher no longer redacts crk_ values",
);
console.log("Credentials contract is valid and matches the site publisher.");

const root = new URL("../", import.meta.url);
for (const sibling of ["cr-starter", "cr-kleos"]) {
  const siblingRoot = new URL(`../${sibling}/`, root);
  if (!existsSync(new URL("contracts/embed-chat.json", siblingRoot))) {
    console.log(`Skipping ${sibling} embed contract; sibling checkout is absent.`);
    continue;
  }
  const check = spawnSync(
    process.execPath,
    ["scripts/check-embed-consumer-contract.mjs"],
    { cwd: fileURLToPath(siblingRoot), encoding: "utf8" },
  );
  if (check.stdout) process.stdout.write(check.stdout);
  if (check.stderr) process.stderr.write(check.stderr);
  requireContract(check.status === 0, `${sibling} embed contract check failed`);
}
console.log("A2A consumer contract is valid and matches the SDK entry points.");
