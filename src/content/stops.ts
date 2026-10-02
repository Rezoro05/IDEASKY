/** About page: "The path so far". Each stop is a point on the line and the panel it opens. */

export type Award = readonly [medal: string, what: string, year: string];
export type Photo = { src: string; alt: string; caption: string; w: number; h: number };
/** A panel link goes to a view ("craft", "home") or opens an idea ("econsul"). */
export type PanelLink = readonly [target: string, label: string];
export type Branch = { target: string; name: string; desc: string };
export type Stop = {
  id: string;
  /** Shown on the line */
  year: string;
  name: string;
  desc: string;
  isNow?: boolean;
  branches?: readonly Branch[];
  /** Shown in the panel */
  title: string;
  when: string;
  role: string;
  text?: string;
  bullets?: readonly string[];
  awards?: readonly Award[];
  photo?: Photo;
  links?: readonly PanelLink[];
};

export const STOPS: readonly Stop[] = [
  {
    id: "pcmania", year: "2010", name: "PCmania", desc: "Tech education site · Silver at Infomatrix",
    title: "PCmania", when: "2010", role: "Co-founder, with my hacker friend Devi",
    text: "Georgia’s first tech education website, born from gaming and reinstalling Windows for neighbors.",
    awards: [["Silver", "Infomatrix, international computer olympiad · Bucharest", "2010"]],
    photo: { src: "about/award-infomatrix-2010.jpg", alt: "Two students with medals on stage at Infomatrix 2010 in Bucharest", caption: "Infomatrix 2010, Bucharest", w: 720, h: 540 },
  },
  {
    id: "abk", year: "2016–19", name: "ABK agency", desc: "Creative strategy and production · Cannes Young Lions",
    title: "ABK agency", when: "2016–19", role: "Account manager → creative strategist and production manager",
    text: "20+ productions for brands and public campaigns. I learned how to make an idea land with real people, on a real budget, by a real deadline.",
    awards: [["Studio award", "Design Studio of the Year, with the ABK team", "2017"], ["Silver · Bronze", "Cannes Young Lions Georgia, Print", "2016–17"]],
    photo: { src: "about/abk-design-studio-2017.jpg", alt: "ABK’s Design Studio of the Year 2017 trophy on a desk next to the ABK Communication box", caption: "ABK · Design Studio of the Year 2017", w: 1400, h: 789 },
    links: [["craft", "See the work in Craft →"]],
  },
  {
    id: "momo", year: "2018", name: "Momo", desc: "Idea for Tbilisi hackathon · 1st place",
    title: "Momo", when: "2018", role: "Hackathon team",
    text: "Winning project at the Idea for Tbilisi hackathon.",
    awards: [["1st place", "Idea for Tbilisi hackathon · 3,000 GEL prize", "2018"]],
    photo: { src: "about/award-idea-for-tbilisi-2018.jpg", alt: "Holding the Idea for Tbilisi first-place cheque, 3,000 GEL", caption: "Idea for Tbilisi 2018", w: 720, h: 960 },
    links: [["momo", "Open Momo →"]],
  },
  {
    id: "tbc", year: "2021", name: "TBC Bank", desc: "Product Owner → Product Lead · VISA Best SME Project",
    title: "TBC Bank", when: "2021–22", role: "Product Owner → Product Lead, digital products for small and medium businesses",
    bullets: ["Digitized 250+ businesses with VISA during the lockdown: $1M+ extra revenue in 6 months", "Shipped Georgia’s first digital signature service for businesses", "Keynote at the World Bank IFC Caucasus conference"],
    awards: [["Gold", "Best SME Project in the Caucasus by VISA: “E-Commerce in 3 Days”", "2021"], ["Winner", "TBC Bank Start-up Challenge (internal, among employees)", "2021"]],
    photo: { src: "about/tbc-rfix-london-2022.jpg", alt: "On stage at the 4th Annual RFIx Awards in London, holding the award", caption: "E-Commerce in 3 Days · London, May 2022", w: 1182, h: 1182 },
  },
  {
    id: "econsul", year: "2022", name: "eConsul", desc: "Co-founder · $500K+ a year, 22 people",
    branches: [{ target: "greencard", name: "greencard.ge", desc: "10K+ users" }, { target: "ephoto", name: "ePhoto.AI", desc: "8K+ users in year one" }],
    title: "eConsul", when: "2022 → now", role: "Co-founder · Head of Product",
    bullets: ["Georgia’s largest visa and immigration tech startup", "$500K+ annual revenue · 22 people · profitable within 3 months · NPS 79", "Spun off greencard.ge (10K+ users) and ePhoto.AI (8K+ users in year one)"],
    awards: [["Nominee", "Tourism Tech Innovation · National Tourism Awards Georgia", "2026"], ["Winner", "Tourism Tech Innovation of the Year", "2024"], ["Gold", "GITA top startup · $60K grant", "2022"]],
    photo: { src: "about/award-gita-2022.jpg", alt: "The eConsul team on stage holding the GITA matching grant cheque for 150,000 GEL", caption: "GITA matching grant · 150,000 GEL · 2022", w: 1400, h: 933 },
    links: [["econsul", "Open eConsul →"], ["greencard", "greencard.ge →"], ["ephoto", "ePhoto.AI →"]],
  },
  {
    id: "now", year: "Now · New York", name: "AI-built products", desc: "LLMs, agents, automation", isNow: true,
    title: "AI-built products", when: "Now · New York", role: "Building with LLMs, agents, workflow automation and rapid prototyping",
    text: "AI lets one person take an idea further, faster. New ideas land in the sky on the homepage as they launch.",
    links: [["home", "See the ideas in the sky →"]],
  },
];

export const stopById = (id: string): Stop | undefined => STOPS.find((s) => s.id === id);
