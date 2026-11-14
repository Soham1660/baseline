import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Video } from "@remotion/media";
import { C, F, s } from "./theme";

const ease = Easing.bezier(0.33, 0, 0.2, 1);

/** Fade + rise in, fade out. Frames are relative to the parent Sequence. */
export const useReveal = (from: number, to: number, fade = 9) => {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [from, from + fade, to - fade, to], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(f, [from, from + fade + 4], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return { opacity, transform: `translateY(${y}px)` };
};

export type Cue = { from: number; to: number; text: React.ReactNode };

/** Lower-third captions: high-contrast charcoal chip, Inter, generous size. */
export const Captions: React.FC<{
  cues: Cue[];
  bottom?: number;
  fontSize?: number;
  maxWidth?: number;
}> = ({ cues, bottom = 64, fontSize = 40, maxWidth = 1500 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", pointerEvents: "none" }}>
      {cues
        .filter((c) => f >= c.from - 1 && f <= c.to + 1)
        .map((c, i) => (
          <CaptionChip key={i} cue={c} bottom={bottom} fontSize={fontSize} maxWidth={maxWidth} />
        ))}
    </AbsoluteFill>
  );
};

const CaptionChip: React.FC<{ cue: Cue; bottom: number; fontSize: number; maxWidth: number }> = ({
  cue,
  bottom,
  fontSize,
  maxWidth,
}) => {
  const style = useReveal(cue.from, cue.to, 7);
  return (
    <div
      style={{
        position: "absolute",
        bottom,
        maxWidth,
        padding: `${Math.round(fontSize * 0.42)}px ${Math.round(fontSize * 0.75)}px`,
        borderRadius: 16,
        background: "rgba(32,33,31,0.93)",
        color: C.canvas,
        fontFamily: F.sans,
        fontWeight: 500,
        fontSize,
        lineHeight: 1.28,
        letterSpacing: "-0.01em",
        textAlign: "center",
        boxShadow: "0 10px 30px rgba(32,33,31,0.18)",
        ...style,
      }}
    >
      {cue.text}
    </div>
  );
};

/** Persistent honesty label for any footage showing precomputed sample data. */
export const SampleBadge: React.FC<{ text?: string; top?: number; left?: number; scale?: number }> = ({
  text = "Sample demonstration · precomputed findings, not a live analysis",
  top = 44,
  left = 48,
  scale = 1,
}) => (
  <div
    style={{
      position: "absolute",
      top,
      left,
      display: "flex",
      alignItems: "center",
      gap: 12 * scale,
      padding: `${10 * scale}px ${18 * scale}px`,
      borderRadius: 10 * scale,
      background: C.warnBg,
      border: `1.5px solid #E6D6B4`,
      color: C.warn,
      fontFamily: F.mono,
      fontWeight: 500,
      fontSize: 22 * scale,
      letterSpacing: "0.02em",
      boxShadow: "0 6px 18px rgba(32,33,31,0.10)",
    }}
  >
    <span style={{ width: 9 * scale, height: 9 * scale, borderRadius: 99, background: C.warn }} />
    {text}
  </div>
);

export type ZoomKey = { f: number; scale: number; x: number; y: number };

/** Smooth camera move: scale toward a focal point (x/y in % of frame). */
export const Zoom: React.FC<{ keys: ZoomKey[]; children: React.ReactNode }> = ({ keys, children }) => {
  const f = useCurrentFrame();
  const fs = keys.map((k) => k.f);
  const pick = (sel: (k: ZoomKey) => number) =>
    keys.length === 1
      ? sel(keys[0])
      : interpolate(f, fs, keys.map(sel), {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        });
  const scale = pick((k) => k.scale);
  const x = pick((k) => k.x);
  const y = pick((k) => k.y);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: `${x}% ${y}%` }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A real screen recording of the BASELINE app, trimmed in seconds. */
export const ScreenClip: React.FC<{
  name: string;
  startSec: number;
  rate?: number;
  zoom?: ZoomKey[];
}> = ({ name, startSec, rate = 1, zoom = [{ f: 0, scale: 1, x: 50, y: 50 }] }) => (
  <AbsoluteFill style={{ backgroundColor: C.canvas }}>
    <Zoom keys={zoom}>
      <Video
        src={staticFile(`clips/${name}.mp4`)}
        trimBefore={s(startSec)}
        playbackRate={rate}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </Zoom>
  </AbsoluteFill>
);

/** Pan a tall, crisp full-page screenshot (real UI) vertically. */
export const PagePan: React.FC<{
  src: string;
  width: number;
  imgW: number;
  keys: { f: number; y: number; scale?: number; x?: number }[];
  shadow?: boolean;
}> = ({ src, width, imgW, keys }) => {
  const f = useCurrentFrame();
  const fs = keys.map((k) => k.f);
  const opts = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: Easing.inOut(Easing.cubic) };
  const y = keys.length === 1 ? keys[0].y : interpolate(f, fs, keys.map((k) => k.y), opts);
  const sc = keys.length === 1 ? keys[0].scale ?? 1 : interpolate(f, fs, keys.map((k) => k.scale ?? 1), opts);
  const x = keys.length === 1 ? keys[0].x ?? 0 : interpolate(f, fs, keys.map((k) => k.x ?? 0), opts);
  const k = (width / imgW) * sc;
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: C.canvas }}>
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: imgW,
          transformOrigin: "0 0",
          transform: `translate(${-x}px, ${-y}px) scale(${k})`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Kicker: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({
  children,
  color = C.ink2,
  size = 22,
  style,
}) => (
  <div
    style={{
      fontFamily: F.mono,
      fontWeight: 500,
      fontSize: size,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Animated hand-drawn-free annotation ring (clean SVG stroke) */
export const Ring: React.FC<{ x: number; y: number; r: number; color: string; from: number; width?: number }> = ({
  x,
  y,
  r,
  color,
  from,
  width = 5,
}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [from, from + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const circ = 2 * Math.PI * r;
  return (
    <svg style={{ position: "absolute", left: x - r - width, top: y - r - width, overflow: "visible" }} width={2 * (r + width)} height={2 * (r + width)}>
      <circle
        cx={r + width}
        cy={r + width}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - p)}
        transform={`rotate(-90 ${r + width} ${r + width})`}
        strokeLinecap="round"
      />
    </svg>
  );
};

/** A framed sample walkthrough still with a mono timestamp label. */
export const EvidenceFrame: React.FC<{
  src: string;
  label: string;
  tone: "sage" | "issue";
  w: number;
  ring?: { x: number; y: number; r: number; from: number };
  style?: React.CSSProperties;
  labelSize?: number;
}> = ({ src, label, tone, w, ring, style, labelSize = 24 }) => {
  const h = (w * 9) / 16;
  const color = tone === "sage" ? C.sage : C.issue;
  return (
    <div style={{ position: "relative", width: w, ...style }}>
      <div
        style={{
          position: "relative",
          width: w,
          height: h,
          borderRadius: 18,
          overflow: "hidden",
          border: `1.5px solid ${C.border}`,
          boxShadow: "0 18px 50px rgba(32,33,31,0.12)",
          background: C.surface,
        }}
      >
        <Img src={staticFile(src)} style={{ width: w, height: h, objectFit: "cover" }} />
        {ring ? <Ring x={(ring.x / 1280) * w} y={(ring.y / 720) * h} r={(ring.r / 1280) * w} color={color} from={ring.from} /> : null}
      </div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 12, height: 12, borderRadius: 99, background: color }} />
        <Kicker size={labelSize} color={C.ink}>
          {label}
        </Kicker>
      </div>
    </div>
  );
};
