/** Build-time only: which of the two builds is running (see astro.config.mjs). */
import { hrefFor, type UrlMode } from "./lib/routing";

export const PREVIEW: boolean = process.env.SITE_MODE === "preview";
export const URL_MODE: UrlMode = PREVIEW ? { kind: "hash" } : { kind: "paths", base: "/" };
export const href = (name: string): string => hrefFor(name, URL_MODE);
