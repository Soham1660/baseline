# Verification Report

Prepared 2026-11-14 (PT) against commit `c2cbe3f` plus the three small changes listed below.

## 1. Build, typecheck, tests

| Check | Command | Result |
|---|---|---|
| Install | `bun install` (lockfile restored afterwards) | ✅ OK. ⚠️ `bun install --frozen-lockfile` fails because `bun.lock` is out of sync with `package.json`, and plain `npm install` fails with ERESOLVE (`vite@8` peer `esbuild ^0.27 \|\| ^0.28` vs pinned `esbuild ^0.25`). Make sure Render's build command uses one that works (`bun install` or `npm install --legacy-peer-deps`). |
| Typecheck | `tsc --noEmit` | ✅ 0 errors |
| Unit tests | `npm test` → `node --test src/utils/*.test.ts` | ✅ 20/20 pass (was 7 pass / 1 file failing under plain `node --test` because of an extensionless import; fixed) |
| Production build | `vite build` | ✅ Builds (761 kB JS chunk; size warning only) |
| Production server | `NODE_ENV=production PORT=3100 node server.ts` | ✅ Serves `dist/` + API |

## 2. Real-application verification (local production build, Playwright)

Script: `launch/scripts/verify.mjs`. Results: `launch/recordings/verify/results.json`.

| Feature | Result |
|---|---|
| `/api/health` | ✅ `ok:true`, reports key presence and model, never the key itself |
| Homepage + navigation | ✅ |
| Apartment creation | ✅ |
| Video upload + server SHA-256 fingerprint | ✅ |
| Gemini analysis (local) | ⚠️ **Not run locally.** No local key (by design, I did not search your machine for secrets). The app returned a clean `503 MISSING_API_KEY`, kept the video and its fingerprint, and offered Retry / Open Sample. |
| Manual timestamped observation (human review path) | ✅ |
| Confirm / edit findings | ✅ (captured on video) |
| Record persists across reload | ✅ (localStorage + IndexedDB) |
| Comparison view | ✅ (sample data) |
| Claim matcher | ✅ (sample data) |
| Editable reconsideration letter | ✅ 1,155 chars, editable |
| Evidence PDF export | ✅ 3-page PDF, ~80 kB, labeled "SAMPLE DEMONSTRATION RECORD" |
| Unknown `/api/*` → JSON 404 | ✅ |
| Uncaught page errors | ✅ None |
| Mobile layout (390×844) | ✅ Usable. Cosmetic: "Evidence Timeline" and "Click any marker…" labels touch at 390 px. |
| Desktop layout (1920×1080, 1440×900) | ✅ |

**Zero-damage on clean footage / genuine damage detection:** not verifiable without a live key. The code path is conservative: the system prompt and schema require zero `potential-damage` items when none is visible, and server-side normalization clamps timestamps and severities (`validateAndNormalizeObservations`, covered by tests). **Run the one-call smoke test on Render:** `node launch/scripts/verify.mjs https://baseline-vby8.onrender.com`. It makes exactly one analysis call on the 16-second sample video and saves the response to `recordings/verify/live-analysis.json`.

## 2b. Deployed app: https://baseline-vby8.onrender.com (verified 2026-11-14, ~1:50 PM PT)

- Cold load: **10.3 s** (HTTP 200). Warm load: **0.3 s**. `/api/health`: `{"ok":true,"hasGeminiKey":true,"primaryModel":"gemini-3.5-flash-lite"}`.
- `node verify.mjs https://baseline-vby8.onrender.com`: **13/13 pass**, no page errors.
- **Live Gemini analysis: ✅ succeeded.** One call, `gemini-3.5-flash-lite`, **3.6 s** round trip for the 16-second, 457 KB sample video. Raw response: `recordings/verify/live-analysis.json`.
- **What Gemini returned:** 4 `condition-observation` entries (wall + frame, wood floor, window wall + outlet, kitchen cabinets/tile), all "intact/clean", and **0 `potential-damage` findings**.
  - ✅ It did **not fabricate damage**, which is the conservative behavior the prompt asks for.
  - ⚠️ It **missed** the small synthetic defects that the sample move-in video does contain (floor scuff ~1.5 s, hairline wall crack ~4.8 s, countertop chip ~10.2 s). These are tiny, low-contrast drawings in a 1280×720 procedural video, so this is not a verdict on real footage, but it is a real false negative. The precomputed sample findings in the app and videos were **not** produced by this live call.
  - ⚠️ Severity came back as "unclear" for all intact surfaces (by schema design for non-damage entries).
