# VocalFlash commercial MVP and pilot validation v1

Status: product strategy proposal, not validated market research and not a release authorization.

## Commercial thesis

VocalFlash should be sold as a WhatsApp work-intake assistant, not as a generic voice transcription service. The customer outcome is: fewer interruptions, fewer lost details, less repeated questioning, and a clearer handoff from a WhatsApp message to a usable work request.

The product promise must remain bounded: it can collect and organize information, ask for missing details, and propose next steps. It must not claim that a job was created, assigned, booked, or completed unless the corresponding persisted state confirms that outcome.

## Launch wedge: field-service operators

Pilot first with a narrow group of small service businesses (for example, plumbing and general maintenance), while preserving the multi-sector architecture. This is a sequencing choice, not a decision to limit the long-term product to one trade.

Why this wedge is testable:
- incoming requests often arrive while the operator is working;
- a request can be evaluated using a small, concrete set of fields (problem, location, contact, urgency, availability, photos when relevant);
- the value can be measured against the current manual process;
- it avoids launching simultaneously into sectors with materially different confidentiality, safety, compliance, and workflow requirements.

Do not advertise medical, legal, financial, or other sensitive-sector readiness merely because a classifier has sector labels. Each sector needs its own policies, data handling, workflows, terminology review, and acceptance tests.

## Minimum sellable outcome

A pilot should only be marketed as an assistant for request intake when all of the following work together:
1. A verified business WhatsApp channel maps to exactly one business.
2. Incoming text and supported voice messages are received, deduplicated, and persisted.
3. The assistant identifies the likely request type and asks only for missing or uncertain required details.
4. It preserves context across later messages and process restarts.
5. It gives the customer an honest acknowledgement and never claims a work item exists before persistence confirms it.
6. A proposed work item is created only under an explicit business policy; uncertain values and unsupported workflows fail closed.
7. The owner can review and control actions, and owner commands are authenticated separately from customer requests.
8. Outbound sends have durable intent, bounded retry rules, and an operational path for ambiguous outcomes.
9. Failures are observable without logging secrets, full private messages, or media URLs.
10. A documented rollback and support process exists.

A green unit-test suite or a working Preview is not enough to claim these outcomes. The complete Vercel + Supabase + Meta/WhatsApp path must pass in staging.

## Keep the first release intentionally narrow

Include:
- text intake and the established single-vocal transcription/summarization path;
- one pilot trade's reviewed workflows and required fields;
- clarification questions for missing or uncertain data;
- explicit acknowledgement and owner review;
- minimal operational status and a way to escalate to a human.

Do not promise at launch:
- automatic work creation across every sector;
- photo understanding until media ingestion, privacy, storage, and vision processing pass end-to-end tests;
- multi-voice reliability until batching/restart/concurrency regression passes on the current candidate;
- WhatsApp group summaries without verified Meta product/API eligibility and policy;
- medical/legal/financial autonomy without sector-specific governance;
- "exactly once" delivery while the outbound system is at-most-once with a 24-hour Redis marker;
- persistent multi-turn context until the isolated database design is implemented and tested.

## Pilot design

Run a small, consent-based pilot with approximately 5–10 businesses in the same initial service segment for 2–3 weeks. Treat this as usability and workflow validation, not as statistically representative market research.

Capture baseline and assisted outcomes:
- time from inbound request to a usable work summary;
- number of clarification turns before required information is complete;
- percentage of requests that need manual correction;
- missed, duplicated, or misleading acknowledgements;
- owner interruptions and manual re-entry avoided;
- latency, failure rate, and cost per handled request;
- opt-out rate, human handoff rate, and reasons for handoff.

Before the pilot, define acceptance thresholds and collect the same baseline measurements without VocalFlash. Freeze a consented or synthetic regression corpus for technical quality; do not use customer content for training or benchmarking without appropriate permission and privacy review.

## Commercial validation and pricing

The existing VocalFlash questionnaire has only two responses. It is useful as an early signal, not as evidence of market size, conversion, or a validated price.

Test pricing with actual usage and willingness-to-pay interviews. A sensible experiment is to compare a low-entry plan with a higher plan that includes more monthly requests or stronger workflow features; exact prices must be set only after:
- calculating Meta/WhatsApp charges, transcription/model usage, hosting/database, support, and payment fees;
- estimating cost per active business at low, normal, and peak usage;
- deciding fair-use limits and what happens when a limit is reached;
- defining trial, cancellation, retention, and data-export behavior.

Do not optimize price by ignoring support cost or by assuming every voice message has the same processing cost. Track contribution margin per active business and per handled request.

## Suggested go/no-go criteria for a paid pilot

These are proposed operating gates to review before the pilot, not current results:
- zero unauthorized or cross-business writes in the test corpus;
- zero false claims that a request was created or a message was delivered;
- all supported failure paths produce a safe fallback or human handoff;
- no duplicate work item under tested webhook replay and concurrency cases;
- all required fields are either confirmed or explicitly marked missing/uncertain;
- the owner can inspect and correct the resulting request without losing the original event history;
- measurable reduction in manual re-entry or interruption for participating operators;
- positive unit economics under realistic message volume and support assumptions.

Any security, data-isolation, persistence, or ambiguous-delivery failure is a no-go even if users like the demo.

## Current evidence status

- Product positioning and pilot gates: documented proposal.
- Questionnaire evidence: two responses only; insufficient to validate demand or pricing.
- Assistant code tests: run only for the exact SHAs linked from the development PR.
- Full staging integration, persistent conversation state, durable outbound reconciliation, photo flow, and sector-by-sector model quality: not yet proven as a combined release.
- This document does not authorize a merge, production deployment, database branch, schema change, or new paid service.
