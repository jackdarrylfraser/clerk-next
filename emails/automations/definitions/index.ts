import { leadEducationDefinition } from "./lead-education";
import { subscriptionWelcomeDefinition } from "./subscription-welcome";
import type { AutomationDefinition } from "./types";

export type { AutomationDefinition } from "./types";
export { leadEducationDefinition, subscriptionWelcomeDefinition };

export const automationDefinitions: AutomationDefinition[] = [
  leadEducationDefinition,
  subscriptionWelcomeDefinition,
];
