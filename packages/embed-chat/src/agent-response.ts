import type { AgentResponseSpec } from "./types";

const CATALOG = "contextrocket.agent.response.v2";
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/;
const forbiddenIds = new Set(["__proto__", "prototype", "constructor"]);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validId = (value: unknown): value is string =>
  typeof value === "string" && ID.test(value) && !forbiddenIds.has(value);
const validText = (value: unknown, max: number, allowEmpty = false): value is string =>
  typeof value === "string" && value.length <= max && (allowEmpty || Boolean(value.trim()));

function validProps(type: string, props: unknown): boolean {
  if (!record(props)) return false;
  const keys = Object.keys(props).sort().join(",");
  if (type === "Evidence") return keys === "refs" && Array.isArray(props.refs) && props.refs.length > 0 && props.refs.length <= 20 && props.refs.every((ref) => record(ref) && Object.keys(ref).every((key) => key === "title" || key === "excerpt") && validText(ref.title, 160) && (ref.excerpt === undefined || validText(ref.excerpt, 500, true)));
  if (type === "Progress") return keys === "completed,stage,total" && validText(props.stage, 240) && ((props.completed === null && props.total === null) || (Number.isInteger(props.completed) && Number.isInteger(props.total) && (props.completed as number) >= 0 && (props.total as number) > 0 && (props.completed as number) <= (props.total as number)));
  if (type === "Question") return ["id,interactionId,question,questionId", "id,inputRef,interactionId,question,questionId"].includes(keys) && validId(props.id) && validId(props.interactionId) && validId(props.questionId) && validText(props.question, 1000) && (props.inputRef === undefined || record(props.inputRef));
  if (type === "ProposalBatch") return keys === "views" && Array.isArray(props.views) && props.views.length > 0 && props.views.length <= 10 && props.views.every((view) => record(view) && Object.keys(view).sort().join(",") === "id,summary,workItemId" && validId(view.id) && validId(view.workItemId) && validText(view.summary, 280, true)) && new Set(props.views.map((view) => (view as Record<string, unknown>).id)).size === props.views.length;
  if (type === "Representation") return keys === "id,organizationId,representationId" && validId(props.id) && validId(props.organizationId) && validId(props.representationId);
  return false;
}

/** Accept only the bounded, closed response catalog emitted by the A2A API. */
export function parseAgentResponsePart(part: unknown): AgentResponseSpec | null | undefined {
  if (!record(part) || !record(part.metadata) || !Object.prototype.hasOwnProperty.call(part, "data")) return undefined;
  if (part.kind !== "data") return undefined;
  if (part.metadata["cr.catalog"] !== CATALOG || part.metadata["cr.component"] !== "agent_ui") return undefined;
  const data = part.data;
  if (!record(data) || Object.keys(data).sort().join(",") !== "component,spec" || data.component !== "agent_ui") return null;
  try {
    if (new TextEncoder().encode(JSON.stringify(data)).length > 65_536) return null;
  } catch { return null; }
  const spec = data.spec;
  if (!record(spec) || Object.keys(spec).sort().join(",") !== "elements,root" || spec.root !== "response" || !record(spec.elements)) return null;
  const elements = spec.elements;
  const ids = Object.keys(elements);
  if (ids.length < 2 || ids.length > 33 || !ids.every(validId)) return null;
  const root = elements.response;
  if (
    !record(root) ||
    Object.keys(root).sort().join(",") !== "children,props,type" ||
    root.type !== "Response" ||
    !record(root.props) ||
    Object.keys(root.props).length !== 0 ||
    !Array.isArray(root.children)
  ) return null;

  const children: string[] = [];
  for (const id of root.children) {
    if (!validId(id)) return null;
    children.push(id);
  }
  if (
    new Set(children).size !== children.length ||
    children.length !== ids.length - 1 ||
    children.some((id) => !Object.prototype.hasOwnProperty.call(elements, id)) ||
    ids.some((id) => id !== "response" && !children.includes(id))
  ) return null;

  for (const id of children) {
    const child = elements[id];
    if (!record(child) || Object.keys(child).sort().join(",") !== "children,props,type" || !Array.isArray(child.children) || child.children.length !== 0 || typeof child.type !== "string" || !validProps(child.type, child.props)) return null;
  }
  return spec as unknown as AgentResponseSpec;
}
