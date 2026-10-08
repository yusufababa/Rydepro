# Driver application reference inventory

Source audited: `C:/Users/USER/Downloads/new driver application demo 2026.html` (2,458 lines). This is a parity inventory of visible reference content and observed source behavior. It is not an instruction to execute, embed, or trust the reference script. No reference UI, icon system, sidebar, numbered badges, or prototype backend claims need to be copied into the redesigned interface.

## Scope and routing

The source presents **Stage 1 of 10**, with **14 application steps** and a separate received screen. Stages 2–10 are described only; no later-stage flow is implemented. The actual screen array is at source lines 990–1007; routing is at 1151–1181.

| Source ID | Stable implementation concept | Source screen title | Render heading | Applies to |
|---|---|---|---|---|
| 1.1 | account | Create Your Account | Create Your Account | Everyone |
| 1.2 | email | Verify Your Email | Verify Your Email | Everyone |
| 1.3 | jurisdiction | Jurisdiction | Where Will You Operate? | Everyone |
| 1.4 | identity | Personal Identity | Your Legal Name | Everyone |
| 1.5 | license-front | Driver License Front | Driver License Front | Everyone |
| 1.6 | license-back | Driver License Back | Driver License Back | Everyone |
| 1.7 | license-details | License Details | Confirm Your License Details | Everyone |
| 1.8 | portrait | Passport-Style Photo | Take a Passport-Style Photo | Everyone |
| 1.9 | roles | Role Selection | Which Roles Are You Applying For? | Everyone |
| 1.10 | vehicles | Vehicle List | Your Vehicles | `id` or `lb` |
| 1.11 | business | Business Information | Business Information | `lb` |
| 1.12 | fleets | Fleet Association | Fleet Association | `cl` or `w2` |
| 1.13 | review | Review & Submit | Review Your Application | Everyone |
| 1.14 | final | Final Submission Checklist | Final Submission Checklist | Everyone |
| 1.15 | received | Application Received | Thank You — Your Application Has Been Received | Submitted result |

Roles are **multi-select**, source lines 890–896, 1933–1959. Selection order is retained, and the final checklist calls the first-selected role the “Primary role”; there is no separate primary-role field.

| Key | Exact option title | Exact option description |
|---|---|---|
| `id` | Independent Driver | 1099 contractor, owns or leases a personal or non-commercial vehicle. |
| `cl` | Chauffeur — Fleet Lease | Leases a vehicle from a fleet and operates under that fleet. |
| `lb` | Livery Business | Commercial licensed operator, regulated by state or city. |
| `w2` | W2 Chauffeur | Employed by a fleet as a W2 employee with an assigned vehicle. |

After roles: `id`/`lb` go to vehicles; otherwise `cl`/`w2` go to fleets; otherwise demo routes straight to review even with no role. Vehicles then route to business if `lb`, then fleets if `cl`/`w2`, then review. Business then fleets if needed; fleets then review. All four selected roles include all three conditional sections. Role changes hide/show sections; source does not erase previously entered conditional data.

## Welcome, resume and common controls

Source lines 718–846, 1047–1394.

