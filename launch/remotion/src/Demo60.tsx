import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { C, F } from "./theme";
import { Captions, EvidenceFrame, Kicker, SampleBadge, ScreenClip, useReveal } from "./components";

export type DemoProps = { appUrl: string; withScore: boolean };

// Scene lengths (frames @30fps). Three 10-frame fades => total 1800 frames (60.0 s).
export const DEMO = { hook: 140, problem: 170, intro: 300, gemini: 450, compare: 360, outcome: 240, close: 170 };
export const DEMO_TOTAL = Object.values(DEMO).reduce((a, b) => a + b, 0) - 30;

export const Demo60: React.FC<DemoProps> = ({ appUrl, withScore }) => (
  <AbsoluteFill style={{ backgroundColor: C.canvas }}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="Hook" durationInFrames={DEMO.hook}>
        <Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Problem" durationInFrames={DEMO.problem}>
        <Problem />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Intro" durationInFrames={DEMO.intro}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Gemini" durationInFrames={DEMO.gemini}>
        <Gemini />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Compare" durationInFrames={DEMO.compare}>
        <Compare />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Outcome" durationInFrames={DEMO.outcome}>
        <Outcome />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Close" durationInFrames={DEMO.close}>
        <Close appUrl={appUrl} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    {withScore ? <Audio src={staticFile("audio/score-demo.wav")} /> : null}
  </AbsoluteFill>
);

/* 0:00–0:04.5 — muted-safe hook */
const Hook: React.FC = () => {
  const l1 = useReveal(0, 400, 8);
  const l2 = useReveal(46, 400, 8);
  const frames = useReveal(4, 400, 12);
  return (
    <AbsoluteFill style={{ padding: "84px 120px", alignItems: "center" }}>
      <div style={{ textAlign: "center", fontFamily: F.serif, color: C.ink, lineHeight: 1.04, letterSpacing: "-0.02em" }}>
        <div style={{ fontSize: 86, ...l1 }}>Your landlord says you caused the damage.</div>
        <div style={{ fontSize: 86, fontStyle: "italic", color: C.issue, marginTop: 8, ...l2 }}>Can you prove you didn&rsquo;t?</div>
      </div>
      <div style={{ display: "flex", gap: 48, marginTop: 56, ...frames }}>
        <EvidenceFrame src="frames/movein-baseboard.png" label="Move-in · 00:04.0" tone="sage" w={820} ring={{ x: 610, y: 500, r: 70, from: 40 }} />
        <EvidenceFrame src="frames/moveout-baseboard.png" label="Move-out · 00:03.5" tone="issue" w={820} ring={{ x: 610, y: 500, r: 70, from: 60 }} />
      </div>
      <Kicker size={18} color={C.ink3} style={{ position: "absolute", bottom: 34 }}>
        Illustrative scenario · frames from BASELINE&rsquo;s synthetic sample walkthrough
      </Kicker>
    </AbsoluteFill>
  );
};

/* 0:04–0:10 — the problem: evidence buried in a camera roll */
const TILE_SRC = ["frames/movein-floor.png", "frames/movein-crack.png", "frames/movein-baseboard.png", "frames/moveout-baseboard.png"];
const DURS = ["0:42", "1:13", "0:08", "2:31", "0:19", "0:55", "1:47", "0:11", "0:36", "3:02", "0:27", "1:05", "0:14", "0:49", "2:10", "0:23", "0:31", "1:22"];
const Problem: React.FC = () => {
  const f = useCurrentFrame();
  const drift = interpolate(f, [0, 170], [0, -120]);
  const head = useReveal(10, 400, 10);
  const sub = useReveal(48, 400, 10);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: 0.55, filter: "grayscale(0.85) blur(0.6px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, padding: 10, transform: `translateY(${drift}px)` }}>
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} style={{ position: "relative", aspectRatio: "1", overflow: "hidden", borderRadius: 6, background: C.surfaceMuted }}>
              <Img
                src={staticFile(TILE_SRC[i % 4])}
                style={{ width: "260%", height: "100%", objectFit: "cover", objectPosition: `${(i * 37) % 100}% 50%`, transform: `translateX(-${(i * 13) % 60}%)` }}
              />
              <div style={{ position: "absolute", right: 10, bottom: 8, fontFamily: F.sans, fontWeight: 600, fontSize: 20, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>
                {DURS[i % DURS.length]}
              </div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(248,247,243,0.15) 0%, rgba(248,247,243,0.92) 42%, rgba(248,247,243,0.92) 70%, rgba(248,247,243,0.2) 100%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontFamily: F.serif, fontSize: 92, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1.05, ...head }}>
          Most evidence is buried
          <br />
          in your camera roll.
        </div>
        <div style={{ marginTop: 30, fontFamily: F.sans, fontSize: 38, color: C.ink2, ...sub }}>
          Unlabeled clips. No timestamps. Nothing to compare against.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* 0:10–0:20 — introduce BASELINE with real interface footage */
const Intro: React.FC = () => (
  <AbsoluteFill>
    <Sequence name="Landing" durationInFrames={112}>
      <ScreenClip name="c01-landing" startSec={0.7} zoom={[{ f: 0, scale: 1.0, x: 30, y: 30 }, { f: 112, scale: 1.08, x: 25, y: 40 }]} />
    </Sequence>
    <Sequence name="Create record + upload" from={112} durationInFrames={188}>
      <ScreenClip name="c08-upload" startSec={2.55} />
    </Sequence>
    <Captions
      cues={[
        { from: 4, to: 110, text: "BASELINE turns your apartment walkthrough into organized evidence." },
        { from: 118, to: 296, text: "Create a record for your apartment, then upload your walkthrough video." },
      ]}
    />
  </AbsoluteFill>
);

