/**
 * Local ESLint plugin: DESIGN.md rules that a linter can enforce.
 *
 *  retrograde/spacing-steps — Tailwind spacing utilities may only use the DESIGN.md §2.7 steps
 *    (0 1 2 3 4 6 8 12 16 24 32 48 64 units of 4 px), `px`, `0.5` (the 2 px surface gap),
 *    the fluid tokens (gutter, margin, block, section-y, hud-inset) or a token reference
 *    like `p-(--gutter)`. `p-5`, `mt-7`, `gap-[13px]` fail.
 *  retrograde/no-raw-color — no hex/rgb/hsl/oklch literals in className or style: colors come
 *    from styles/tokens.css (Global Rules #2).
 *
 * Both rules read className/class attributes (string, template, conditional, logical and
 * cx(...) expressions) and calls to cx(...).
 */

const PREFIXES = [
  "scroll-mx", "scroll-my", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml", "scroll-ms", "scroll-me", "scroll-m",
  "scroll-px", "scroll-py", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl", "scroll-ps", "scroll-pe", "scroll-p",
  "translate-x", "translate-y", "space-x", "space-y", "gap-x", "gap-y", "gap", "inset-x", "inset-y", "inset",
  "px", "py", "pt", "pr", "pb", "pl", "ps", "pe", "p",
  "mx", "my", "mt", "mr", "mb", "ml", "ms", "me", "m",
  "top", "right", "bottom", "left", "start", "end",
];
const SPACING = new RegExp(`^(-)?(${PREFIXES.join("|")})-(.+)$`);
const STEPS = new Set(["0", "1", "2", "3", "4", "6", "8", "12", "16", "24", "32", "48", "64"]);
const KEYWORDS = new Set(["px", "0.5", "auto", "full", "reverse", "gutter", "margin", "block", "section-y", "hud-inset"]);
const NOT_SPACING = /^(shadow|ring)(-|$)/; // inset-shadow-*, inset-ring-* are not spacing

/** Returns the offending value for a single class token, or null if it is allowed / not spacing. */
export function spacingViolation(token) {
  const bare = token.split(":").pop().replace(/^!/, "").replace(/!$/, "");
  const m = SPACING.exec(bare);
  if (!m) return null;
  const value = m[3];
  if (NOT_SPACING.test(value)) return null;
  if (STEPS.has(value) || KEYWORDS.has(value)) return null;
  if (/^\d+\/\d+$/.test(value)) return null; // fractions: top-1/2, translate-x-1/2
  if (/^\(--[\w-]+\)$/.test(value) || /^\[var\(--[\w-]+\)\]$/.test(value)) return null; // token refs
  return value;
}

const RAW_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;

function collectStrings(node, out) {
  if (!node) return;
  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") out.push({ node, value: node.value });
      break;
    case "TemplateLiteral":
      for (const q of node.quasis) out.push({ node: q, value: q.value.cooked ?? "" });
      for (const e of node.expressions) collectStrings(e, out);
      break;
    case "JSXExpressionContainer":
      collectStrings(node.expression, out);
      break;
    case "ConditionalExpression":
      collectStrings(node.consequent, out);
      collectStrings(node.alternate, out);
      break;
    case "LogicalExpression":
    case "BinaryExpression":
      collectStrings(node.left, out);
      collectStrings(node.right, out);
      break;
    case "CallExpression":
      for (const a of node.arguments) collectStrings(a, out);
      break;
    case "ArrayExpression":
      for (const el of node.elements) collectStrings(el, out);
      break;
    case "ObjectExpression":
      for (const p of node.properties) if (p.type === "Property") collectStrings(p.value, out);
      break;
    default:
      break;
  }
}

const isClassAttr = (attr) => attr.name && attr.name.type === "JSXIdentifier" && (attr.name.name === "className" || attr.name.name === "class");
const isCxCall = (node) => node.callee && node.callee.type === "Identifier" && node.callee.name === "cx";

const spacingSteps = {
  meta: {
    type: "problem",
    docs: { description: "Only DESIGN.md §2.7 spacing steps in Tailwind spacing utilities" },
    messages: {
      step: "`{{token}}` uses spacing value `{{value}}`. Allowed: 0 1 2 3 4 6 8 12 16 24 32 48 64, px, 0.5, gutter, margin, block, section-y, hud-inset or (--token). (DESIGN.md §2.7)",
    },
    schema: [],
  },
  create(context) {
    function check(strings) {
      for (const { node, value } of strings) {
        for (const token of value.split(/\s+/)) {
          if (!token) continue;
          const bad = spacingViolation(token);
          if (bad) context.report({ node, messageId: "step", data: { token, value: bad } });
        }
      }
    }
    return {
      JSXAttribute(attr) {
        if (!isClassAttr(attr)) return;
        const out = [];
        collectStrings(attr.value, out);
        check(out);
      },
      CallExpression(node) {
        if (!isCxCall(node)) return;
        // cx() inside className is already covered by the JSXAttribute visitor
        let p = node.parent;
        while (p) {
          if (p.type === "JSXAttribute" && isClassAttr(p)) return;
          p = p.parent;
        }
        const out = [];
        for (const a of node.arguments) collectStrings(a, out);
        check(out);
      },
    };
  },
};

const noRawColor = {
  meta: {
    type: "problem",
    docs: { description: "Colors come from styles/tokens.css, never literals in className/style" },
    messages: {
      raw: "Raw color `{{match}}` in {{where}}. Use a token (bg-accent, text-fg-2, var(--line-2)…). (Global Rules #2)",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(attr) {
        const name = attr.name && attr.name.type === "JSXIdentifier" ? attr.name.name : null;
        if (name !== "className" && name !== "class" && name !== "style") return;
        const out = [];
        collectStrings(attr.value, out);
        for (const { node, value } of out) {
          const m = RAW_COLOR.exec(value);
          if (m) context.report({ node, messageId: "raw", data: { match: m[0], where: name } });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "retrograde", version: "1.0.0" },
  rules: { "spacing-steps": spacingSteps, "no-raw-color": noRawColor },
};

export default plugin;
