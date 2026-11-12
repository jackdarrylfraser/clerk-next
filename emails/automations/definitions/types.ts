import type {
  AutomationConnection,
  AutomationStatus,
  AutomationStep,
  CreateTemplateOptions,
  EventSchemaMap,
} from "resend";

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
  steps: AutomationStep[];
  connections: AutomationConnection[];
};
