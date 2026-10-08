# RYDEPRO

A responsive white-mode mobility experience with black-and-gold accents, locally hosted Satoshi, and the supplied RYDEPRO logo. The split typographic hero follows the latest reference and leads directly into one compact black download strip. The demo's remaining sections retain the current layouts: pricing, platform introduction, journey, services, fleet, trip management, membership, business, comparison, trusted-by, on-demand auction, expansion, FAQ, and closing call to action. The approved six-column footer and waitlist flow remain.

## Run

Requires Node.js. No dependencies or installation needed.

```sh
npm run dev
```

Open http://localhost:5173. The separate driver application is at **http://localhost:5173/driver-application**. Run `npm run check` to check JavaScript syntax, `npm test` for application tests, and `npm run build` for the deployable static output.

## GitHub and Vercel

From the project folder in PowerShell:

```powershell
git init
git add .
git commit -m "Build RYDEPRO landing page and waitlist"
git branch -M main
git remote add origin https://github.com/yusufababa/Rydepro.git
git push -u origin main
```

If Git requests your identity, set `git config user.name "Your Name"` and `git config user.email "your GitHub email"` before committing. Sign into GitHub if prompted. If the remote already contains commits, do not force push; reconcile the existing history first.

In Vercel, choose Add New → Project, connect GitHub, import `yusufababa/Rydepro`, and deploy. Use framework Other, root directory `./`, build command `npm run build`, and output directory `dist`. These build settings are included in `vercel.json`. No environment variables are required for this frontend. The custom Node server is for local development; Vercel serves the static `dist` output. Later pushes to `main` trigger new production deployments.

For subsequent changes:

```powershell
git add .
git commit -m "Update RYDEPRO design"
git push
```

## Structure

- `index.html`: semantic landing page, waitlist screen, native confirmation dialog.
- `src/styles.css`: brand tokens, responsive layouts, surfaces, and motion.
- `src/fleet.css`: fleet overview, capacity details, and responsive free waiting time panel.
- `src/redesign.css`: Satoshi font faces and layouts for the latest demo's sections.
- `src/polish.css`: shared light palette, consistent strokes, compact controls, reference hero, and gold hover feedback.
- `src/typography.css`: responsive Satoshi text scale, with a 16px desktop base and 12px mobile base.
- `src/fleet.js`: ten-vehicle automatic showcase, decoded image transitions, keyboard class selection, and visibility handling.
- `src/main.js`: hash navigation, validation, local preview storage, and modal interactions.
- `scripts/server.mjs`: dependency-free local development server.
- `driver.html`: separate driver application entry point.
- `src/driver/`: source field definitions, validation, navigation, views, camera capture, summary export, and application styles.
- `scripts/site-shell.mjs`: shares the landing page header and footer with the driver page during development and production builds.
- `tests/`: conditional-flow, field parity, draft safety, camera lifecycle, and route checks.

## Driver application

Open `/driver-application`, or use **Become an Operator** in the landing page footer. Vercel rewrites the same URL to the generated `driver.html`; no separate service or additional deployment is needed.

The supplied driver demo's questions and role branches are retained. The application has five progress milestones with check marks for completed pages and an expandable page list. Applicants complete account setup, email preview verification, operating location, identity, license front/back, license details, profile photo, and role selection. Their selected roles determine whether vehicles, business information, and fleet associations are required. Multiple vehicles and fleet associations are supported, including lease details and an Other relationship description. Review shows every applicable field and photo, with direct editing and certification before final completion.

Controls share the waitlist's 36px rounded inputs and black/gold buttons. Pages use Satoshi, a 16px desktop reading base, and a 12px mobile base. The application uses the landing page's shared sticky header and exact footer rather than the reference demo's navigation sidebar.

This is a functional frontend preview, matching the demo's simulated verification and submission. No account is created on a server, no verification email is sent, and no application is transmitted. Any six digits complete the clearly labelled email preview; resend becomes available after 30 seconds. Camera captures require HTTPS or localhost and camera permission. Marked demo images let applicants explore without providing real documents. Captures are resized and encoded as JPEG in memory; clarity and identity verification are not simulated as approved results.

