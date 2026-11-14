import { contentWarnings } from "../../content/checks";
import { data } from "../../content/data";
import { ContentError, parseContent, type Content } from "../../content/schema";
import { BakeError, ROOT } from "./lib";

/** validate — parse content/data.ts strictly; every problem is listed with its path, then the build stops. */
export function validateStep(warn: (message: string) => void): { content: Content; summary: string } {
  let content: Content;
  try {
    content = parseContent(data);
  } catch (error) {
    if (error instanceof ContentError) throw new BakeError(error.message);
    throw error;
  }
  for (const w of contentWarnings(content, ROOT)) warn(`${w.area}: ${w.message}`);
  const c = content;
  const summary = [
    `${c.publications.length} papers`,
    `${c.projects.length} projects`,
    `${c.experience.length} roles`,
    `${c.skills.length} skills`,
    `${c.certificates.length} certs`,
    `${c.achievements.length} records`,
    `${c.testimonials.length} quotes`,
  ].join(" · ");
  return { content, summary: c.isPlaceholder ? `${summary} · PLACEHOLDER` : summary };
}
