import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import retrograde from "../eslint-rules/retrograde.mjs";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run("retrograde/spacing-steps", retrograde.rules["spacing-steps"], {
  valid: [
    { code: `<div className="p-4 md:px-6 gap-gutter -mt-8 inset-0 top-1/2 translate-x-full space-x-reverse" />` },
    { code: `<div className="py-section-y px-margin gap-x-3 gap-y-12 scroll-mt-16 p-px m-0.5" />` },
    { code: `<div className="inset-shadow-sm inset-ring p-(--gutter) m-[var(--block)] w-7 h-5 max-w-[38ch]" />` },
    { code: `<div className={cx("p-2", on && "mt-24", \`gap-\${"4"}\`)} />` },
  ],
  invalid: [
    { code: `<div className="p-5" />`, errors: [{ messageId: "step" }] },
    { code: `<div className="md:mt-7 hover:gap-[13px]" />`, errors: [{ messageId: "step" }, { messageId: "step" }] },
    { code: `<div className={on ? "px-10" : "px-4"} />`, errors: [{ messageId: "step" }] },
    { code: `const c = cx("-mb-9");`, errors: [{ messageId: "step" }] },
  ],
});

tester.run("retrograde/no-raw-color", retrograde.rules["no-raw-color"], {
  valid: [
    { code: `<div className="bg-accent text-fg-2" style={{ boxShadow: "inset 0 0 0 1px var(--line-2)" }} />` },
    { code: `<a href="#work" />` },
  ],
  invalid: [
    { code: `<div style={{ color: "#FF0000" }} />`, errors: [{ messageId: "raw" }] },
    { code: `<div className="bg-[#123456]" />`, errors: [{ messageId: "raw" }] },
    { code: `<div style={{ background: "oklch(50% 0.1 20)" }} />`, errors: [{ messageId: "raw" }] },
  ],
});
