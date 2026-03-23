import type { AgentCardGradient } from "@/lib/types";

const GRADIENT_BACKGROUND: Record<AgentCardGradient, string> = {
  aurora: "linear-gradient(135deg, #2dd4bf 0%, #0ea5e9 45%, #1d4ed8 100%)",
  sunset: "linear-gradient(135deg, #f97316 0%, #ef4444 50%, #a855f7 100%)",
  ocean: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 45%, #0f172a 100%)",
  ember: "linear-gradient(135deg, #f59e0b 0%, #ef4444 55%, #7c2d12 100%)",
  cosmic: "linear-gradient(135deg, #312e81 0%, #6d28d9 50%, #ec4899 100%)",
};

export function cardBackgroundImage(
  cardImageDataUrl: string | null,
  cardGradient: AgentCardGradient,
): string {
  if (cardImageDataUrl) {
    return `url("${cardImageDataUrl}")`;
  }
  return GRADIENT_BACKGROUND[cardGradient];
}
