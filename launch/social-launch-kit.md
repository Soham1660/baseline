# Social Launch Kit

Ground rules: organic posting only. Don't buy views, use engagement pods, or post the same text in many places. Ask real people for real feedback. Replace https://baseline-vby8.onrender.com and `[YOUTUBE_DEMO_URL]` before posting.

Timing: the event page says Phase 1 engagement is "Tracked during the hackathon (5:00 PM cutoff)", then 7 days (or 2 weeks; the page conflicts) of post-event tracking. **Publish the YouTube demo first, then these posts, ideally before 5:00 PM PT today.**

---

## LinkedIn

```
Moving out of an apartment usually ends the same way: an itemized list of deductions, and a scramble through your camera roll to prove what the place looked like on day one.

Today I shipped BASELINE for the Berkeley x DeepMind Hackathon (Google AI Studio track).

BASELINE turns a move-in walkthrough video into organized evidence:
→ Gemini watches the video and proposes timestamped findings (room, surface, visible condition, confidence)
→ You confirm, edit, or dismiss every one. Nothing counts until a person reviews it.
→ Compare move-in vs. move-out side by side, with explicit caveats on what video can't show
→ Match each landlord deduction to the frames that support it
→ Export an editable reconsideration letter + a PDF evidence report with SHA-256 file fingerprints

Some design choices I care about:
• Conservative by default: Gemini is prompted to return zero damage findings when none is visible
• Honest limits: a file fingerprint proves the file wasn't altered later, not when it was filmed. The app says so.
• Private by default: records live in your browser. No account needed.

60-second demo: [YOUTUBE_DEMO_URL]
Try the sample case: https://baseline-vby8.onrender.com (free-tier hosting, so the first load can take about a minute)

If you've ever disputed a deposit deduction, or you work in campus housing or tenant advocacy, I'd love your feedback.

#BuildWithGemini #GoogleAIStudio #Hackathon #Renters
```

---

## X (Twitter)

**Post 1 (with the 60s video natively attached, or the YouTube link):**
```
Your landlord says you caused the damage. Can you prove you didn't?

I built BASELINE: upload your apartment walkthrough → Gemini logs timestamped findings → you review them → compare move-in vs. move-out → export a PDF evidence report.

Demo ↓ [YOUTUBE_DEMO_URL]
```

**Reply (thread):**
```
Built in Google AI Studio for the Berkeley x DeepMind hackathon.

Every AI finding is a proposal until you confirm it. Files get SHA-256 fingerprints. And it tells you what video can't prove.

Try the sample case (free tier, first load ~1 min): https://baseline-vby8.onrender.com
```

---

## Reddit

Rules differ by community and many ban self-promotion. **Read each subreddit's rules and sidebar first.** Prefer a single honest post where tools or projects are explicitly allowed (e.g., r/SideProject, r/webdev showcase threads, r/GoogleGeminiAI if it permits project posts). Do **not** post promotional content to r/Tenant, r/legaladvice, or r/renting unless their rules allow it. There, help in comments and only mention BASELINE when it's directly relevant and allowed.

**r/SideProject (or similar show-and-tell community):**

Title: `I built a tool that turns apartment walkthrough videos into timestamped move-out evidence (Gemini + human review)`

```
Hackathon project, shipped today. BASELINE takes a move-in walkthrough video and turns it into an organized condition record:

- Gemini proposes findings with timestamps (room, surface, visible condition, confidence, uncertainty notes)
- You confirm/edit/dismiss each one. The original AI text is preserved next to your edits.
- Compare move-in vs move-out; each area gets a conservative label (potentially pre-existing / potentially new / no clear change / insufficient evidence)
- Match a landlord's deduction line to the frames that support it
- Export an editable letter + PDF report with SHA-256 fingerprints of both videos

Things I'd love feedback on:
1. Is the comparison wording careful enough? I tried hard not to over-claim.
2. Would you trust it more or less if it never stored your video server-side?

Demo (60s): [YOUTUBE_DEMO_URL]
Sample case, no signup: https://baseline-vby8.onrender.com (free tier, so the first load takes ~1 min)

Not legal advice. The sample apartment uses synthetic videos with precomputed findings, labeled as such.
```

---

## Instagram Reels / TikTok / YouTube Shorts caption

Video: `videos/baseline-teaser-vertical.mp4` (native 1080×1920, 25 s; captions sit above the platform UI)

```
Could a short apartment video help protect your security deposit? 🏠

Film your move-in walkthrough → BASELINE logs what's visible with timestamps → compares move-in vs. move-out → builds your letter + PDF evidence report.

Free sample case: link in bio
(Sample shown is a labeled demo. Not legal advice.)

#renting #securitydeposit #apartmenttips #movingout #firstapartment #studentlife
```

On-screen text is already burned in. For TikTok, add the platform's auto-captions only if you record a voiceover.

---

## Follow-up community engagement plan (7–14 days)

| When | Action |
|---|---|
| Day 0 (today, before 5 PM PT) | Publish the demo (Public). Post LinkedIn, then X. Share with friends who rent or have moved recently and ask them for honest feedback, not for likes. |
| Day 0 evening | Reply to every comment. Pin the YouTube comment. Fix anything people find confusing. |
| Day 1 | Post the vertical teaser to Shorts, Reels, and TikTok. Share in one allowed project-showcase community (Reddit or Discord). |
| Day 2–3 | Post a short "what I learned building with Gemini video understanding" thread with a real detail (e.g., prompting for zero findings on clean footage). Developer audiences share build notes. |
| Day 3–5 | Email 2–3 campus housing offices or tenant groups with the one-pager. Ask for a 15-minute feedback call, not a partnership. |
| Day 5–7 | Post one honest update: a fix you shipped from feedback. Thank the people who gave it (with permission). |
| Ongoing | Never fake numbers. Never post the same text across many communities. Disclose that you built it whenever you mention it. |

**Measure:** YouTube views, average view duration, and likes; replies with real feedback; sample-case opens (if you add privacy-respecting analytics later).
