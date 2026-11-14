import { loadFont as loadNewsreader } from "@remotion/google-fonts/Newsreader";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";

// Tokens mirror BASELINE's src/index.css so the films match the product.
export const C = {
  canvas: "#F8F7F3",
  surface: "#FFFFFF",
  surfaceMuted: "#F0EEE9",
  ink: "#20211F",
  ink2: "#62635F",
  ink3: "#90918B",
  border: "#DFDED8",
  borderStrong: "#C5C4BD",
  issue: "#C9473D",
  issueBg: "#FBEDEB",
  sage: "#4C735B",
  sageBg: "#EAF1EB",
  warn: "#946B28",
  warnBg: "#F7F1E3",
};

export const F = {
  serif: loadNewsreader("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily,
  sans: loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily,
  mono: loadPlexMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily,
};

export const FPS = 30;
export const s = (seconds: number) => Math.round(seconds * FPS);
