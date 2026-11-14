/**
 * Bakes that land with the scenes that need them (DESIGN.md §8.2). Each runs as a named no-op, so
 * the pipeline's order is fixed now and each part only fills in its body.
 */
export interface StubStep {
  name: string;
  part: string;
  summary: string;
}

// none left: Part 15 filled the last (og)
export const STUB_STEPS: readonly StubStep[] = [];
