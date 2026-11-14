/** What the chrome needs of a section (handed over as props: content stays on the server). */
export interface ChromeSection {
  id: string;
  index: number;
  code: string;
  title: string;
}

export const sectionLabel = (s: Pick<ChromeSection, "index" | "code">): string => `${String(s.index).padStart(2, "0")} ${s.code}`;
