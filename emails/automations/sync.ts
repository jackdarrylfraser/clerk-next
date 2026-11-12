import {
  Resend,
  type CreateAutomationOptions,
  type CreateTemplateOptions,
  type ContactProperty,
  type Template,
} from "resend";
import { automationDefinitions } from "./definitions";
import { marketingTopics } from "../../lib/marketing-topics";

function requireData<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  operation: string,
): T {
  if (result.error) {
    throw new Error(`${operation}: ${result.error.message}`);
  }

  return result.data;
}

function canonicalJson(value: unknown): string {
  const normalizeKeys = (item: unknown): unknown => {
    if (Array.isArray(item)) {
      return item.map(normalizeKeys);
    }

    if (typeof item === "object" && item !== null) {
      const entries = Object.entries(item).map(([key, child]) => [
        key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
        normalizeKeys(child),
      ]);
      entries.sort(([left], [right]) =>
        String(left).localeCompare(String(right)),
      );
      return Object.fromEntries(entries);
    }

    return item;
  };

  return JSON.stringify(normalizeKeys(value));
}

async function syncEvent(
  resend: Resend,
  definition: (typeof automationDefinitions)[number]["event"],
): Promise<void> {
  const result = await resend.events.get(definition.name);

  if (result.error?.statusCode === 404) {
    requireData(
      await resend.events.create({
        name: definition.name,
        schema: definition.schema,
      }),
      `Creating Resend event "${definition.name}"`,
    );
    console.info(`Created event: ${definition.name}`);
    return;
  }

  const existing = requireData(
    result,
    `Reading Resend event "${definition.name}"`,
  );
  if (canonicalJson(existing.schema) === canonicalJson(definition.schema)) {
    console.info(`Unchanged event: ${definition.name}`);
    return;
  }

  requireData(
    await resend.events.update(definition.name, { schema: definition.schema }),
    `Updating Resend event "${definition.name}"`,
  );
  console.info(`Updated event: ${definition.name}`);
}

async function syncMarketingTopics(resend: Resend): Promise<void> {
  for (const definition of Object.values(marketingTopics)) {
    const result = requireData(
      await resend.topics.list(),
      "Listing Resend topics",
    );
    const matches = result.data.filter(
      (topic) => topic.name === definition.name,
    );

    if (matches.length > 1) {
      throw new Error(
        `More than one Resend topic is named "${definition.name}". Resolve the duplicate before syncing.`,
      );
    }

    const existing = matches[0];
    if (existing) {
      if (existing.default_subscription !== "opt_in") {
        throw new Error(
          `Resend topic "${definition.name}" must have defaultSubscription "opt_in". This setting is immutable; create a correctly configured topic.`,
        );
      }
      console.info(`Unchanged marketing topic: ${definition.name}`);
      continue;
    }

    const created = requireData(
      await resend.topics.create({
        name: definition.name,
        description: definition.description,
        defaultSubscription: "opt_in",
      }),
      `Creating Resend topic "${definition.name}"`,
    );
    console.info(`Created marketing topic: ${definition.name} (${created.id})`);
  }
}

function templateMatches(
  existing: Template,
  definition: (typeof automationDefinitions)[number]["template"],
  from: string,
): boolean {
  const expectedVariables = (definition.variables ?? []).map((variable) => ({
    key: variable.key,
    type: variable.type,
    fallbackValue: variable.fallbackValue ?? null,
  }));
  const existingVariables = (existing.variables ?? []).map((variable) => ({
    key: variable.key,
    type: variable.type,
    fallbackValue: variable.fallback_value,
  }));

  return (
    existing.name === definition.name &&
    existing.alias === definition.alias &&
    existing.subject === definition.subject &&
    existing.text === definition.text &&
    existing.html === definition.html &&
    existing.from === from &&
    canonicalJson(existingVariables) === canonicalJson(expectedVariables)
  );
}

