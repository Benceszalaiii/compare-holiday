# Product

## Register

product

## Platform

web

## Users

A single person planning a holiday for a small group, working from a laptop late in the evening with a dozen browser tabs already open — Skyscanner, Wizz Air, Booking, Airbnb. They are mid-research, not browsing for inspiration. The job is to stop losing findings: every time they price a city they want the numbers to land somewhere durable so that tomorrow's session builds on today's instead of restarting it. Frequency is bursty — several destinations entered in one sitting, then nothing for days.

## Product Purpose

A private research console for comparing holiday destinations on total cost. The user enters only what they had to look up by hand — the place, the dates, the flight they found, the hotels they are considering — and the app derives everything else: nights, per-night rates, per-person splits, per-day cost, and the hotel metadata pulled from the listing URL. Success is that the user opens it instead of a spreadsheet, and that a destination can be added in well under a minute without leaving the keyboard.

## Positioning

The one place holiday research accumulates, where the only thing typed is the thing that was looked up.

## Brand Personality

A precise, quiet instrument. It behaves like a tool the user already knows: compact, keyboard-forward, unhurried, and completely uninterested in being charming. Numbers are the loudest thing on the page. It never celebrates, never nags, and never explains what is already obvious. Three words: exact, dense, calm.

## Anti-references

Not a travel booking site. No aspirational hero photography, no destination marketing copy, no "Discover your next adventure", no price badges shouting a deal, no urgency devices of any kind. Equally not a raw spreadsheet — the hotel imagery and the cost hierarchy are what make it faster to read than a table. No onboarding wizard, no modal-first flows, no confetti.

## Design Principles

Derive, don't ask. Any figure the app can compute from what it already knows is never an input field. Nights, per-night, per-person, per-day, and every hotel's title, image, and location are the app's job, not the user's.

Entry speed is the feature. The form is the primary surface and stays reachable at all times. A destination that takes a minute to enter is a destination that gets entered.

One number rules the list. Total trip cost is the comparison axis; every other figure is support and is typeset as support.

Show the work. Derived values are always visibly traceable back to their inputs, because the user is making a real financial decision and needs to trust the arithmetic.

Degrade honestly. Remote metadata fetching will fail against Booking and Airbnb sometimes. When it does the app says so plainly and hands the user an editable field, rather than silently saving a blank card.

## Accessibility & Inclusion

WCAG 2.1 AA. All text meets 4.5:1 against its actual background, including placeholders and muted supporting figures. Full keyboard operability with visible focus for the entire entry-and-compare loop. Motion is limited to state feedback and honors `prefers-reduced-motion`. Cost comparisons never encode meaning in color alone — cheaper/pricier is stated in text and position, not hue.
