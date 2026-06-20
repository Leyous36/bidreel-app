import { Template } from "./types";

export const TEMPLATES: Template[] = [
  {
    id: "corporate-brand-film",
    name: "Corporate Brand Film",
    description:
      "Cinematic story-driven film that builds credibility and moves markets.",
    icon: "business",
    avgRate: "$8K–$25K",
    freeTier: true,
  },
  {
    id: "event-coverage",
    name: "Event Coverage",
    description:
      "Multi-cam coverage of conferences, galas, and launches with highlight reel.",
    icon: "videocam",
    avgRate: "$2K–$8K",
    freeTier: true,
  },
  {
    id: "documentary",
    name: "Documentary",
    description:
      "Long-form documentary storytelling — interviews, archival, narrative arc.",
    icon: "film",
    avgRate: "$15K–$60K",
    freeTier: false,
  },
  {
    id: "social-media-retainer",
    name: "Social Media Retainer",
    description:
      "Monthly short-form content engine: reels, cutdowns, and platform-native edits.",
    icon: "phone-portrait",
    avgRate: "$2K–$6K/mo",
    freeTier: false,
  },
  {
    id: "real-estate-drone",
    name: "Real Estate / Drone",
    description:
      "Aerial and interior property showcases that sell listings faster.",
    icon: "airplane",
    avgRate: "$500–$3K",
    freeTier: false,
  },
  {
    id: "nonprofit-film",
    name: "Nonprofit Film",
    description:
      "Mission-driven fundraising films that turn donors into believers.",
    icon: "heart",
    avgRate: "$5K–$15K",
    freeTier: false,
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
