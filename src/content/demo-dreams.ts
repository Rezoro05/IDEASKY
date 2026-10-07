/** Example dreams for an empty sea (previews and local runs with PUBLIC_DEMO_IDEAS=1); a real board never gets them.
 *  Themes are set, so schools show: two flyers, three water dreams, a pair of places, and loners. Pure: the clock comes in. */
import type { Idea } from "../lib/ideas";

const HOUR = 3_600_000;
const dream = (id: string, name: string, message: string, hoursAgo: number, now: number, categories: string[]): Idea =>
  ({ id, name, message, stage: "idea", at: now - hoursAgo * HOUR, links: [], categories, kind: "dream" });

export const demoDreams = (now: number): Idea[] => [
  dream("dream001", "Anonymous", "I could fly if I ran fast enough down the hill, and the whole town watched from their roofs.", 40, now, ["flying", "places"]),
  dream("dream002", "Nino", "I was floating above the clouds and could hear my grandmother calling me for dinner.", 33, now, ["flying", "people"]),
  dream("dream003", "Anonymous", "The subway filled with warm sea water and everyone kept reading their phones.", 28, now, ["water", "strange"]),
  dream("dream004", "Sam", "I could breathe underwater and a whale showed me the way home.", 21, now, ["water", "animals"]),
  dream("dream005", "Anonymous", "A tide came in through my bedroom window, slowly, like it was looking for something.", 16, now, ["water"]),
  dream("dream006", "Lena", "My old school had a hundred floors and my classroom kept moving to a new one.", 12, now, ["places", "lost"]),
  dream("dream007", "Anonymous", "Every door in my house opened onto a different city.", 7, now, ["places", "strange"]),
  dream("dream008", "Omar", "Something was following me through a forest of streetlights.", 3, now, ["chased", "nightmare"]),
];