- Welcome headline: “Drive with RYDEPRO. One application. Four ways to earn.” Intro names independent drivers, fleet chauffeurs, livery operators and W2 professionals.
- Welcome benefits: one universal application; driver's license to start; automatically saved progress/resume; source claims enterprise-grade security/document handling. Last claim is prototype copy, not a demonstrated security certification.
- First visit offers **Open Demo Application** and **Start Blank Application**. Demo is prefilled with John A Doe, California, two vehicles, livery business, one fleet; roles are `id` and `lb`; certification is unchecked; submitted is false. Blank clears input values, roles, vehicles, fleets and images. Both paths are explicitly all-screens-unlocked demo modes.
- Existing local draft replaces start choices with **Resume Application**, progress percentage/completed count, last screen, and **Restart Demo**. Restart reloads demo data; there is no dedicated clear-storage/reset-confirmation control in source. “Start Blank” is available only on the initial welcome view.
- `LS_KEY = 'rydepro_stage1_demo_v3'`. Source saves the entire state, including password strings and photo data URLs, to `localStorage`. This is observed prototype behavior, not a recommended credential/document storage design.
- Autosave debounces for 400 ms. Saved indicator appears for 1,600 ms. Every navigation persists state; beforeunload persists. Storage errors are swallowed.
- **Save for Later** saves immediately and shows a time-stamped toast. Toast's **Go to dashboard** simply reloads the page, returning to welcome/resume; no dashboard API exists.
- **Back** uses preceding currently visible screen; hidden at first account screen. **Continue** advances by route; **Submit Application** is its final-checklist label; Continue is hidden on received.
- Source sidebar is grouped Account / Jurisdiction / Identity / License / Roles / Vehicles / Business / Fleet / Review. Groups collapse. Entries are clickable regardless of prerequisites. Sidebar groups can visually place portrait before license even though actual step order is license then portrait.
- **Jump to Screen** and Ctrl/Cmd+J open a searchable overlay filtered by title or numeric source ID. Visible entries show Complete/Current/Pending. Clicking goes to screen; Escape or backdrop closes. Footer advertises arrow/Enter keyboard navigation, but its implementation only supports query typing, click and Escape; no arrow/Enter selection is wired.
- Right-hand contextual help displays “Why we ask this”, Tips, and Need help. Support button is toast-only. Source has mobile sidebar/help toggles; those presentation mechanisms are replaced by the requested horizontal progress and inline help, not needed for field parity.
- Notifications button has no handler. Account avatar only says profile settings are unavailable. The source custom header/footer are not intended to replace the website's shared header/footer in redesign.

## Exact field inventory

“Required” below means the visible source label marks the field required, or source says at least one item. **The demo has no central validation routine and its Continue/Submit does not gate on validity.** Most inputs do not even have native `required` attributes. Input constraints, sanitation and completion heuristics are listed separately so the redesign can implement the intended form rather than copy prototype bypasses.

### Account — source 1466–1567

| State key | Label | Required | Input / constraint / helper |
|---|---|---|---|
| `account.email` | Email Address | Yes | `type=email`, maxlength 254, placeholder `you@example.com`; code sent here |
| `account.password` | Password | Yes | Password, maxlength 64; minimum 8 characters; uppercase, lowercase, number and non-alphanumeric special character |
| `account.confirm` | Confirm Password | Yes | Password, maxlength 64; must match password |

Each password has a Show/Hide control (eye in demo). Live checklist: Email entered; Password meets complexity; Passwords match. Five live password requirement rows mirror complexity tests. Source email completion only tests nonempty text; no email syntax verification is called. State also has `emailVerified`, `attempts` (unused counter), `createdAt` timestamp. Blank creates `createdAt` before a successful account creation; source does not create any remote account.

### Email verification — source 1569–1614

- “Enter the 6-digit code sent to [email]” with **Edit email** navigating to account.
- Six one-character numeric inputs; digits only; automatically focus next after a digit; Backspace in empty input focuses previous. No paste-many-digits implementation. A saved verified state displays `111111` and filled styling.
- Any six digits set `account.emailVerified = true` locally. No code value is persisted. Clearing code or changing email does not revoke verification in source.
- **Resend Code** disables for 30 seconds and displays `Resend in 0:30` countdown. No send request occurs. Code expiration after 10 minutes appears in help but is not implemented.

### Jurisdiction — source 1616–1684

| Key | Label | Required | Behavior |
|---|---|---|---|
| `jurisdiction.country` / `countryName` | Country | Yes | Searchable country code and display label; copy says only United States supported |
| `jurisdiction.state` / `stateName` | State | Yes | Searchable US state code and display label |
| `jurisdiction.city` | City / County | Yes | Searchable list based on selected state |
| `jurisdiction.zip` | ZIP Code | Yes | Numeric input, maxlength 5, strips non-digits; placeholder `5-digit ZIP` |

