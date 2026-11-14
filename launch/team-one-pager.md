# BASELINE: Team One-Pager

**Team:** Solo founder
**Founder:** Soham (GitHub: [@Soham1660](https://github.com/Soham1660))
**Track:** Google AI Studio (Online)

> **Your input needed:** The project materials contain no founder bio, school, or achievements, so none are listed here. Add your full name and 1–3 lines of background that are true. Good candidates are your school/program, relevant things you have shipped, and why this problem matters to you. Keep it plain and verifiable. Delete this note when done.

## Who built it

BASELINE was designed, built, and shipped solo for this hackathon. In one build cycle:

- A full-stack TypeScript app (React 19 + Vite frontend, Express server) built in Google AI Studio
- Server-side Gemini video analysis with structured JSON output, conservative prompting, retry with backoff, and free-tier model fallback
- Evidence integrity features: SHA-256 fingerprinting of every uploaded video, token-protected temporary server storage, and preserved original AI text next to human edits
- An end-to-end renter workflow: inspection → human review → move-in/move-out comparison → claim matching → editable letter → PDF evidence report
- A test suite of 20 passing unit tests covering evidence normalization, conservative classification, and Gemini error parsing (including API-key redaction)
- Deployment to a public URL on Render's free tier

## How we work

- **Evidence first.** The product never claims more than the footage shows. It labels uncertainty, separates "potentially new" from "insufficient evidence", and tells users what video can't prove.
- **Human in the loop.** AI output is a draft. The renter is the reviewer of record.
- **$0 stack.** Free-tier Gemini models, free hosting, no paid services.

## What we're looking for

Feedback from renters, tenant organizations, and campus housing offices on the move-out workflow, plus introductions to anyone who handles deposit disputes at scale.
