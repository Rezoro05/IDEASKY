/** Home page copy, logos and skills. */

export const HERO = {
  /** <b> marks the accent words, as on the page */
  lede: "The value of the idea itself without execution is <b>0</b>. Whether it’s a digital product, creative strategy, or business obstacle, I turn ideas to <b>1</b>. I believe an idea that is not exposed is lost. <b>Are you ready?</b>",
} as const;

export type Logo = {
  name: string; href: string; role: string;
  img?: { src: string; w?: number; h?: number };
  /** A white-lettered version shown in dark mode on hover */
  onDark?: string;
};
export const LOGOS: readonly Logo[] = [
  { name: "eConsul", href: "https://econsul.io/en", role: "Co-founder", img: { src: "logos/econsul.png", w: 450, h: 115 }, onDark: "logos/econsul-on-dark.png" },
  { name: "greencard.ge", href: "https://greencard.ge/en", role: "Co-founder", img: { src: "logos/greencard.svg" }, onDark: "logos/greencard-on-dark.svg" },
  { name: "TBC Bank", href: "https://tbcbank.ge/en", role: "Product Lead", img: { src: "logos/tbc.png", w: 444, h: 120 } },
  { name: "VISA", href: "https://www.visa.com.ge/", role: "Partner · Best SME Project", img: { src: "logos/visa.png", w: 370, h: 120 } },
  { name: "ABK Communication", href: "https://www.linkedin.com/company/abk-communication/", role: "Creative strategy", img: { src: "logos/abk.png", w: 140, h: 91 }, onDark: "logos/abk-on-dark.png" },
  { name: "ePhoto.AI", href: "https://ephoto.ai/app", role: "Co-founder" }, // text logo
];

export const WHO_I_AM = "I’m a product and growth professional with 8+ years of experience building businesses, shaping customer experiences, and turning ideas into products that create measurable value. My background spans both startups and large organizations, giving me a practical understanding of how to move from strategy to execution and build solutions people actually use.";

export const SKILLS: readonly string[] = [
  "Product Strategy", "Product Management", "Growth Strategy", "Customer Experience", "Go-to-Market", "Business Development",
  "AI Product Development", "Cross-Functional Leadership", "Digital Transformation", "Data-Driven Decision Making",
  "Marketing Strategy", "Startup Building", "Process Optimization", "User Research", "Prototyping", "Stakeholder Management",
];

export type HowToStep = { step: string; title: string; text: string; art: "paper" | "fold" | "stairs" };
export const HOW_TO: readonly HowToStep[] = [
  { art: "paper", step: "Ideation", title: "Ideas are in the air", text: "They’re in everyday life, in the obstacles we face, even in our dreams. Yet the moment you need one is often when it’s hardest to find. So pay attention and collect ideas as they come. You never know when you’ll need one." },
  { art: "fold", step: "Creation", title: "Attention Is All You Need", text: "An idea on its own is a good thought exercise, but it means little in the physical world until you bring it to life. AI makes execution easier: plan the steps, learn what you need, and follow your blueprint. Attention is all you need." },
  { art: "stairs", step: "Enemy of the Good", title: "Enemy of the Good", text: "Some things you want to keep improving, and some have no natural end. So you have to set the end yourself. Don’t let perfect be the enemy of the good." },
];

export const ABOUT_STORY = {
  intro: "I take ideas from 0 to 1. Here is how I got good at it.",
  started: "I’ve always been tech-savvy. It started with gaming, which soon turned into reinstalling Windows for neighbors and friends. That curiosity led me and my hacker friend Devi to co-found Georgia’s first tech education website. It fueled our passion for technology and won us a silver medal at Infomatrix, an international computer olympiad. That was my first taste of winning.",
  fresh: "Recently I won the Green Card Lottery through the platform I helped build, and made the leap from the small country of Georgia to the US. I packed up everything I had built over 30 years to start fresh. Now I’m here, on a new path to my American dream. I built this site to reach the people who will come along on this journey.",
} as const;
