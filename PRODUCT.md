# The Nile Pen

## What it is
An independent publication covering South Sudan politics, human rights, water and land, diaspora voices, climate justice and opinion. Public site: https://thenilepen.com. Editor dashboard (CMS): https://app.thenilepen.com.

## Who uses what
- **Readers** (South Sudan, East Africa, the diaspora, anyone paying attention) read stories and Live updates, pitch stories, contact the team and subscribe to the newsletter.
- **Dalia Mori Wanki, founder and editor** (Kampala), runs the publication from the dashboard without touching code: writes and edits stories and Live posts, adds images, approves or declines submitted pitches, answers messages, manages subscribers, topics and the team.
- **Editors / writers** she invites get the same dashboard.

## Surfaces
- `site/` public site, Read mode. Design is final (see the design handoff); content comes from the CMS at build time.
- `app/` editor dashboard, Operate mode. Daily working tool, often on a laptop in daylight, sometimes on a phone. Must feel calm, fast and obvious to a non-technical editor.

## Brand
Ink #121417, red #c4262e (hover #a51d24), light red on dark #ff8a8f, greys #5d6166 / #8a8f95, borders #e3e5e8, light surface #f3f4f6. Barlow Condensed for headlines, Nunito Sans for body and UI. Logo: red square with a white N.

## Content model
Article (stories and Live briefs), Topic, Submission (pitch), Message, Subscriber, Settings, Editors. Stored in Supabase project `nile-pen`.
