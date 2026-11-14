import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio, Video } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { C, F } from "./theme";
import { Captions, EvidenceFrame, Kicker, PagePan, SampleBadge, ScreenClip, useReveal } from "./components";
import { Close } from "./Demo60";

export type PitchProps = {
  founderName: string;
  founderHandle: string;
  /** Optional: file in public/ (e.g. "founder/intro.mp4") recorded by the founder. Replaces the title-card intro. */
  founderClip: string;
  appUrl: string;
  withScore: boolean;
};

// Nine scenes, eight 10-frame fades => 3600 frames (120.0 s)
export const PITCH = { intro: 430, problem: 540, why: 430, gemini: 600, review: 480, proto: 420, gtm: 370, limits: 250, close: 160 };
export const PITCH_TOTAL = Object.values(PITCH).reduce((a, b) => a + b, 0) - 80;


export const Pitch120: React.FC<PitchProps> = (p) => (
  <AbsoluteFill style={{ backgroundColor: C.canvas }}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="Founder intro" durationInFrames={PITCH.intro}>
        <Intro {...p} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Problem" durationInFrames={PITCH.problem}>
        <Problem />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Why not a gallery or chatbot" durationInFrames={PITCH.why}>
        <Why />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="How Gemini is used" durationInFrames={PITCH.gemini}>
        <GeminiScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Human review + integrity" durationInFrames={PITCH.review}>
        <Review />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Working prototype" durationInFrames={PITCH.proto}>
        <Proto />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Customers + GTM" durationInFrames={PITCH.gtm}>
        <GTM />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Limitations" durationInFrames={PITCH.limits}>
        <Limits />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
      <TransitionSeries.Sequence name="Close" durationInFrames={PITCH.close}>
        <Close appUrl={p.appUrl} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    {p.withScore ? <Audio src={staticFile("audio/score-pitch.wav")} volume={p.founderClip ? (f) => (f < PITCH.intro ? 0.15 : 1) : 1} /> : null}
  </AbsoluteFill>
);

const Serif: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 84, style }) => (
  <div style={{ fontFamily: F.serif, fontSize: size, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1.06, ...style }}>{children}</div>
);

const Body: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 38, style }) => (
  <div style={{ fontFamily: F.sans, fontSize: size, color: C.ink2, lineHeight: 1.4, ...style }}>{children}</div>
);

/* 0:00–0:14 — founder introduction (title card, or the founder's own recording when provided) */
const Intro: React.FC<PitchProps> = ({ founderName, founderHandle, founderClip }) => {
  const a = useReveal(6, 1000, 10);
  const b = useReveal(24, 1000, 10);
  const c = useReveal(70, 1000, 10);
  const d = useReveal(170, 1000, 12);
  if (founderClip) {
    return (
      <AbsoluteFill>
        <Video src={staticFile(founderClip)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", left: 80, bottom: 80, padding: "18px 26px", borderRadius: 14, background: "rgba(248,247,243,0.94)", ...a }}>
          <div style={{ fontFamily: F.serif, fontSize: 44, color: C.ink }}>{founderName}</div>
          <Kicker size={20}>Founder, BASELINE</Kicker>
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ padding: "0 160px", justifyContent: "center" }}>
      <Kicker style={a}>Berkeley × Google DeepMind Hackathon · Google AI Studio track</Kicker>
      <Serif size={128} style={{ marginTop: 28, ...b }}>
        {founderName}
      </Serif>
      <div style={{ display: "flex", gap: 24, alignItems: "baseline", marginTop: 14, ...c }}>
        <Body size={40} style={{ color: C.ink }}>Founder, BASELINE</Body>
        <Kicker size={24} color={C.ink3}>{founderHandle}</Kicker>
      </div>
      <Body size={48} style={{ marginTop: 64, maxWidth: 1400, color: C.ink, ...d }}>
        I&rsquo;m building BASELINE so renters can prove what their apartment looked like on the day they moved in.
      </Body>
    </AbsoluteFill>
  );
};

