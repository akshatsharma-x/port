import type { Rule } from "eslint";

declare const plugin: {
  meta: { name: string; version: string };
  rules: { "spacing-steps": Rule.RuleModule; "no-raw-color": Rule.RuleModule };
};
export default plugin;
export declare function spacingViolation(token: string): string | null;