async function syncTemplate(
  resend: Resend,
  definition: (typeof automationDefinitions)[number]["template"],
  from: string,
): Promise<void> {
  const payload: CreateTemplateOptions = { ...definition, from };
  const result = await resend.templates.get(definition.alias);
  let templateId: string;
  let shouldPublish = false;

  if (result.error?.statusCode === 404) {
    const created = requireData(
      await resend.templates.create(payload),
      `Creating Resend template "${definition.alias}"`,
    );
    templateId = created.id;
    shouldPublish = true;
    console.info(`Created template: ${definition.alias}`);
  } else {
    const existing = requireData(
      result,
      `Reading Resend template "${definition.alias}"`,
    );
    templateId = existing.id;

    if (!templateMatches(existing, definition, from)) {
      requireData(
        await resend.templates.update(templateId, payload),
        `Updating Resend template "${definition.alias}"`,
      );
      shouldPublish = true;
      console.info(`Updated template: ${definition.alias}`);
    } else {
      shouldPublish =
        existing.status !== "published" || existing.has_unpublished_versions;
      console.info(`Unchanged template: ${definition.alias}`);
    }
  }

  if (shouldPublish) {
    requireData(
      await resend.templates.publish(templateId),
      `Publishing Resend template "${definition.alias}"`,
    );
    console.info(`Published template: ${definition.alias}`);
  }
}

async function listAutomations(resend: Resend) {
  const automations = [];
  let after: string | undefined;

  do {
    const result = requireData(
      await resend.automations.list({ limit: 100, after }),
      "Listing Resend automations",
    );
    automations.push(...result.data);

    if (!result.has_more) {
      break;
    }

    const lastId = result.data.at(-1)?.id;
    if (!lastId) {
      throw new Error(
        "Resend returned another automation page without a cursor",
      );
    }
    after = lastId;
  } while (true);

  return automations;
}

async function syncAutomation(
  resend: Resend,
  definition: (typeof automationDefinitions)[number],
  existingAutomations: Awaited<ReturnType<typeof listAutomations>>,
): Promise<void> {
  const matches = existingAutomations.filter(
    (automation) => automation.name === definition.name,
  );
  if (matches.length > 1) {
    throw new Error(
      `More than one Resend automation is named "${definition.name}". Resolve the duplicate before syncing.`,
    );
  }

  const payload: CreateAutomationOptions = {
    name: definition.name,
    status: definition.status,
    steps: definition.steps,
    connections: definition.connections,
  };
  const existing = matches[0];

  if (!existing) {
    requireData(
      await resend.automations.create(payload),
      `Creating Resend automation "${definition.name}"`,
    );
    console.info(`Created automation: ${definition.name}`);
    return;
  }

  const current = requireData(
    await resend.automations.get(existing.id),
    `Reading Resend automation "${definition.name}"`,
  );
  const unchanged =
    current.name === payload.name &&
    current.status === payload.status &&
    canonicalJson(current.steps) === canonicalJson(payload.steps) &&
    canonicalJson(current.connections) === canonicalJson(payload.connections);

  if (unchanged) {
    console.info(`Unchanged automation: ${definition.name}`);
    return;
  }

  requireData(
    await resend.automations.update(existing.id, payload),
    `Updating Resend automation "${definition.name}"`,
  );
  console.info(`Updated automation: ${definition.name}`);
}

async function syncAutomations(): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to sync email automations");
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is required to sync email automations");
  }

  const automationNames = new Set<string>();
  for (const definition of automationDefinitions) {
    if (automationNames.has(definition.name)) {
      throw new Error(
        `More than one local automation is named "${definition.name}". Use unique automation names before syncing.`,
      );
    }
    automationNames.add(definition.name);
  }

  const resend = new Resend(apiKey);
  await syncConsentContactProperties(resend);
  await syncMarketingTopics(resend);

  const events = new Map<
    string,
    (typeof automationDefinitions)[number]["event"]
  >();
  for (const definition of automationDefinitions) {
    events.set(definition.event.name, definition.event);
  }

  for (const event of events.values()) {
    await syncEvent(resend, event);
  }

  for (const definition of automationDefinitions) {
    await syncTemplate(resend, definition.template, from);
  }

  const existingAutomations = await listAutomations(resend);
  for (const definition of automationDefinitions) {
    await syncAutomation(resend, definition, existingAutomations);
  }
}

await syncAutomations();
