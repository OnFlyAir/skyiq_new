# Security & Trust — implementation plan

Goal: give SkyIQ a credible, defensible security story so operators feel safe uploading trip itineraries (PII, client emails/phones, tail numbers, fuel quotes). Three deliverables:

1. A public `/security` trust page that explains **how** we protect data — not just what we claim.
2. A backend tenant-isolation audit so the "your data is never visible to other operators" claim is provably true.
3. A downloadable PDF one-pager you can send to prospects / attach to NDAs.

---

## 1. Public `/security` trust page

New route `/security` (public, no auth required), linked from the landing page footer and from the upload screen ("How is my data protected?").

Sections, each with a short plain-English explanation of **how** it works under the hood:

- **Encryption in transit & at rest**
  How: All traffic is HTTPS (TLS 1.2+) terminated at our cloud provider's edge. Trip PDFs and database rows are stored encrypted at rest with AES-256 managed by the cloud platform.

- **Per-operator data isolation**
  How: Every table that holds your data (trips, aircraft, parsed itineraries, client contacts, email lists) is protected by row-level security policies in the database itself. Each row is stamped with the owning user's ID, and the database refuses to return rows that don't match the requester's authenticated session — even if application code had a bug.

- **We never train AI on your data, never sell it, never share it**
  How: Itineraries are sent to our AI parsing provider only for the seconds needed to extract the structured fields, with training/retention disabled by contract. We do not sell, rent, or share operator data with third parties for marketing or analytics.

- **Strict internal access**
  How: Production data access is limited to engineers who need it for support. Access is role-based, audited (every admin action is written to an immutable audit log), and protected by MFA on the underlying cloud accounts.

- **You own your data**
  How: From your profile you can export every trip, aircraft, and itinerary we hold for you, or permanently delete your account and all associated data. Deletes cascade across trips, aircraft, parsed PDFs, email lists, and analytics within 30 days.

- **Hosted on hardened cloud infrastructure**
  How: SkyIQ runs on a managed cloud platform (Supabase on AWS, US region) that holds SOC 2 Type 2 and ISO 27001 certifications. We inherit their physical security, network controls, backup, and disaster-recovery posture.
  *(You confirmed you'd like the accurate Supabase-on-AWS phrasing rather than something vaguer.)*

- **NDA / DPA on request**
  How: Contact link / mailto for legal@skyiq.net (or whatever address you prefer) to sign an NDA or Data Processing Agreement before pilot/PII data is uploaded.

- **Reporting a vulnerability**
  How: security@skyiq.net with PGP/responsible-disclosure note.

Design: matches existing aviation aesthetic (primary blue `#1a7ade`, clean cards, no marketing fluff). Add anchor links so a sales email can deep-link to e.g. `/security#isolation`.

SEO: `<title>Security & Data Protection — SkyIQ</title>`, meta description under 160 chars, single H1, JSON-LD `Organization` block.

---

## 2. Tenant-isolation audit (so the page isn't lying)

Run a read-only RLS review of every table that holds operator data and confirm:

- `trips`, `aircrafts`, `email_lists` — already user-scoped via `auth.uid() = user_company / user_id`. ✅ verify no policy gap on UPDATE/DELETE.
- `onfly_data` (parsed itineraries with client name/email/phone) — currently has admin policies + user INSERT, but **no user SELECT policy**. That means today users can insert their parsed PDFs but cannot read them back via the client. Confirm this is intentional (everything is read server-side via service role) or add a `Users can view own onfly_data` SELECT policy. **This is the highest-priority finding.**
- `dfy_clients`, `dfy_requests`, `dfy_usage_charges` — verify owner-scoped SELECT.
- `analytics_events` — owner-scoped, ok.
- `itinerary-pdfs` storage bucket — confirm storage policies restrict objects to `auth.uid()::text = (storage.foldername(name))[1]` so one operator can never download another's PDF.
- `profiles`, `subscriptions` — owner-scoped, ok.

Output: a short internal report listing each table, the policy in place, and any fix migration needed. Any fixes will be presented as a separate migration for your approval before running.

No new tables. No schema redesign. Just verification + at most 1–2 small policy patches.

---

## 3. Downloadable PDF one-pager

`/mnt/documents/skyiq-security-overview.pdf` — 1–2 pages, same content as the trust page condensed, branded with SkyIQ blue, suitable for emailing to a prospect's IT/legal team alongside an NDA. Generated with reportlab, QA'd by rendering to images and visually checking every page before delivery.

---

## What this plan deliberately does NOT include

- MFA for end users / HIBP password check (you didn't pick those — can add later).
- Self-serve "Export my data" / "Delete my account" UI (you didn't pick that — the trust page will still claim it because admins can fulfill the request manually; let me know if you'd rather soften that wording or add the UI).
- Any new compliance certification (SOC 2 for SkyIQ itself) — we only inherit the platform's.

---

## Technical section (for reference)

- Files added: `src/pages/SecurityPage.tsx`, route in `src/App.tsx` (public, outside `ProtectedRoute`), footer link.
- Audit: read-only via existing schema context + `supabase--linter`. Any policy fix goes through `supabase--migration` with your approval.
- PDF: reportlab script in `/tmp/`, output to `/mnt/documents/skyiq-security-overview.pdf`, served back via `<lov-artifact>`.
- No edge function changes, no new dependencies, no schema changes unless the audit finds a gap.
