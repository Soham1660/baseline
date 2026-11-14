import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { C, F } from "./theme";
import { Captions, EvidenceFrame, Kicker, PagePan, SampleBadge, useReveal } from "./components";

export type TeaserProps = { appUrl: string; withScore: boolean };

// 1080x1920. Mobile screenshots are 1170px wide (390 CSS px @3x).
const W = 1080;
const IMG_W = 1170;
const k = W / IMG_W;
const at = (imgY: number, topOffset: number) => Math.round(imgY * k - topOffset);

export const TEASER = { hook: 110, film: 135, log: 150, compare: 150, deliver: 125, cta: 120 };
export const TEASER_TOTAL = Object.values(TEASER).reduce((a, b) => a + b, 0) - 40;

// Platform UI (Shorts/Reels/TikTok) covers the bottom ~380px and right edge; keep captions above it.
const CAP = { bottom: 430, fontSize: 50, maxWidth: 900 };

export const Teaser: React.FC<TeaserProps> = ({ appUrl, withScore }) => (
  <AbsoluteFill style={{ backgroundColor: C.canvas }}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="Hook" durationInFrames={TEASER.hook}>
        <Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Film" durationInFrames={TEASER.film}>
        <PagePan src="stills/m-movein.png" width={W} imgW={IMG_W} keys={[{ f: 0, y: at(914, 220) }, { f: TEASER.film, y: at(1250, 220) }]} />
        <SampleBadge text="Sample demonstration" top={120} left={60} scale={1.25} />
        <Captions {...CAP} cues={[{ from: 8, to: TEASER.film - 2, text: "Film your move-in walkthrough." }]} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Log" durationInFrames={TEASER.log}>
        <PagePan src="stills/m-movein.png" width={W} imgW={IMG_W} keys={[{ f: 0, y: at(2946, 260) }, { f: 30, y: at(2946, 260) }, { f: TEASER.log, y: at(4044, 330) }]} />
        <SampleBadge text="Sample · precomputed findings" top={120} left={60} scale={1.25} />
        <Captions {...CAP} cues={[{ from: 6, to: TEASER.log - 2, text: "It logs what's visible, with exact timestamps." }]} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Compare" durationInFrames={TEASER.compare}>
        <PagePan src="stills/m-compare.png" width={W} imgW={IMG_W} keys={[{ f: 0, y: at(7462, 300) }, { f: 25, y: at(7462, 300) }, { f: TEASER.compare, y: at(8300, 300) }]} />
        <SampleBadge text="Sample · precomputed comparison" top={120} left={60} scale={1.25} />
        <Captions {...CAP} cues={[{ from: 6, to: TEASER.compare - 2, text: "Then compares move-in and move-out, side by side." }]} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Deliver" durationInFrames={TEASER.deliver}>
        <Sequence durationInFrames={65}>
          <PagePan src="stills/m-letter.png" width={W} imgW={IMG_W} keys={[{ f: 0, y: at(2264, 520) }, { f: 65, y: at(2264, 380) }]} />
        </Sequence>
        <Sequence from={65} durationInFrames={60}>
          <PagePan src="stills/m-report.png" width={W} imgW={IMG_W} keys={[{ f: 0, y: at(500, 200) }, { f: 60, y: at(800, 200) }]} />
        </Sequence>
        <SampleBadge text="Sample demonstration record" top={120} left={60} scale={1.25} />
        <Captions {...CAP} cues={[{ from: 6, to: TEASER.deliver - 2, text: "Then drafts your letter and a PDF evidence report." }]} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="CTA" durationInFrames={TEASER.cta}>
        <CTA appUrl={appUrl} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    {withScore ? <Audio src={staticFile("audio/score-teaser.wav")} /> : null}
  </AbsoluteFill>
);

