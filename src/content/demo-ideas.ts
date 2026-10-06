/** Five ideas, across all three stages, for a board that has nothing in it (previews and local runs started with PUBLIC_DEMO_IDEAS=1).
 *  A real board never gets them. Pure: the clock comes in. */
import type { Idea } from "../lib/ideas";

const HOUR = 3_600_000;
const demo = (id: string, name: string, message: string, stage: Idea["stage"], hoursAgo: number, now: number, categories: string[]): Idea =>
  ({ id, name, message, stage, at: now - hoursAgo * HOUR, links: [], categories });

export const demoIdeas = (now: number): Idea[] => [
  demo("demo001", "Steve Gates", "A tool library for the block: borrow a drill instead of buying one.", "idea", 30, now, ["city-places", "social-good"]),
  demo("demo002", "Maya", "Pocket-sized weather station that texts you when to bring the laundry in.", "idea", 20, now, ["tech", "environment"]),
  demo("demo003", "Dev", "Open-source app that turns a voice memo into a clean to-do list.", "implementation", 14, now, ["tech"]),
  demo("demo004", "Lena", "A bike lane map made by riders, with the potholes marked.", "implementation", 8, now, ["city-places", "health"]),
  demo("demo005", "Omar", "Neighbourhood meal swap: cook once, trade a portion with someone nearby.", "live", 2, now, ["food-drink", "social-good"]),
];
