# Narration Scripts & Founder Recording Guide

The rendered videos are caption-led, so they work fully muted. They use an original synthesized score and no synthetic voice. If you record your own voice, these scripts are timed to the existing edit (~150 words per minute).

---

## A. Founder intro: record this (≈14 s, replaces the pitch's title card)

**Setup (phone is fine):** landscape 16:9, eye-level, window light in front of you, quiet room, phone 2–3 feet away. Record 3 takes. Use your own words; this is a guide.

> "Hi, I'm [your full name]. [One true line about you, e.g. your school or what you build.] I'm building BASELINE because [your real reason, in one sentence]. It helps renters prove what their apartment looked like on day one."

**Drop it in:**
```bash
cp ~/path/to/intro.mp4 launch/remotion/public/founder/intro.mp4
cd launch/remotion
npx remotion render Pitch120 ../videos/baseline-founder-pitch-120s.mp4 \
  --props='{"founderName":"YOUR FULL NAME","founderHandle":"github.com/Soham1660","founderClip":"founder/intro.mp4","appUrl":"baseline-vby8.onrender.com","withScore":true}' \
  --codec=h264 --crf=18 --pixel-format=yuv420p --audio-codec=aac
```
The first 14.3 s of your clip plays full-frame with a name lower-third, and the score ducks under your voice. Keep your take to about 14 s, or adjust `PITCH.intro` in `src/Pitch120.tsx`.

---

## B. 60-second demo: optional voiceover (matches on-screen captions)

| Time | Line |
|---|---|
| 0:00 | Your landlord says you caused the damage. Can you prove you didn't? |
| 0:04 | Most evidence is buried in your camera roll. Unlabeled clips, no timestamps, nothing to compare against. |
| 0:10 | BASELINE turns your apartment walkthrough into organized evidence. Create a record, then upload your walkthrough video. |
| 0:20 | Gemini reviews the walkthrough and logs what's visible, with timestamps. Click any finding to jump to that frame. |
| 0:27 | And it's honest about uncertainty: lighting, angle and motion blur get flagged. Nothing counts until you confirm, edit, or dismiss it. |
| 0:35 | Then compare move-in and move-out side by side. Here: rub marks on the lower baseboard, potentially new, with a caveat on what video can't prove. |
| 0:43 | Match each landlord deduction to the frames that support it. |
| 0:47 | Draft a polite reconsideration letter (you edit every word) and export a timestamped PDF evidence report. |
| 0:55 | BASELINE. Your apartment. Your evidence. |

*(If you voice the demo, say once: "This is the built-in sample case.")*

---

## C. 120-second pitch: full script (matches on-screen text)

**0:00 Intro (your recording, or the title card)**
I'm building BASELINE so renters can prove what their apartment looked like on the day they moved in.

**0:14 Problem**
Move-out ends with an itemized list of deductions. Disputing one takes evidence of what the apartment looked like on day one. Most renters filmed something. Few can find it, timestamp it, or line it up against the move-out.

**0:32 Why not a gallery or a chatbot**
Evidence needs structure, not storage. A photo gallery stores files: no findings, no timestamps, nothing to compare. A generic chatbot answers questions, but it has no file fingerprint and no frame-level citations. BASELINE gives you timestamped findings, fingerprinted video, and a human-reviewed move-in versus move-out comparison.

**0:46 How Gemini is used**
Gemini watches the walkthrough video itself and returns structured findings: room, surface, visible condition, timestamp, severity and confidence. It's prompted to stay conservative and return zero damage findings when none is visible. Your own walkthrough goes through the same pipeline: upload, fingerprint, analyze.

**1:06 Human review and integrity**
Every AI finding is a proposal until a person confirms, edits, or dismisses it. Edits keep the original AI text, and every video gets a SHA-256 fingerprint. A fingerprint shows a file wasn't altered later. It can't prove when it was filmed, and we say so.

**1:22 Working prototype**
Working today: move-in versus move-out comparison, claim-to-evidence matching, an editable reconsideration letter, and a downloadable PDF evidence report.

**1:36 Customers and go-to-market**
We'd start where moves happen every year: students first, then tenant unions and advocacy groups, and university off-campus housing offices. It's free for individual renters, distributed through the groups that already help people at move-out.

**1:48 Limitations**
What BASELINE is not: legal advice, or proof on its own. AI can miss or misread, so a person reviews every finding. Records live in your browser, and server copies of uploads expire after 30 minutes. And it's on free-tier hosting, so the first load can take about a minute.

**1:56 Close**
BASELINE. Your apartment. Your evidence.
