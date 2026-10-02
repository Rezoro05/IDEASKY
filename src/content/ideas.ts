/** The ideas flying in the hero. Order = plane numbers (01, 02 ...). Adding an idea = adding one entry. */

export type Fact = readonly [label: string, value: string | readonly string[]];
export type Media = { src: string; w: number; h: number; alt: string; caption: string; wide?: boolean };
export type Idea = {
  slug: string;
  title: string;
  year: string; // "—" when undated
  line: string; // one-line summary for the list
  lede: string;
  facts: readonly Fact[];
  url?: string;
  urlLabel?: string;
  icon?: string;
  media?: readonly Media[];
};

export const IDEAS: readonly Idea[] = [
  {
    slug: "econsul", title: "eConsul", year: "2022", line: "Georgia's largest visa and immigration tech startup.",
    icon: "ideas/econsul-icon.png", url: "https://econsul.io/en", urlLabel: "econsul.io",
    lede: "Founded and scaled the largest visa and immigration tech startup in Georgia to $500K+ annual revenue and 22 people, profitable within 3 months.",
    facts: [
      ["Role", "🚀 Co-Founder · 💡 Head of Product"],
      ["Scale", "$500K+ annual revenue · 22 people · 10K+ users surveyed"],
      ["Quality", "NPS 79 · 17% fewer application errors · 30% faster Time-to-Yes"],
      ["Recognition", [
        "Nominee, Tourism Tech Innovation · National Tourism Awards Georgia (2026)",
        "Winner, Tourism Tech Innovation of the Year (2024)",
        "GITA top startup, $60K grant (2022)",
        "Start-up Challenge winner: TBC Bank’s internal competition among employees (2021)",
      ]],
    ],
    media: [
      { src: "ideas/econsul-team.jpg", w: 1400, h: 934, alt: "The eConsul team, about twenty people, posing together in a sunlit forest", caption: "The eConsul team", wide: true },
      { src: "ideas/econsul-nta-2026.jpg", w: 900, h: 1125, alt: "National Tourism Awards Georgia 2026 poster naming eConsul a nominee for Tourism Tech Innovation", caption: "Nominee, Tourism Tech Innovation · National Tourism Awards Georgia 2026" },
    ],
  },
  {
    slug: "ephoto", title: "ePhoto.AI", year: "2024", line: "A digital photo booth in your pocket: official ID photos in under a minute.",
    url: "https://ephoto.ai/", urlLabel: "ephoto.ai",
    lede: "A digital photo booth in your pocket. ePhoto.AI turns an everyday portrait into an official document photo: it removes the background, fits the photo to each country's rules and checks compliance before you download, all in under a minute. Built from scratch as a daughter startup of eConsul.",
    facts: [
      ["Role", "🚀 Co-Founder · 💡 Head of Product"],
      ["Traction", "8,000+ headshots processed · 8K+ users in the first year"],
      ["Coverage", "Passports, visas and IDs for 200+ countries"],
      ["Speed", "Under a minute from photo to preview"],
      ["Tech", "ML background removal and auto-sizing (CTO: Grigol)"],
      ["Principles", "Private by design · Clear compliance feedback · Digital + print ready"],
      ["How it works", [
        "Pick the country and document",
        "Upload an everyday portrait",
        "The background is removed and the photo is sized to the rules",
        "Review plain-language checks for background, position and quality",
        "Pay and download, ready for digital or print",
      ]],
    ],
    media: [{ src: "ideas/ephoto-booth.jpg", w: 1600, h: 909, alt: "ePhoto.AI promo: a phone showing a portrait framed as an ID photo, with the line Digital photo booth in your pocket", caption: "Digital photo booth in your pocket" }],
  },
  {
    slug: "greencard", title: "greencard.ge", year: "—", line: "Fill & Win: the US Green Card lottery in one place.",
    url: "https://greencard.ge/en", urlLabel: "greencard.ge",
    lede: "Everything you need for the US Green Card lottery in one place: fill out the application, take the official photo on your phone, and pay. The mission is to make the lottery accessible to everyone and create equal opportunities with technology. A sub-business of eConsul. I was a beta tester, and I won.",
    facts: [
      ["Role", "🚀 Co-Founder · 💡 Head of Product"],
      ["Traction", "10K+ users · customer base up 120% in 2 years"],
      ["Tagline", "Fill & Win"],
      ["Press", "Featured in Forbes Georgia and Entrepreneur Georgia"],
      ["How it works", [
        "Fill out the application once and reuse it every year until you win",
        "Take the official photo at home with your phone",
        "Pay, and get status checks and support for winners",
      ]],
    ],
  },
  {
    slug: "momo", title: "Momo", year: "2018", line: "Hackathon winner at Idea for Tbilisi.",
    lede: "Winning project at the Idea for Tbilisi 2018 hackathon. Full write-up coming.",
    facts: [["Result", "1st place, Idea for Tbilisi 2018 · 3,000 GEL prize"], ["Status", "Details to be added"]],
    media: [{ src: "about/award-idea-for-tbilisi-2018.jpg", w: 720, h: 960, alt: "Two team members holding the Idea for Tbilisi first-place cheque for 3,000 GEL in front of an Innovation wall", caption: "Idea for Tbilisi 2018 · 1st place" }],
  },
];

export const IDEA_SLUGS = IDEAS.map((i) => i.slug);
export const ideaBySlug = (slug: string): Idea | undefined => IDEAS.find((i) => i.slug === slug);
