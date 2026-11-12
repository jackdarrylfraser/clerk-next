export const marketingTopics = {
  educational: {
    name: "Marketing",
    description:
      "Educational information and marketing updates requested through the lead form.",
    consentVersion: "educational-emails-v1",
  },
} as const;

export type MarketingTopicKey = keyof typeof marketingTopics;

export const defaultMarketingTopicKey: MarketingTopicKey = "educational";

export function isMarketingTopicKey(value: string): value is MarketingTopicKey {
  return Object.hasOwn(marketingTopics, value);
}
