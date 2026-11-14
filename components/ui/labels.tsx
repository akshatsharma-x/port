"use client";

import { createContext, useContext } from "react";

/**
 * The few words client primitives say on their own — a screen reader's "(opens in a new tab)" after
 * a Button that opens one — from the content, provided once at the root (app/layout.tsx →
 * Providers), so no component carries copy (Global Rule 3).
 */
export interface UiLabels {
  newTab: string;
}

const UiLabelsContext = createContext<UiLabels>({ newTab: "" });
export const UiLabelsProvider = UiLabelsContext.Provider;
export const useUiLabels = (): UiLabels => useContext(UiLabelsContext);