/* 0:14–0:32 — the problem */
const Problem: React.FC = () => {
  const a = useReveal(8, 1000, 10);
  const b = useReveal(160, 1000, 10);
  const c = useReveal(330, 1000, 10);
  return (
    <AbsoluteFill style={{ padding: "110px 140px" }}>
      <Kicker style={a}>The problem</Kicker>
      <Serif size={78} style={{ marginTop: 22, maxWidth: 1500, ...a }}>
        Move-out ends with an itemized list of deductions.
      </Serif>
      <Body size={42} style={{ marginTop: 26, maxWidth: 1500, ...b }}>
        Disputing one takes evidence of what the apartment looked like on day one.
      </Body>
      <div style={{ display: "flex", gap: 40, marginTop: 60, alignItems: "flex-start" }}>
        <div style={{ ...c }}>
          <EvidenceFrame src="frames/movein-floor.png" label="Somewhere in a camera roll" tone="sage" w={560} labelSize={20} />
        </div>
        <Body size={40} style={{ maxWidth: 820, color: C.ink, marginTop: 30, ...c }}>
          Most renters filmed something. Few can find it, timestamp it, or line it up against the move-out.
        </Body>
      </div>
    </AbsoluteFill>
  );
};

/* 0:32–0:46 — why a gallery or a chatbot is not enough */
const COLS: { title: string; tone: string; lines: string[] }[] = [
  { title: "Photo gallery", tone: C.ink3, lines: ["Stores files", "No findings or timestamps", "Nothing to compare"] },
  { title: "Generic chatbot", tone: C.ink3, lines: ["Answers questions", "No file fingerprint", "No frame-level citations"] },
  { title: "BASELINE", tone: C.sage, lines: ["Timestamped findings", "SHA-256 fingerprinted video", "Move-in vs. move-out, human-reviewed"] },
];
const Why: React.FC = () => {
  const head = useReveal(6, 1000, 10);
  return (
    <AbsoluteFill style={{ padding: "110px 140px" }}>
      <Kicker style={head}>Why not just a gallery, or a chatbot?</Kicker>
      <Serif size={76} style={{ marginTop: 22, ...head }}>Evidence needs structure, not storage.</Serif>
      <div style={{ display: "flex", gap: 32, marginTop: 70 }}>
        {COLS.map((col, i) => (
          <WhyCol key={col.title} col={col} from={40 + i * 55} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
const WhyCol: React.FC<{ col: (typeof COLS)[number]; from: number }> = ({ col, from }) => {
  const st = useReveal(from, 1000, 12);
  const strong = col.title === "BASELINE";
  return (
    <div
      style={{
        flex: 1,
        padding: "36px 38px",
        borderRadius: 20,
        background: strong ? C.surface : C.surfaceMuted,
        border: `1.5px solid ${strong ? C.sage : C.border}`,
        boxShadow: strong ? "0 18px 50px rgba(76,115,91,0.14)" : "none",
        ...st,
      }}
    >
      <div style={{ fontFamily: strong ? F.sans : F.serif, fontWeight: strong ? 600 : 400, letterSpacing: strong ? "0.24em" : "-0.01em", fontSize: strong ? 34 : 46, color: C.ink }}>
        {col.title}
      </div>
      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 18 }}>
        {col.lines.map((l) => (
          <div key={l} style={{ display: "flex", gap: 14, alignItems: "baseline", fontFamily: F.sans, fontSize: 32, color: strong ? C.ink : C.ink2 }}>
            <span style={{ color: col.tone, fontWeight: 600 }}>{strong ? "✓" : "–"}</span>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
};

/* 0:46–1:06 — how Gemini is used */
const GeminiScene: React.FC = () => (
  <AbsoluteFill>
    <ScreenClip
      name="c02-movein"
      startSec={1.0}
      zoom={[
        { f: 0, scale: 1.0, x: 50, y: 50 },
        { f: 200, scale: 1.0, x: 50, y: 50 },
        { f: 260, scale: 1.35, x: 88, y: 46 },
        { f: 400, scale: 1.35, x: 88, y: 46 },
      ]}
    />
    <Sequence from={400} durationInFrames={200} name="Upload (real)">
      <ScreenClip name="c08-upload" startSec={2.6} rate={0.92} />
    </Sequence>
    <Sequence durationInFrames={400}>
      <SampleBadge />
    </Sequence>
    <Captions
      cues={[
        { from: 6, to: 130, text: "Gemini watches the walkthrough video itself and returns structured findings." },
        { from: 136, to: 262, text: "Room, surface, visible condition, timestamp, severity, and confidence." },
        { from: 268, to: 396, text: "It is prompted to stay conservative: zero damage findings when none is visible." },
        { from: 404, to: 596, text: "Your own walkthrough runs through the same pipeline: upload, fingerprint, analyze." },
      ]}
    />
  </AbsoluteFill>
);

/* 1:06–1:22 — human review and evidence integrity */
const Review: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={210}>
      <ScreenClip name="c03-review" startSec={2.6} zoom={[{ f: 0, scale: 1.25, x: 90, y: 42 }, { f: 210, scale: 1.32, x: 90, y: 44 }]} />
    </Sequence>
    <Sequence from={210} durationInFrames={270}>
      <PagePan src="stills/d-report.png" width={1920} imgW={2880} keys={[{ f: 0, y: 260, x: 240, scale: 1.25 }, { f: 270, y: 620, x: 240, scale: 1.25 }]} />
    </Sequence>
    <SampleBadge text="Sample demonstration record" />
    <Captions
      cues={[
        { from: 6, to: 206, text: "Every AI finding is a proposal until a person confirms, edits, or dismisses it." },
        { from: 214, to: 340, text: "Edits keep the original AI text. Every video gets a SHA-256 fingerprint." },
        { from: 346, to: 476, text: "A fingerprint shows a file wasn't altered later. It can't prove when it was filmed." },
      ]}
    />
  </AbsoluteFill>
);

/* 1:22–1:36 — the working prototype */
const Proto: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={105}>
      <ScreenClip name="c04-compare" startSec={5.0} zoom={[{ f: 0, scale: 1.15, x: 50, y: 52 }]} />
    </Sequence>
    <Sequence from={105} durationInFrames={105}>
      <ScreenClip name="c05-claims" startSec={4.6} zoom={[{ f: 0, scale: 1.08, x: 50, y: 45 }]} />
    </Sequence>
    <Sequence from={210} durationInFrames={105}>
      <ScreenClip name="c06-letter" startSec={6.3} zoom={[{ f: 0, scale: 1.18, x: 50, y: 72 }]} />
    </Sequence>
    <Sequence from={315} durationInFrames={105}>
      <ScreenClip name="c07-report" startSec={7.0} zoom={[{ f: 0, scale: 1.12, x: 85, y: 20 }]} />
    </Sequence>
    <SampleBadge text="Working prototype · sample case shown" />
    <Captions
      cues={[
        { from: 6, to: 101, text: "Working today: move-in vs. move-out comparison," },
        { from: 109, to: 206, text: "claim-to-evidence matching," },
        { from: 214, to: 311, text: "an editable reconsideration letter," },
        { from: 319, to: 416, text: "and a downloadable PDF evidence report." },
      ]}
    />
  </AbsoluteFill>
);

/* 1:36–1:48 — customers and go-to-market */
const GTM: React.FC = () => {
  const a = useReveal(6, 1000, 10);
  const b = useReveal(50, 1000, 12);
  const c = useReveal(150, 1000, 12);
  const Item: React.FC<{ k: string; v: string }> = ({ k, v }) => (
    <div style={{ display: "flex", gap: 22, alignItems: "baseline", marginTop: 20 }}>
      <Kicker size={22} color={C.sage} style={{ width: 70 }}>{k}</Kicker>
      <Body size={38} style={{ color: C.ink }}>{v}</Body>
    </div>
  );
  return (
    <AbsoluteFill style={{ padding: "110px 140px" }}>
      <Kicker style={a}>Who it&rsquo;s for · proposed go-to-market</Kicker>
      <Serif size={76} style={{ marginTop: 22, ...a }}>Start where moves happen every year.</Serif>
      <div style={{ marginTop: 50, ...b }}>
        <Item k="01" v="Renters, starting with students who move every lease cycle" />
        <Item k="02" v="Tenant unions and renter-advocacy organizations" />
        <Item k="03" v="University off-campus housing offices" />
      </div>
      <Body size={36} style={{ marginTop: 50, maxWidth: 1500, ...c }}>
        Free for individual renters. Distribution through campus housing and tenant groups that already help people at move-out.
      </Body>
    </AbsoluteFill>
  );
};

/* 1:48–1:56 — limitations, stated plainly */
const Limits: React.FC = () => {
  const a = useReveal(6, 1000, 10);
  const b = useReveal(30, 1000, 12);
  return (
    <AbsoluteFill style={{ padding: "110px 140px" }}>
      <Kicker style={a} color={C.warn}>Responsible use</Kicker>
      <Serif size={72} style={{ marginTop: 22, ...a }}>What BASELINE is not.</Serif>
      <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 60px", ...b }}>
        {[
          "Not legal advice, and not proof on its own.",
          "AI can miss or misread. A person reviews every finding.",
          "Records live in your browser. Server copies of uploads expire after 30 minutes.",
          "Free-tier hosting: the first load after a while can take about a minute.",
        ].map((t) => (
          <Body key={t} size={34} style={{ color: C.ink, borderTop: `1.5px solid ${C.border}`, paddingTop: 18 }}>
            {t}
          </Body>
        ))}
      </div>
    </AbsoluteFill>
  );
};

