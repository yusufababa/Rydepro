# RYDEPRO

A responsive white-mode mobility experience with black-and-gold accents, the supplied RYDEPRO logo, and a generated U.S. flag hero backdrop. The landing page follows the supplied reference's section order: hero, app downloads, trust strip, introduction, two ride options, journey, services, fleet, platform, Reserve, business, comparison, booking call to action, and footer.

## Run

Requires Node.js. No dependencies or installation needed.

```sh
npm run dev
```

Open http://localhost:5173. Run `npm run check` to check JavaScript syntax.

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
- `src/main.js`: hash navigation, keyboard-accessible fleet tabs, validation, local preview storage, and modal interactions.
- `scripts/server.mjs`: dependency-free local development server.

## Waitlist integration

This is a frontend prototype. Submission stores the latest entry only in the current browser; it does not send emails or register a real subscription. Connect the form to a backend before launch and replace the preview notice. Provide production privacy and consent terms appropriate to your service.

The dialog supports keyboard focus trapping and Escape via the native dialog element. Forms use browser validation and autocomplete. Motion respects reduced-motion preferences.

## Fleet types

Premium offers Sedan, E-Sedan, and Minivan. Executive and Luxury offer Sedan, E-Sedan, and SUV. Commercial Buses retains a Bus option. Compact pill buttons select each type. The showcase advances every five seconds through the types and classes while the vehicle panel is visible, with Previous, Next, and Pause/Play controls. Manual selection restarts the five-second cycle; hovering or focus does not block playback. An inactive browser tab or leaving the landing screen suspends playback. Reduced-motion users start with playback disabled, but can explicitly select Play. Each class remembers its selected type while switching tabs. Unspecified capacities remain “Varies” rather than assuming a vehicle's seating or baggage allowance.

Buttons, inputs, and selects use a shared 36px height and fully rounded corners.

## Download strip and footer

The compact black download band follows the supplied reference. Store badges open the launch waitlist until actual app listing URLs are supplied. The scannable QR points to `https://rydepro.com`, not to a claimed app-store listing. The footer keeps the reference's six columns, link labels, support email, phone number, and copyright line, with the supplied logo above. Pages outside this prototype's scope show an honest launch placeholder rather than broken navigation.

## Hero asset

`assets/hero-flag.png` was generated using the built-in image generation tool. The supplied logo is used unchanged from `logo.png`.

Final generation prompt: “Use case: ads-marketing. Asset type: wide website hero background only, landscape 3:1 composition. Create a premium photorealistic close-up of a waving United States flag filling the entire frame, with large fluid fabric folds, navy canton with white stars at upper left, red and ivory stripes flowing diagonally across the rest. Very dark cinematic lighting, deep navy and burgundy, silver muted highlights on heavy woven fabric. Similar mood to a black-and-gold luxury chauffeur website. Center region especially dark and uncluttered for white headline overlay. Flag recognizable, naturally draped, edge-to-edge. No poles, people, vehicles, logos, lettering, borders or watermark. This is only a background image, not a website screenshot.”
