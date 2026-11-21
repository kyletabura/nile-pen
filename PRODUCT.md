# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Readers, everyone paying attention to the region:** South Sudanese at home (Juba and beyond, mostly on phones), the diaspora (US, UK, Canada, Australia, Uganda, Kenya), and policy, NGO, research and press readers following South Sudan and the Nile Basin. Their job: understand what is happening and why it matters, quickly and from a source they trust.
- **Young African writers:** pitch and publish their work through "Write for The Nile Pen". Their job: get a story idea seen, edited and published.
- **Dalia Mori Wanki, founder and editor (Kampala), and the editors she invites:** run the publication from the newsroom dashboard at app.thenilepen.com without touching code: write and publish stories and Live updates, add images, review pitches, answer messages, manage subscribers, topics and the team.

## Product Purpose
An independent publication covering South Sudan politics, human rights, water and land, diaspora voices, climate justice and opinion. Success: readers across the region and abroad come back for reporting they trust, and young writers see it as the place to bring their best work.

## Positioning
- A platform for young African writers, edited with care.
- Clear, credited Nile Pen summaries of other outlets' reporting alongside original analysis.
- Human rights, water, land and climate justice sit at the centre of the coverage, not the edges.
- Independent: not tied to a government, party or donor.

## Operating Context
- Public site: https://thenilepen.com (`site/`), a static multi-page site rebuilt from the CMS on every publish.
- Newsroom dashboard: https://app.thenilepen.com (`app/`), used daily by Dalia, often on a laptop in daylight and sometimes on a phone.
- Content, logins, pitches, messages, subscribers and images live in the Supabase project `nile-pen`. Publishing triggers a Vercel rebuild (about a minute).
- Pitches arrive through the Submit form and are approved (optionally becoming a draft story) or declined in the dashboard. Replies go out from the editor's own email.

## Capabilities and Constraints
- **Cheap phones, slow data:** pages must stay light and fast for readers paying per megabyte.
- **Writer safety:** some contributors may need to publish under a pen name or stay anonymous; never expose a contributor's real details beyond what they chose.
- Content types: Story (long form), Live update (short credited summary with a link to the source), Topic (six sections in a fixed menu order), Pitch, Message, Subscriber.
- Newsroom access is locked down: temporary passwords must be replaced, optional two-step verification enforced by the database, inactivity sign-out, owner-only team management.
- Email notifications for new pitches/messages and a newsletter sending provider are not set up yet (undecided).

## Brand Commitments
- Name: The Nile Pen. Logo: red square with a white "N".
- Colours: ink #121417, red #c4262e (hover #a51d24), light red on dark #ff8a8f. Barlow Condensed for headlines, Nunito Sans for body and UI.
- The public site's design (from the design handoff) is final; content changes, the look does not.

## Evidence on Hand
- 65 published items in the CMS: 6 original stories and 59 credited Live summaries (imported from the design handoff seed content).
- **Still missing, do not fabricate:** Dalia's portrait, writer bios and headshots, real photos (current stock images are placeholders), real social media links, newsletter provider. Privacy and Terms wording is not yet signed off by Dalia.
- No testimonials, readership numbers or press coverage exist yet; never invent them.

## Product Principles
1. Trust first: credit every source, label summaries as summaries, keep opinion clearly marked.
2. Light enough for a slow phone connection in Juba.
3. Protect the people behind the stories: writers, sources and the newsroom's accounts.
4. Let Dalia run everything herself: no task should need a developer.
5. Give young writers a real path from pitch to published.

## Accessibility & Inclusion
Readers are often on low-end phones and slow, expensive data; pages and images must stay small and readable on small screens. Many readers use English as a second language: plain, clear wording.