Draft details autosave to session storage in the current browser tab. Passwords, confirmation passwords, and photos are excluded from stored drafts. They remain available while this page is open and must be re-entered or recaptured after reloading. Reloading resumes at the earliest incomplete prerequisite while retaining other entered details. Editing collected information clears certification and completion so the final review stays accurate.

Completion provides a real JSON summary download and a printable review. The JSON includes applicable collected fields and photo metadata, and excludes passwords and photo contents. Live launch requires connecting account creation, email verification, capture uploads, application submission, and status to an application service. The field map and source interaction audit are in `docs/driver-reference.md`.

For an optional full browser check, run `node scripts/verify-driver.mjs`. It uses an installed Edge or Chromium browser (or `BROWSER_PATH`), opens an isolated headless session, completes the combined-role flow, checks review edits and draft reload, verifies desktop/mobile sizing, and tests summary download. Screenshots and the sample summary are written to the ignored `.driver-qa/` directory; its temporary browser profile is removed afterward.

## Waitlist integration

This is a frontend prototype. Submission stores the latest entry only in the current browser; it does not send emails or register a real subscription. Connect the form to a backend before launch and replace the preview notice. Provide production privacy and consent terms appropriate to your service.

The dialog supports keyboard focus trapping and Escape via the native dialog element. Forms use browser validation and autocomplete. Motion respects reduced-motion preferences.

## Fleet showcase

Each class displays its available vehicle options as informational tiles. Premium includes Sedan, E-Sedan, and Minivan. Executive and Luxury each include Sedan, E-Sedan, and SUV. Commercial Buses has one Bus option. The active tile is highlighted in gold. Images, titles, and passenger capacities rotate together every five seconds, showing every option before advancing to the next class. There is no dropdown, playback toolbar, counter, or bottom policy strip. Clicking a class restarts at its first vehicle; keyboard focus suspends cycling while the user operates the tabs. Leaving the page or switching browser tabs stops the timer. Reduced-motion users use static, manually selectable class tabs, with all options and capacities still visible. The next image is decoded before swapping, and outgoing images crossfade smoothly.

The seven 960 × 600 WebP images in `assets/fleet/` are approximately 25–40 KB each. Images load lazily; the showcase fetches subsequent images as needed. Generated illustrations depict representative vehicles, not a guaranteed model or fleet inventory. Generation prompts and built-in image generation tool provenance are recorded in `assets/fleet/generation.json` and `assets/fleet/generation-options.json`. Passenger capacities follow the supplied demo; unspecified luggage capacities remain “Varies”. Free waiting time stays visible for every option: point-to-point 10 minutes, airport and cruise transfers 60 minutes, hourly bookings 5 minutes.

Buttons, inputs, and selects use a shared 36px height and fully rounded corners.

Typography uses a 16px reading base above 700px and a 12px base on mobile. Desktop section headings range from 36–46px; card headings use 22–26px and control labels use 14px. Mobile headings and labels scale down separately, preserving the compact controls. Supporting captions have their own smaller scale. Tablet navigation, downloads, and footer columns reflow to accommodate the larger text.

## Download strip and footer

The compact black download band sits immediately after the hero and follows the supplied reference. Store badges open the launch waitlist until actual app listing URLs are supplied. The scannable QR points to `https://rydepro.com`, not to a claimed app-store listing. The footer keeps the reference's six columns, link labels, support email, phone number, and copyright line, with the supplied logo above. Pages outside this prototype's scope show an honest launch placeholder rather than broken navigation.

## Hero asset

`assets/hero-flag.png` was generated using the built-in image generation tool for an earlier design and is retained as an unused source asset. The latest hero uses the attached typographic design without a background image. The supplied logo is used unchanged from `logo.png`.

Final generation prompt: “Use case: ads-marketing. Asset type: wide website hero background only, landscape 3:1 composition. Create a premium photorealistic close-up of a waving United States flag filling the entire frame, with large fluid fabric folds, navy canton with white stars at upper left, red and ivory stripes flowing diagonally across the rest. Very dark cinematic lighting, deep navy and burgundy, silver muted highlights on heavy woven fabric. Similar mood to a black-and-gold luxury chauffeur website. Center region especially dark and uncluttered for white headline overlay. Flag recognizable, naturally draped, edge-to-edge. No poles, people, vehicles, logos, lettering, borders or watermark. This is only a background image, not a website screenshot.”
