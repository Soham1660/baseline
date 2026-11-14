# BASELINE

**Your apartment. Your evidence.**

BASELINE is a Gemini-powered rental inspection and security-deposit evidence app. It turns move-in and move-out walkthrough videos into a timestamped, human-reviewed condition record, matches landlord deductions to the footage, and exports an editable reconsideration letter and a PDF evidence report.

**Live prototype:** https://baseline-vby8.onrender.com

> **Hosting note:** BASELINE currently runs on free-tier hosting. The first visit after a period of inactivity may take approximately one minute while the server starts. Subsequent requests are typically faster.

## How it works

1. Create an apartment record (no account needed).
2. Upload your move-in walkthrough. BASELINE computes a SHA-256 fingerprint.
3. Gemini examines the video and proposes findings: room, surface, visible condition, timestamp, severity, confidence. It is prompted to separate visible damage from intact surfaces and to return zero damage findings when none is visible.
4. Review every finding: confirm, edit (the original AI text is kept), or dismiss it.
5. Upload the move-out walkthrough and compare the two inspections conservatively.
6. Match landlord deductions to supporting frames.
7. Export an editable reconsideration letter and a PDF evidence report.

Click **Explore Sample Apartment** to see the full workflow instantly. The sample uses synthetic walkthrough videos with **precomputed** findings and is labeled as a sample demonstration throughout.

## What BASELINE is not

- Not legal advice, and not proof on its own. AI findings can be wrong. A person reviews each one.
- A SHA-256 fingerprint shows a file wasn't altered after hashing. It does not prove when or where a video was filmed.
- **Storage:** apartment records live in your browser (localStorage + IndexedDB) on the device you used. Videos uploaded for analysis are stored on the server only temporarily (purged after 30 minutes, and not persisted across free-tier restarts). Keep your original video files.
- Gemini usage runs on free-tier quotas, so heavy use may be rate-limited.

## Run locally

```bash
bun install            # note: `npm install` currently needs --legacy-peer-deps
cp .env.example .env   # set GEMINI_API_KEY (server-side only; never commit it)
npm run dev            # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (Express + Vite middleware) |
| `npm run build` | Production frontend build to `dist/` |
| `npm start` | Production server (serves `dist/` + API) |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm test` | Unit tests (`node --test`) |

The Gemini API key is read only on the server (`process.env.GEMINI_API_KEY`). It is never sent to the browser, and `/api/health` reports only whether one is configured.

## Built with

Gemini API (`@google/genai`, structured JSON output, video understanding) · Google AI Studio · React 19 · Vite · Express · jsPDF

Launch materials (videos, one-pagers, verification report) are in [`launch/`](launch/README.md).
