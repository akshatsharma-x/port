/**
 * Gives the main thread back between the steps of a long job (DESIGN.md §8.3 TBT): a task ends
 * here and the job continues in the next one, so the browser can handle input and paint between.
 * scheduler.yield() where it exists (it keeps the job's priority), else a macrotask.
 */
export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof s?.yield === "function") return s.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