Country options: `US` United States (`supported:true`), `CA` Canada, `GB` United Kingdom, `AU` Australia, `MX` Mexico (others `supported:false`). Source does not enforce the supported flag and allows selecting all five. Use the supported flag deliberately in implementation rather than claiming other markets are currently supported.

State options: the 50 US states and District of Columbia, source 860–876. Codes in exact source order: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY, DC. `CA` state means California, unlike country `CA` Canada.

Exact city lists, source 878–889:

- CA: Los Angeles; Los Angeles County; San Francisco; San Diego; San Jose; Sacramento; Fresno; Long Beach; Oakland; Beverly Hills.
- NY: New York; Manhattan; Brooklyn; Queens; Bronx; Buffalo; Rochester; Albany; Syracuse.
- TX: Houston; Dallas; Austin; San Antonio; Fort Worth; El Paso; Arlington.
- FL: Miami; Orlando; Tampa; Jacksonville; Fort Lauderdale; Naples.
- IL: Chicago; Aurora; Naperville; Springfield; Peoria.
- WA: Seattle; Spokane; Tacoma; Bellevue; Everett.
- MA: Boston; Cambridge; Worcester; Springfield; Lowell.
- GA: Atlanta; Savannah; Augusta; Athens; Macon.
- NV: Las Vegas; Reno; Henderson; Paradise.
- NJ: Newark; Jersey City; Paterson; Elizabeth; Edison.
- All other states fall back to Springfield; Riverside; Fairview; Georgetown; Salem; Madison; Clinton; Arlington. These are sample lists, not a location-service dataset.

Search matches case-insensitive label substring or abbreviation, first eight results. Focus/input opens; blur closes after 150 ms; no matches state. Arrow Up/Down selects suggestion, Enter accepts, Escape closes. Only accepting a suggestion writes code/name; arbitrary typed text is not committed. Changing state clears city; changing country does not clear state/city. Draft example city is `Los Angeles, CA`, which is not an exact suggestion.

### Personal identity — source 1686–1722

| Key | Label | Required | Input / constraint |
|---|---|---|---|
| `identity.firstName` | First Name | Yes | Text maxlength 50; stored value strips characters other than ASCII letters, apostrophe, hyphen, spaces |
| `identity.middleInitial` | Middle Initial | No | Text maxlength 1; stored value ASCII letter only |
| `identity.lastName` | Last Name | Yes | Same name rule and maxlength 50 |
| `identity.dob` | Date of Birth | Yes | Date; helper says at least 18; demo does not enforce age |
| `identity.sex` | Sex | Yes | Exact radio values Male, Female, Other |
| `identity.phone` | Phone Number | Yes | `+1` prefix; stored 10 digits; strips nondigits; displays `(555) 123-4567`; maxlength displayed input 14 |

Legal name must match government ID. Phone helper says an inspection agent calls during inspection; later review states callback verification. No SMS OTP step exists. Source sanitizes name values only in state, without updating the visible input to match, so invalid text can appear until rerender.

### License front/back — source 1725–1811

Required image keys: `license.frontImage`, `license.backImage`.

- Front headline “Driver License Front”, helper capture front with camera; back equivalent. Both use rear/environment facing camera, document frame, “Align document within the frame”.
- **No gallery upload or file input exists**. Global tips explicitly say “Camera-only capture — no gallery uploads.”
- Browser `getUserMedia({video:{facingMode:'environment'}})`, video preview, **Capture**, **Use demo capture**. Camera unavailable fallback offers demo capture. Capture checks videoWidth and otherwise toasts “Camera not ready. Use demo capture.”
- Capture creates JPEG data URL at original video dimensions, quality .92, and displays preview. **Retake** restarts live camera; **Use Photo** commits to state, stops tracks, toasts success, advances after 400 ms to back/details. Taking a preview alone is not a committed image; outer Continue can still bypass photo acceptance in source.
- Navigation stops all camera tracks. Preview capture itself does not stop tracks until accepted or next navigation.
- Checklist front: Photo captured; Blur check passed; Glare check passed; Edge detection passed. Back uses OCR successful instead of edge detection. Every item is simply `!!savedImage`, not actual image analysis. Source has no OCR engine or API.
- Fake license images are generated by canvas and prominently say DEMO / NOT A REAL DOCUMENT. Do not pass sample documents off as actual verified ID.

