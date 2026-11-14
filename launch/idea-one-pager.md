# BASELINE: Idea & Prototype One-Pager

**Your apartment. Your evidence.**
Live prototype: https://baseline-vby8.onrender.com · Track: Google AI Studio (Online)

## The problem

Move-out often ends with an itemized list of security-deposit deductions. To dispute one, a renter needs to show what the apartment looked like on day one. Many renters filmed a walkthrough. Few can find the right moment, timestamp it, or line it up against the move-out footage. A camera roll stores video, but it doesn't organize evidence.

## The product

BASELINE turns walkthrough videos into an organized, human-reviewed condition record:

1. **Create an apartment record** (no account needed).
2. **Upload the move-in walkthrough.** BASELINE computes a SHA-256 fingerprint and logs the file's metadata.
3. **Gemini analyzes the video** and returns structured findings: room, surface, visible condition, timestamp, severity, confidence, and an uncertainty note.
4. **Review every finding.** Confirm, edit, or dismiss it. Click a timestamp to jump to the exact frame, or mark your own observations.
5. **Upload the move-out walkthrough and compare** the two inspections side by side. Each area is classified conservatively: *potentially pre-existing*, *potentially new*, *no clear change*, or *insufficient evidence*. Visibility caveats are stated.
6. **Match landlord deductions** to the supporting frames.
7. **Export** an editable reconsideration letter and a PDF evidence report with hashes, timestamps, frames, and review status.

## How Google tools are used

| Tool | Use |
|---|---|
| **Gemini API** (`@google/genai`) | Video understanding on the uploaded walkthrough (sent inline under 14 MB, or through the Files API), comparison of two inspections, claim-to-evidence matching, and letter drafting. Every call uses `responseSchema` structured JSON output. |
| **Gemini models** | Primary `gemini-3.5-flash-lite`, with a free-tier fallback model configured. Bounded retry with backoff that honors `Retry-After`. |
| **Google AI Studio** | Where BASELINE was built (AI Studio Build app scaffold, server-side Gemini capability). |

**Conservative by design.** The system prompt asks Gemini to separate visible physical damage from intact or unassessable surfaces, to return **zero** damage findings when none is visible, and never to invent damage or timestamps. The server clamps every timestamp to the video's duration and normalizes severity, confidence, and classifications.

## Why it's different

- **Not a gallery:** findings are timestamped, structured, and comparable across move-in and move-out.
- **Not a chatbot:** each claim cites frames, each file is fingerprinted, and the human is the reviewer of record.
- **Honest about limits:** a SHA-256 fingerprint shows a file wasn't altered after hashing. It doesn't prove when the video was filmed. BASELINE says so in the app and in the PDF.

## Who it's for and how it reaches them (proposed)

- Renters, starting with students who move every lease cycle.
- Tenant unions and renter-advocacy organizations.
- University off-campus housing offices.

Free for individual renters. Distribution would run through the campus housing offices and tenant groups that already help people at move-out.

## Limitations (stated plainly)

- Not legal advice, and not proof on its own. AI can miss or misread details.
- The built-in sample case uses synthetic videos with precomputed findings and is labeled as such everywhere.
- Records live in the user's browser. Server copies of uploads expire after 30 minutes and do not persist across free-tier restarts.
- **Hosting:** BASELINE currently runs on free-tier hosting. The first visit after a period of inactivity may take approximately one minute while the server starts. Subsequent requests are typically faster. Gemini usage on the free tier is subject to quota.