/* 0:20–0:35 — Gemini findings (sample demonstration) + human review */
const Gemini: React.FC = () => (
  <AbsoluteFill>
    <Sequence name="Move-in findings" durationInFrames={354}>
      <ScreenClip
        name="c02-movein"
        startSec={1.6}
        zoom={[
          { f: 0, scale: 1.0, x: 50, y: 50 },
          { f: 60, scale: 1.0, x: 50, y: 50 },
          { f: 110, scale: 1.32, x: 30, y: 40 },
          { f: 170, scale: 1.32, x: 30, y: 40 },
          { f: 215, scale: 1.38, x: 88, y: 46 },
          { f: 300, scale: 1.38, x: 88, y: 46 },
          { f: 354, scale: 1.0, x: 50, y: 50 },
        ]}
      />
    </Sequence>
    <Sequence name="Human review" from={354} durationInFrames={96}>
      <ScreenClip name="c03-review" startSec={3.0} zoom={[{ f: 0, scale: 1.3, x: 90, y: 42 }, { f: 96, scale: 1.36, x: 90, y: 44 }]} />
    </Sequence>
    <SampleBadge />
    <Captions
      cues={[
        { from: 4, to: 104, text: "Gemini reviews the walkthrough and logs what is visible, with timestamps." },
        { from: 110, to: 206, text: "Click any timestamp to jump to the exact frame." },
        { from: 212, to: 350, text: "Uncertainty is stated, not hidden: lighting, angle and motion blur are flagged." },
        { from: 358, to: 448, text: "Nothing counts until you confirm, edit, or dismiss it." },
      ]}
    />
  </AbsoluteFill>
);

/* 0:35–0:47 — move-in vs move-out, claim matching */
const Compare: React.FC = () => (
  <AbsoluteFill>
    <Sequence name="Comparison" durationInFrames={240}>
      <ScreenClip
        name="c04-compare"
        startSec={4.2}
        zoom={[
          { f: 0, scale: 1.0, x: 50, y: 50 },
          { f: 40, scale: 1.0, x: 50, y: 50 },
          { f: 90, scale: 1.22, x: 50, y: 52 },
          { f: 240, scale: 1.22, x: 50, y: 58 },
        ]}
      />
    </Sequence>
    <Sequence name="Claim match" from={240} durationInFrames={120}>
      <ScreenClip name="c05-claims" startSec={4.3} zoom={[{ f: 0, scale: 1.05, x: 50, y: 40 }, { f: 120, scale: 1.12, x: 50, y: 50 }]} />
    </Sequence>
    <SampleBadge />
    <Captions
      cues={[
        { from: 4, to: 92, text: "Then compare move-in and move-out footage, side by side." },
        { from: 98, to: 236, text: "Potentially new: rub marks on the lower baseboard, with a caveat on what video can't prove." },
        { from: 244, to: 358, text: "Match each landlord deduction to the frames that support it." },
      ]}
    />
  </AbsoluteFill>
);

/* 0:47–0:55 — the deliverable */
const Outcome: React.FC = () => (
  <AbsoluteFill>
    <Sequence name="Letter" durationInFrames={165}>
      <ScreenClip name="c06-letter" startSec={3.9} zoom={[{ f: 0, scale: 1.0, x: 50, y: 50 }, { f: 70, scale: 1.18, x: 50, y: 70 }, { f: 165, scale: 1.2, x: 50, y: 74 }]} />
    </Sequence>
    <Sequence name="PDF export" from={165} durationInFrames={75}>
      <ScreenClip name="c07-report" startSec={7.4} zoom={[{ f: 0, scale: 1.12, x: 85, y: 20 }, { f: 75, scale: 1.16, x: 85, y: 20 }]} />
    </Sequence>
    <SampleBadge text="Sample demonstration record" />
    <Captions
      cues={[
        { from: 4, to: 161, text: "Draft a polite reconsideration letter. You edit every word." },
        { from: 169, to: 238, text: "Export a timestamped PDF evidence report." },
      ]}
    />
  </AbsoluteFill>
);

/* 0:55–1:00 — close */
export const Close: React.FC<{ appUrl: string; footnote?: boolean }> = ({ appUrl, footnote = true }) => {
  const a = useReveal(4, 900, 10);
  const b = useReveal(22, 900, 10);
  const c = useReveal(44, 900, 10);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 40, letterSpacing: "0.32em", color: C.ink, ...a }}>BASELINE</div>
      <div style={{ fontFamily: F.serif, fontSize: 112, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1.04, marginTop: 28, ...b }}>
        Your apartment.
        <br />
        Your evidence.
      </div>
      <div style={{ marginTop: 52, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, ...c }}>
        <div style={{ fontFamily: F.mono, fontSize: 34, color: C.ink, padding: "12px 26px", border: `1.5px solid ${C.borderStrong}`, borderRadius: 12, background: C.surface }}>
          {appUrl ? appUrl : "Try the sample case · link in the description"}
        </div>
        <Kicker size={20} color={C.ink2}>Built with Google AI Studio · Powered by Gemini</Kicker>
      </div>
      {footnote ? (
        <div style={{ position: "absolute", bottom: 36, fontFamily: F.sans, fontSize: 20, color: C.ink3 }}>
          Free-tier hosting: the first visit after inactivity can take about a minute to start.
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