### License details — source 1813–1844

| Key | Label | Required | Input / constraint |
|---|---|---|---|
| `license.number` | License Number | Yes | Text maxlength 15 |
| `license.stateOfIssue` / `stateOfIssueName` | State of Issue | Yes | Searchable same US state list |
| `license.issueDate` | Issue Date | Yes | Date |
| `license.expirationDate` | Expiration Date | Yes | Date |

Copy “We read these from your license. Please verify.” No actual OCR populates blank details; demo data is prefilled only. No issue/expiration ordering or expiration validation is implemented. State-only `ocrConfidence` and `manualOverride` are not UI inputs. Bug: shared searchable helper writes license state into `jurisdiction.stateOfIssue`, then exact state-name blur separately copies to `license`; implement intended license destination directly.

### Portrait — source 1846–1924

Required key `passport.image`; state-only `passport.checks` object is unused.

“Take a Passport-Style Photo”; used for driver profile shown to passengers. Requirements: face camera directly, white or navy background, no hats, sunglasses, or filters. Uses front/user facing camera, oval frame, “Center your face in the oval”. Same Capture / Use demo capture / Retake / Use Photo workflow; accept commits photo, stops camera and routes to roles after 400 ms. Camera unavailable fallback available.

Checklist: Face detected; Background color valid; Lighting valid; Facial clarity valid; Eyes open; No hat; No filter. Again each item tests image existence only. No face/background/liveness/filter recognition is implemented. Demo portrait is a synthetic canvas sample labeled DEMO PASSPORT-STYLE PHOTO.

### Role selection — source 1926–1959

`roles:[]`, exact options/descriptions above. “Select all that apply. Your selection determines what we ask next.” At least one selected role is intended required. Checklist At least one role selected / Role(s) confirmed both use roles.length. Toggling updates navigation and autosaves. Source does not clear certification after changing roles.

### Repeated vehicles — source 1961–2102

`vehicles:[]`; at least one when applicable; **unlimited** entries. No vehicle document requested at Stage 1. Empty state “No vehicles yet” / “Add your first vehicle to continue”; **Add Another Vehicle** initializes Own + Regular, rest blank, expanded. Cards show make/model/year, ownership/plate-type badges; expand/collapse via header; **Remove Vehicle** asks confirmation before deleting.

| Per-entry key | Exact label | Required | Constraint/options |
|---|---|---|---|
| `ownership` | Vehicle Ownership | Yes | Own (“I own this vehicle”), Lease (“I lease this vehicle”) |
| `plateType` | Plate Type | Yes | Regular, Commercial; choose currently issued plate type |
| `make` | Make | Yes | maxlength 50, e.g. Toyota |
| `model` | Model | Yes | maxlength 50, e.g. Camry |
| `year` | Year | Yes | 4 digits only, maxlength 4, YYYY |
| `vin` | VIN | Yes | maxlength 17, strips non-VIN chars including I/O/Q; uppercase; helper placeholder 17-character VIN |
| `plateState` / `plateStateName` | License Plate State | Yes | Same US state list; selection stores code/label |
| `plateNumber` | License Plate Number | Yes | maxlength 10, uppercase; e.g. ABC1234; no further character stripping |
| `lessorName` | Lessor Name | If Lease | maxlength 100 |
| `leaseStart` | Lease Start Date | If Lease | Date |
| `leaseEnd` | Lease End Date | If Lease | Date |

State-only `_collapsed` is view state. Source completion requires base vehicle fields only; lease details are visually required but omitted from completion test. No year-range, VIN-length/check-digit or lease-date-order validator is implemented. Plate state suggestions mouse-select only (no arrow key implementation). Typing display name updates `plateStateName` without clearing old code, so source can retain a stale code.

