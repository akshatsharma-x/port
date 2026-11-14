import type { SceneId } from "@/lib/tier";

/** DOM → scene messages (e.g. "next slide"), so pages talk to scenes without importing their chunks. */
export const STAGE_EVENT = "retrograde:stage";

export interface StageEventDetail {
  id: SceneId;
  action: "next";
}

export function sendToScene(detail: StageEventDetail): void {
  window.dispatchEvent(new CustomEvent<StageEventDetail>(STAGE_EVENT, { detail }));
}
