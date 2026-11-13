import type {
  AutomationConnection,
  AutomationStep as ResendAutomationStep,
  AutomationStatus,
  CreateTemplateOptions,
  EventSchemaMap,
} from "resend";

type AutomationFilterRule =
  | {
      type: "rule";
      field: string;
      operator: "eq" | "neq";
      value: string | number | boolean | null | { var: string };
    }
  | {
      type: "rule";
      field: string;
      operator: "gt" | "gte" | "lt" | "lte";
      value: number | { var: string };
    }
  | {
      type: "rule";
      field: string;
      operator: "contains" | "starts_with" | "ends_with";
      value: string | { var: string };
    }
  | {
      type: "rule";
      field: string;
      operator: "exists" | "is_empty";
    }
  | {
      type: "and" | "or";
      rules: AutomationFilterRule[];
    };

type AutomationWaitForEventStep = Omit<
  Extract<ResendAutomationStep, { type: "wait_for_event" }>,
  "config"
> & {
  config: Omit<
    Extract<ResendAutomationStep, { type: "wait_for_event" }>["config"],
    "filterRule"
  > & {
      filterRule?: AutomationFilterRule;
  };
};

export type AutomationDefinitionStep =
  | Exclude<ResendAutomationStep, { type: "wait_for_event" }>
  | AutomationWaitForEventStep;

export type AutomationDefinition = {
  name: string;
  purpose: string;
  status: AutomationStatus;
  event: {
    name: string;
    schema: EventSchemaMap;
  };
  template: {
    name: string;
    alias: string;
    subject: string;
    text: string;
    html: string;
    variables?: NonNullable<CreateTemplateOptions["variables"]>;
  };
  steps: AutomationDefinitionStep[];
  connections: AutomationConnection[];
};
