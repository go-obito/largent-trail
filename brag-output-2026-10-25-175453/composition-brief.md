# Hyperframes Composition Brief: Largent

## Objective
Create a short launch-style brag video for Largent that makes the product feel premium, useful, and concrete without drifting into generic fintech language.

## Output
- Composition directory: `brag-output-2026-10-25-175453/composition/`
- Rendered video: `brag-output-2026-10-25-175453/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `C:\Users\young\largentproject`
- Primary files read: `README.md`, `PRODUCT.md`, `frontend/src/features/welcome/LandingPage.tsx`, `frontend/src/styles/tokens.css`, `frontend/src/app/layout.tsx`
- Product name: Largent
- Tagline / strongest claim: “Make better money decisions before you spend.”
- Key UI or visual moment to recreate: the Largent dashboard hero panel with balance, food budget progress, and spending goal cards
- Copy that must appear verbatim:
  - Make better money decisions before you spend.
  - Track income and spending, plan your weekly food budget by weekday, and keep essential purchases and savings goals in view.

## Creative Direction
- Tone preset: polished
- Creative direction: quiet premium product film
- Interpretation: The video should feel thoughtful, confident, and clear; it should show the product's utility without overdoing the hype or waviness of startup parody.
- Angle: Largent turns everyday money management into a readable plan that helps people decide before they run out of money.
- Hook: “Make better money decisions before you spend.”
- Outro / punchline: “Largent helps people understand their money before it runs out.”
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #F4F6FB
- Text: #20283A
- Accent: #315BEA
- Display font: Inter
- Body font: Inter
- Visual references from the project: dark navy dashboard hero card, blue brand system, food budget progress bar, progress and goal panel, mobile-first finance cards

## Storyboard
Use the storyboard in `brag-plan.md` as the creative contract.

Scene summary:
1. Opening hero headline and dashboard balance card — 4s
2. Food budget planning panel — 4s
3. High-spending and goal cards — 5s
4. Final product payoff lockup — 4s

## Audio
- Audio role: warm corporate bed
- Audio arc: the music opens gently, gives structure to the reveal sequence, and lands on a polished final cadence without becoming loud or chaotic.
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`
- Music treatment: soft intro, consistent pulse, subtle beat hits while cards animate, and a clean fade-out on the final brand lockup.
- Music cue guidance: use the bundled cue preset; strong reveal candidates around 16.02s, 17.02s, and 18.52s are good alignment points for the final payoff or transitions.
- Audio-reactive treatment: subtle; allow gentle opacity or glow shifts to respond to music energy without turning into a waveform or equalizer effect.
- Audio-coupled moments:
  - dashboard card reveal — card motion / type settle
  - food budget fill — progress bar animation
  - goal cards — tile arrival sequence
  - final logo — clean lockup and fade-out
- SFX selection guidance: short, dry UI-style sounds only where they support motion clarity; keep them restrained and product-like.
- SFX analysis guidance: project includes audio assets and a music cue guide under the brag skill assets directory; use restrained, low-risk click-like sounds for card and UI transitions.
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: the chosen music and any Hyperframes-selected SFX are copied into `brag-output-2026-10-25-175453/composition/assets/`.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, and `hyperframes-cli`.

Requirements:
- Show at least one real UI, copy, or visual element from the source product.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music layer.
- Treat the music cue metadata as guidance, not a fixed cue sheet.
- Major reveals may align near strong cues, but readability and story come first.
- Use SFX sparingly to support motion and interaction; no noisy or overdone transitions.
- Honor the warm, polished tone.
- Run `hyperframes check` before render.