- **Implications for launch copy:** say "Gemini proposes findings that you review", not "Gemini detects all damage". Don't quote 3.6 s as typical, since it's one call on a tiny file. Larger videos go through the Files API and will take longer.
- **Not yet tested live:** zero-damage behavior on *real* clean footage, and damage detection on *real* damaged footage. Do that with your own phone walkthrough (one call each) before making accuracy statements.

## 3. Storage and persistence (what to promise)

| Data | Where | Survives |
|---|---|---|
| Apartment records, findings, edits, letters | Browser localStorage | Reloads on the same browser/device. Not cross-device. |
| User video blobs | Browser IndexedDB | Same browser/device |
| Uploaded video (for Gemini) | Server `.baseline-tmp/videos`, token-protected | ✅ A process restart on the same disk (tested). ❌ Purged after **30 minutes**. ❌ Render Free's filesystem is ephemeral (lost on spin-down/redeploy). |

→ Never promise permanent server-side evidence storage. Launch copy says "records live in your browser; server copies expire after 30 minutes."

## 4. Security / secrets

- The Gemini key is read only server-side (`process.env.GEMINI_API_KEY`). It never reaches the frontend bundle, and `/api/health` returns only a boolean.
- Error text is sanitized (`sanitizeErrorText` redacts keys/Bearer/query tokens; tested).
- No secrets appear in any recording, still, or video. All captures used a local server with **no key configured**.
- Video access requires a per-upload token (verified: 403 without a token).

## 5. Changes made to the application (small, reversible)

1. `src/utils/pdfExport.ts`: wrap the header metadata line so landlord/lease/deposit no longer runs off the right edge of the PDF (it was visibly clipped: "Deposi…").
2. `src/utils/evidenceLogic.test.ts`: import `./evidenceLogic.ts` (with extension) so `node --test` runs natively.
3. `package.json`: added `"test": "node --test src/utils/*.test.ts"`.

Re-verified after the changes: tsc ✅, 20/20 tests ✅, build ✅, 14/14 Playwright checks ✅, PDF header visually checked ✅.

**Not changed (judgment calls):**
- No in-app cold-start note. During a Render cold start, Render serves its own loading page, so a note inside BASELINE would only appear after the wait is over. The disclosure lives in the README, video descriptions, one-pagers, and the video end cards.
- The missing-key error message mentions "Settings > Secrets" (AI Studio wording) and repeats itself. Production on Render has a key, so users shouldn't see it. Cosmetic.

## 6. Video QC

| File | Duration | Video | Audio | Loudness | Black frames |
|---|---|---|---|---|---|
| `videos/baseline-demo-60s.mp4` | **60.01 s** | H.264 High, 1920×1080, 30 fps, yuv420p | AAC-LC 48 kHz stereo | −19.0 LUFS, peak −7.1 dBFS | 0 |
| `videos/baseline-founder-pitch-120s.mp4` | **120.00 s** | H.264 High, 1920×1080, 30 fps, yuv420p | AAC-LC 48 kHz stereo | −19.0 LUFS, peak −7.3 dBFS | 0 |
| `videos/baseline-teaser-vertical.mp4` | **25.00 s** | H.264, 1080×1920, 30 fps, yuv420p | AAC-LC 48 kHz stereo | −18.9 LUFS, peak −6.9 dBFS | 0 |
| `graphics/youtube-thumbnail.png` | n/a | 1280×720 PNG | n/a | n/a | n/a |

Frames were inspected at the beginning, middle, and end of every scene (contact sheets in `recordings/qc/`). Fixes made during QC: hook frame sizing, pitch report-pan centering, thumbnail headline wrap, upload clip trimmed to end before the (expected) no-key error, and a re-recorded upload clip (my capture script had appended to the pre-filled deposit field).

**Honesty in the edit:** every scene showing precomputed sample data carries an on-screen "Sample demonstration" badge, on top of the app's own banners. The hook scenario is labeled "Illustrative scenario · synthetic sample walkthrough". The real upload scene (new record) is shown without findings attached. No sped-up wait is presented as real analysis speed, and no live analysis was implied.

**Audio:** an original score, synthesized from sine partials by `scripts/gen_score.py` (no samples, no third-party audio). I couldn't listen to it, so give it a quick listen. To render silent versions, pass `"withScore": false`.
