# BASELINE: Hackathon Submission

**Event:** Berkeley x DeepMind Hackathon: Build. Ship. Pitch. Win. (Nov 14, 2026)
**Track:** Google AI Studio, **Online Track**
**Product:** BASELINE: *Your apartment. Your evidence.*

> Live URL verified 2026-11-14 ~1:50 PM PT: cold load 10.3 s, warm 0.3 s, `hasGeminiKey: true`, 13/13 end-to-end checks passing, including one live Gemini analysis.

## Deadline and rules: read first

From the official event page (https://luma.com/cqedho6j, checked 2026-11-14 at about 1:30 PM PT):

| Item | What the page says | Flag |
|---|---|---|
| Main deadline | "Submission Deadline (hard stop)" **10:30 AM PT**. Format update: "Everyone now builds and submits from home by 10:30 AM PT." | ⚠️ Already passed when this was prepared. |
| Online Track deadline | "end of day, November 14" (Online Track section and FAQ) | ⚠️ Conflicts with the 10:30 AM hard stop. **Confirm with the organizers now** and submit as soon as possible. |
| Submission form | **No form link appears on the page.** Registration is "Request to Join" / approval required. | ⚠️ Get the portal link from your registration email or the organizers. |
| Demo video visibility | "Your demo YouTube video must be shared publicly. Engagement counts toward your score." | Upload the 60-second demo as **Public**. |
| Engagement tracking | Phase 1: "Tracked during the hackathon (5:00 PM cutoff)". Phase 2: "2 weeks post-event" in one place, "7-day social engagement tracking" in another. | ⚠️ The two Phase 2 lengths conflict. Post before 5:00 PM PT if you can. |
| Online judging | "Judging based on traction: same conditions as Phase 2" | Social engagement matters most for this track. |
| Code link (AI Studio track) | "Google AI Studio share link, or a public GitHub repo for Antigravity CLI projects." | The GitHub repo is **private**. Use an **AI Studio share link** (see below). |
| Hosted prototype | "A working public demo link (Google Cloud Run recommended…)" | BASELINE runs on **Render Free**, not Cloud Run. Recommended is not required, but disclose it. |
| Data/ads consent | Submitting the "Playcast" authorizes organizers "to use your submission in paid social ads". You may opt out "prior to submission", but "data sharing with sponsors and investors is a condition of participation." | ⚠️ These statements conflict. Decide before submitting. |
| Winners announced | 5:00 PM in the schedule, 5:30 PM in Competition Format | Minor conflict. |

## Required deliverables checklist

| Requirement | Asset | Status |
|---|---|---|
| Track identification | "Google AI Studio" (Online Track) | ✅ Ready |
| Team one-pager | [`team-one-pager.md`](team-one-pager.md) | ✅ Ready. Add your full name/background if you want (see file). |
| Idea + prototype one-pager (incl. Google tools) | [`idea-one-pager.md`](idea-one-pager.md) | ✅ Ready |
| Public hosted prototype link | https://baseline-vby8.onrender.com | ✅ Verified live. Warm it up shortly before judging (see below). |
| 2-minute team intro + elevator pitch | `videos/baseline-founder-pitch-120s.mp4` (120.0 s) | ✅ Submittable as is. Stronger with your recorded 15-second intro (see `scripts/narration-scripts.md`). |
| 1-minute prototype demo ("Playcast") | `videos/baseline-demo-60s.mp4` (60.0 s) | ✅ Ready. Upload to YouTube **Public**. |
| Code repository / AI Studio link | AI Studio share link | ⚠️ You need to create or share it. The repo stays private unless you choose otherwise. |

## Copy to paste into the form

**Project name:** BASELINE

**Tagline:** Your apartment. Your evidence.

**Track:** Google AI Studio (Online)

**Short description (≤ 50 words):**
BASELINE turns move-in and move-out walkthrough videos into a timestamped, human-reviewed condition record. Gemini watches the footage and proposes findings with timestamps. Renters confirm or correct each one, compare move-in against move-out, match landlord deductions to frames, and export an editable reconsideration letter and a PDF evidence report.

**Google tools used:** Gemini API via the `@google/genai` SDK (video understanding with structured JSON output; primary model `gemini-3.5-flash-lite` with a configured free-tier fallback), built in Google AI Studio.

**Hosted prototype:** https://baseline-vby8.onrender.com. *Free-tier hosting: the first visit after a period of inactivity may take approximately one minute while the server starts. Subsequent requests are typically faster.*

**Demo video (public YouTube):** `[YOUTUBE_DEMO_URL]`
**Pitch video:** `[YOUTUBE_PITCH_URL]`
**Code:** `[AI_STUDIO_SHARE_URL]`

## Before you submit (5 minutes)

1. Open https://baseline-vby8.onrender.com and wait for it to load (cold start ≈ 1 minute). Then open `https://baseline-vby8.onrender.com/api/health` and confirm `"hasGeminiKey": true`.
2. Run the one-call live smoke test from this repo: `cd launch/scripts && node verify.mjs https://baseline-vby8.onrender.com`. It makes **one** Gemini analysis call on the 16-second sample video.
3. ✅ Done: the video end cards already show baseline-vby8.onrender.com.
4. Upload the demo to YouTube as **Public** using `youtube-metadata.md`, then paste the link into the form.
5. Post the launch posts from `social-launch-kit.md`.

## What judges should know (honest framing)

- The sample case (742 Valencia St, Apt 4B) is a **clearly labeled sample demonstration**: synthetic walkthrough videos with precomputed findings. Live Gemini analysis runs when you upload your own video to a new apartment record.
- AI findings are proposals, not proof. Every finding can be confirmed, edited, or dismissed. The report keeps the original AI text next to your edits.
- Apartment records are stored in the renter's browser (localStorage + IndexedDB). Server copies of uploaded videos are temporary: they are purged after 30 minutes, and Render Free's disk does not survive restarts.