const Hook: React.FC = () => {
  const a = useReveal(0, 1000, 6);
  const b = useReveal(10, 1000, 10);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 210 }}>
      <div style={{ fontFamily: F.serif, fontSize: 92, lineHeight: 1.05, letterSpacing: "-0.02em", color: C.ink, textAlign: "center", padding: "0 80px", ...a }}>
        Could a short apartment video help protect your <span style={{ fontStyle: "italic", color: C.issue }}>security deposit?</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 34, marginTop: 70, ...b }}>
        <EvidenceFrame src="frames/movein-baseboard.png" label="Move-in · 00:04.0" tone="sage" w={900} labelSize={28} ring={{ x: 610, y: 500, r: 80, from: 22 }} />
        <EvidenceFrame src="frames/moveout-baseboard.png" label="Move-out · 00:03.5" tone="issue" w={900} labelSize={28} ring={{ x: 610, y: 500, r: 80, from: 38 }} />
      </div>
      <Kicker size={22} color={C.ink3} style={{ position: "absolute", bottom: 300 }}>
        Illustrative · synthetic sample walkthrough
      </Kicker>
    </AbsoluteFill>
  );
};

const CTA: React.FC<{ appUrl: string }> = ({ appUrl }) => {
  const a = useReveal(2, 1000, 8);
  const b = useReveal(14, 1000, 8);
  const c = useReveal(30, 1000, 8);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", paddingBottom: 260 }}>
      <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 52, letterSpacing: "0.32em", color: C.ink, ...a }}>BASELINE</div>
      <div style={{ fontFamily: F.serif, fontSize: 120, lineHeight: 1.04, letterSpacing: "-0.02em", color: C.ink, marginTop: 30, ...b }}>
        Your apartment.
        <br />
        Your evidence.
      </div>
      <div style={{ marginTop: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, ...c }}>
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 46, color: C.canvas, background: C.ink, padding: "24px 44px", borderRadius: 18 }}>
          Try the free sample case
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 32, color: C.ink2 }}>{appUrl || "link in bio"}</div>
        <Kicker size={22} color={C.ink3}>Powered by Gemini · not legal advice</Kicker>
      </div>
    </AbsoluteFill>
  );
};

/* 1280x720 YouTube thumbnail: real surface frame on one side, real BASELINE evidence UI on the other. */
export const Thumbnail: React.FC = () => {
  // Desktop compare screenshot @2x: "Lower west wall baseboard" card at CSS (152,1578) 1136x589.
  const crop = { x: 1400, y: 3156, w: 1176, h: 944 };
  const dispW = 600;
  const sc = dispW / crop.w;
  return (
    <AbsoluteFill style={{ backgroundColor: C.canvas }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 660, height: 720, overflow: "hidden" }}>
        <Img src={staticFile("frames/moveout-baseboard.png")} style={{ position: "absolute", width: 1600, height: 900, left: -470, top: -330 }} />
        <svg style={{ position: "absolute", left: 0, top: 0 }} width={660} height={720}>
          <circle cx={290} cy={300} r={92} fill="none" stroke={C.issue} strokeWidth={9} />
        </svg>
        <div style={{ position: "absolute", left: 0, bottom: 0, width: 660, height: 300, background: "linear-gradient(180deg, rgba(248,247,243,0) 0%, rgba(248,247,243,0.96) 55%)" }} />
        <div style={{ position: "absolute", left: 44, bottom: 46, fontFamily: F.serif, fontSize: 134, lineHeight: 0.95, whiteSpace: "nowrap", color: C.ink, letterSpacing: "-0.03em" }}>
          PROVE IT.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 34,
          top: 70,
          width: dispW,
          height: crop.h * sc,
          overflow: "hidden",
          borderRadius: 18,
          border: `2px solid ${C.border}`,
          boxShadow: "0 24px 60px rgba(32,33,31,0.22)",
          background: C.surface,
        }}
      >
        <Img src={staticFile("stills/d-compare.png")} style={{ position: "absolute", left: -crop.x * sc, top: -crop.y * sc, width: 2880 * sc }} />
      </div>
      <div style={{ position: "absolute", right: 40, bottom: 34, fontFamily: F.sans, fontWeight: 600, fontSize: 30, letterSpacing: "0.3em", color: C.ink }}>BASELINE</div>
    </AbsoluteFill>
  );
};
