/**
 * True when a key press is text entry, not a shortcut: a text field, a textarea, a select, an
 * editable region, or a surface that takes typed keys (`data-keys="capture"`). A focused radio, checkbox or button is not text entry — G, S and the scroll keys
 * still belong to the page there (the front panel's TUBE switch is a radio group).
 */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // a surface that takes typed keys itself (CAPABILITIES' keycaps: type a skill's name)
  if (target.isContentEditable || target.closest("[data-keys='capture']")) return true;
  return target.closest("input:not([type='radio'], [type='checkbox'], [type='button'], [type='submit'], [type='reset'], [type='range'], [type='color']), textarea, select, [role='textbox']") !== null;
}
