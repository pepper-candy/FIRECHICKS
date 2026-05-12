import type { GameStage } from "@/lib/gameTypes";

export interface StageInfo {
  title: string;
  instruction: string;
  icon: string;
}

export const STAGE_INFO: Record<GameStage, StageInfo> = {
  0: { title: "Social Circle", instruction: "Meet ALL other Chicks! 🐣", icon: "🤝" },
  1: { title: "Exam Tips", instruction: "Get TIPS from glowing buildings, then SHARE!", icon: "📍" },
  2: { title: "Share Tips", instruction: "Share your tips with everyone!", icon: "🔗" },
  3: { title: "Final Exam", instruction: "Run to any building and finish the EXAM!", icon: "📝" },
};

export const STAGE_TRANSITION_INSTRUCTION_MS = 12_000;
export const STAGE_READY_COUNTDOWN_MS = 3_000;
export const STAGE_TRANSITION_TOTAL_MS =
  STAGE_TRANSITION_INSTRUCTION_MS + STAGE_READY_COUNTDOWN_MS;

export type OverlayVideo =
  | "hurt"
  | "dead"
  | "stage0-transition"
  | "stage1-transition"
  | "stage3-transition"
  | "eagle-warning";

export function getStageTransitionVideo(stage: GameStage): OverlayVideo | null {
  switch (stage) {
    case 0:
      return "stage0-transition";
    case 1:
      return "eagle-warning";
    case 3:
      return "stage3-transition";
    default:
      return null;
  }
}