Source bug: ownership radio updates state and selected appearance but does not rerender; Own→Lease does not immediately reveal lease fields until a later rerender. Intended behavior is conditional visibility immediately.

Checklist: Vehicle 1 added; Vehicle 2 added (N/A when absent; second is optional); Unlimited vehicles allowed; Plate Type selected for each vehicle; No vehicle documents uploaded at Stage 1. Remove confirmation exact copy: “Remove Vehicle [n]?” / “This will remove all information for this vehicle.” Cancel and Remove Vehicle.

### Business — source 2104–2138

Only Livery Business role. “Tell us about your livery business. No business license upload is required at this stage.”

| Key | Exact label | Required | Constraint/options |
|---|---|---|---|
| `business.structure` | Company Structure | Yes | Corporation, LLC, Partnership, Sole Proprietorship, Other |
| `business.legalName` | Legal Business Name | Yes | maxlength 150 |
| `business.dba` | DBA / Trade Name | No | maxlength 150 |
| `business.yearEstablished` | Year Established | Yes | digits only, maxlength 4, YYYY |
| `business.ein` | EIN / Business Registration Number | Yes | maxlength 30 |
| `business.contactName` | Primary Contact Name | Yes | maxlength 100 |
| `business.title` | Title / Position | Yes | maxlength 100 |
| `business.authorized` | Are you authorized to complete this application on behalf of the company? | Yes | Yes, No |

Primary Contact divider separates contact fields. No conditional Other company-structure description. Authorized No just rerenders; no blocking explanation or restriction in prototype. The required completion heuristic accepts any nonempty answer, including No. No EIN/year format or range checks beyond input length/digit transform. `issuingCountry`, `issuingCountryName`, `issuingAuthority` exist in state/sample defaults but have **no rendered input, no completion check, and no review/final display**; do not invent additional required fields from them.

### Repeated fleet association — source 2140–2192

`fleets:[]`; at least one when `cl` or `w2`; unlimited entries; empty “No fleet associations yet”. **Add Another Association** adds blank entry; **Remove** immediately deletes, no confirmation in source.

| Per-entry key | Exact label | Required | Constraint/options |
|---|---|---|---|
| `name` | Fleet Name | Yes | maxlength 150 |
| `code` | Fleet Code / Invite ID | Yes | maxlength 30 |
| `relationship` | Relationship Type | Yes | Lease vehicle from fleet; W2 employee of fleet; Other |
| `other` | Relationship Description | If Other | maxlength 100 |

Relationship radio rerenders immediately, revealing Other description. Completion heuristic tests name/code/relationship but omits Other text. No server verification of code or employer association. Checklist: association added; name entered; code/invite ID entered; relationship selected.

## Review, certification and final result

### Review & Submit — source 2194–2301

Editable summary groups, each with **Edit** navigating to relevant screen. Empty fields show Not provided. No password displayed.

- Account: Email, Email verified; Edit account.
- Jurisdiction: Country, State, City / County, ZIP; Edit jurisdiction.
- Personal Identity: full legal name, DOB, Sex, formatted Phone; Edit identity.
- Driver License: front/back capture state, number, issuing state, issue/expiration dates; Edit license-details (capture states do not have separate edit actions in this summary).
- Passport-Style Photo capture state; Edit portrait.
- Roles Selected titles; Edit roles.
- Conditional Vehicles: count, ownership/type badges, make/model/year together, VIN, plate state/name+number; does not list lease detail fields here; Edit vehicles.
- Conditional Business: structure, legal name, DBA, established year, EIN/registration, contact, title, authorized; Edit business.
- Conditional Fleets: count, fleet name/code/relationship; appends Other text if present; Edit fleets.
- Required certification `certification.accepted`: **“By continuing, I certify the information is accurate, that I am authorized to submit this application, and that RYDEPRO may request additional information before activation.”** Checkbox autosaves. Prototype Continue ignores unchecked state.

### Final Submission Checklist — source 2303–2420

“Review every item below before submitting. This is exactly what will be sent to RYDEPRO.” Every summary still has Edit. Adds to review:

- Account created date (`createdAt` rendered with local date).
- Phone verification method **Agent callback during inspection**.
- Primary role = first selected role.
- Full separate vehicle fields: ownership, plate type, make, model, year, VIN, plate state, plate number; lease lessor/start/end if Lease.
- Full fleet name, code and relationship, but source final fleet summary **omits Other description** (unlike review).
- Documents Uploaded: front license, back license, portrait capture state; Edit goes to license-front. Despite the heading, these are camera captures, not gallery uploads.
- Declarations: Certification accepted; No vehicle documents at Stage 1; No proof of address at Stage 1; No SSN/TIN at Stage 1. Last three are hard-coded Confirmed; no separate checkbox exists.
- Source unconditionally displays **Everything looks good** despite missing/invalid data. Submit sets `submitted=true` locally and navigates received; no network request or application ID.

### Received — source 2422–2451

Headline “Thank You — Your Application Has Been Received”; paragraph “Your RYDEPRO application has been successfully submitted”; Application Received badge. Five next steps:

1. **Application Review** — RYDEPRO will review provided information.
2. **Requirements Determination** — applicable documentation by operating locations.
3. **Documentation Request** — requested through account if additional documentation needed.
4. **Vehicle & Chauffeur Review** — applicable vehicles/chauffeurs proceed through verification/inspection.
5. **Activation** — after applicable requirements satisfied.

Callout: “No action required unless RYDEPRO requests additional information.” Actions **View Status**, **Contact Support**, **Download Summary** are all toast-only. Source Download Summary does not create or download a file; status is hard-coded under review; support does not send a message. Most reviews 24–72 hours is help copy only. Help says submitted Stage 1 data is locked, but source keeps Back/Edit/jump and does not enforce a lock.

## Completion and progress semantics in source

Source `COMPLETE` at 1013–1029; progress at 1035–1039. Hidden conditional steps are considered complete when queried, but denominator counts only visible steps. Received excluded from denominator. Final counts complete only after submitted; certification is review completion. Source indicators are advisory:

- Account requires email + password + createdAt, ignoring confirm/complexity.
- Email verified boolean.
- Jurisdiction any nonempty country/state/city/ZIP, ignoring support/ZIP length.
- Identity first/last/DOB/sex/phone, ignoring age/phone length.
- License front/back and portrait only image presence.
- License details any number/state/dates, ignoring validity/order.
- Roles length > 0.
- Vehicles at least one and all base fields, excluding conditional lease details.
- Business base nonempty required fields; No authorization still truthy.
- Fleets at least one and name/code/relationship, excluding Other description.
- Review certification boolean; final/received submitted boolean.

Resume completed count bug: its numerator includes received screen if submitted while denominator excludes received, unlike standard progress count. Missing images on resume are replaced by demo images: init merges saved state with demo state and explicitly fills null front/back/portrait. A blank unfinished draft can therefore acquire fake captured photos on reload. Do not reproduce these errors.

## Backend and verification boundaries

The source has **no remote authentication, email/OTP service, submission API, document upload API, OCR, document-quality checking, face detection, license lookup, fleet verification, support integration, status API, PDF generation or subsequent-stage implementation**. All buttons promising these actions are local state changes, browser capture, sample generation or toasts. Rebuilt flow should represent pending verification/delivery truthfully and keep the integration boundary explicit.

Implementation parity decisions should keep exact field/option coverage, conditional roles and review data, while fixing prototype errors rather than blindly copying them. In particular: avoid storing account passwords in a local draft, avoid restoring fake documents into a real draft, escape user values rendered in summaries, retain camera cleanup, update conditional lease fields immediately, invalidate verification when email changes, include Other relationship description in the final summary, and do not show remote success/support/download claims when no such action happened.
