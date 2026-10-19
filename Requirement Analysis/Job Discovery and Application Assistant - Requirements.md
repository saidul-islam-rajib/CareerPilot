# Job Discovery and Application Assistant

## 1. Purpose

Build a personal assistant that reduces the time and effort needed to find, assess, and manage employment and postgraduate-study opportunities. The user provides their background, qualifications, skills, preferences, and application materials. The system searches permitted sources on a recurring schedule, presents relevant opportunities with evidence and deadlines, and helps the user apply through supported channels.

This document describes product requirements and expected behavior. It intentionally does not prescribe an architecture, programming language, vendor, or implementation framework.

## 2. Product goals

1. Find relevant opportunities across local and international sources without requiring the user to check each source manually.
2. Rank opportunities against the user's qualifications, skills, preferences, and eligibility, with configurable minimum match thresholds.
3. Give the user a daily, explainable shortlist and a searchable history of opportunities.
4. Reduce repetitive application work while keeping the user informed and in control of submissions.
5. Track successful, unsuccessful, incomplete, and manual applications, with clear reasons and next actions.
6. Find master's and PhD opportunities and explain their academic, language-test, funding, and application requirements.
7. Protect the user's personal, academic, and employment information.

## 3. Users and terminology

- **User**: The individual who owns the profile, reviews opportunities, and authorizes actions.
- **Opportunity**: A job, government recruitment notice, master's opening, PhD opening, or other explicitly enabled opportunity type.
- **Source**: A career page, employer or university site, job portal, public-sector notice source, or other permitted publication channel.
- **Match score**: A relevance estimate based on the user's profile and preferences. It is not a promise of eligibility, interview, admission, or employment.
- **Application assistance**: Preparing an email, opening a source application form, filling supported fields, or tracking an application. It does not mean a submission succeeded unless the system has evidence of success.
- **Recommendation track**: One of up to ten user-configurable lists, each with its own scope, ranking preferences, match threshold, and result limit.

## 4. Scope

### 4.1 In scope

- User profile and preference management.
- Recurring discovery of opportunities from configured, accessible, and permitted sources.
- Extraction and display of opportunity details, source links, and dates.
- Matching, filtering, ranking, deduplication, and freshness handling.
- Daily recommendations and a searchable opportunity history.
- Assisted applications, including user-authorized email preparation and supported online-form assistance.
- Application status, action, failure, and audit history.
- Bangladesh government job discovery with grade and eligibility filters.
- Master's and PhD discovery with academic, funding, and test-requirement details.
- Notifications, reminders, user controls, privacy controls, and data export/deletion.

### 4.2 Out of scope unless separately approved

- Guaranteeing that every job or academic opening worldwide will be found.
- Guaranteeing the correctness or completeness of third-party postings.
- Guaranteeing eligibility, visa approval, admission, an interview, or a job offer.
- Circumventing a source's access controls, terms, rate limits, CAPTCHA, MFA, or other anti-automation measures.
- Inventing or modifying user credentials, answers, experience, qualifications, or documents.
- Applying to government jobs automatically by default.
- Making legal, immigration, or admissions decisions on the user's behalf.
- Choosing an architecture, language, hosting provider, or paid data provider at this requirements stage.

## 5. User profile and preferences

### 5.1 Profile information

The user must be able to create, view, edit, and delete profile information, including:

- Name and contact information, including email and phone, with the ability to maintain more than one email address.
- Current country, city, time zone, work authorization, citizenship(s), and countries where the user can legally work.
- Desired work locations, remote-work preferences, relocation willingness, travel willingness, and time-zone overlap preferences.
- Employment preferences: occupation/title, industries, seniority, employment type, work schedule, start date, salary range, and currency.
- Skills, tools, languages, proficiency levels, years or recency of experience, and preferred or excluded keywords.
- Education history: institution, country, degree, field, dates, grades/GPA and grading scale, relevant courses, and completion status.
- Employment history, projects, achievements, certifications, publications, and references where the user chooses to provide them.
- Work authorization and visa-related information relevant to eligibility. Sensitive details must be optional and clearly explained.
- Application answers and preferences, such as availability, salary expectations, willingness to relocate, and reusable answers to common screening questions.
- Résumé/CV versions, cover letters, transcripts, certificates, test-score reports, user-recorded interview videos, and other uploaded documents.
- Academic interests, preferred research areas, degree level, countries, universities, supervisors or labs, start terms, and funding needs.
- English-language and other test status/results, including IELTS, TOEFL, GRE, GMAT, or country/program-specific tests.
- Professional and portfolio links, such as LinkedIn profile URL, GitHub, personal website, Google Scholar/ORCID, and portfolio pages, with control over which links may be shared in applications.
- Identity and civil details commonly required by Bangladesh government and some international forms, such as date of birth, national ID or birth registration number, passport details, parents' names, present and permanent addresses, home district, and quota-relevant status. These fields must be optional, stored as sensitive data, used only for the applications the user authorizes, and never inferred.
- Referees/recommenders, including name, relationship, contact details, and the applications or programs for which each referee has agreed to provide a reference.

The system must distinguish user-provided facts from extracted or inferred information. The user must be able to review and correct extracted information before it is used in matching or applications. Unknown information must remain unknown; it must not be fabricated or silently filled with a default.

### 5.2 Preferences and controls

The user must be able to:

- Set, edit, enable, disable, reorder, and reset recommendation tracks.
- Set a minimum match-score threshold for each track independently.
- Set a maximum number of results per track; the initial requested default is five.
- Choose whether a track includes only new opportunities or also still-open opportunities previously shown.
- Set preferred and excluded locations, industries, employers, institutions, roles, job types, and keywords.
- Set salary, funding, degree, academic, work authorization, and other eligibility filters where applicable.
- Mark an opportunity as interested, saved, dismissed, applied, not eligible, or irrelevant, and optionally provide a reason.
- Correct a match explanation or profile detail that produced a poor result.
- Configure daily delivery time, time zone, notification channel, and frequency.
- Pause discovery and notifications without deleting their profile or history.
- Choose an application mode separately for each recommendation track and supported submission method: manual approval for every application, or pre-authorized automatic application within user-defined rules.
- Configure, review, pause, and revoke automatic-application rules, including their scope, eligibility filters, permitted materials, maximum application volume, any allowed fees, and expiry.

## 6. Recommendation tracks

The system must support ten configurable tracks. The following four are the initial named tracks requested by the user:

1. **Remote jobs**: Remote roles matched to the user's skills and preferences. The system must distinguish fully remote from hybrid, location-restricted remote, and remote-within-time-zone postings.
2. **International jobs with visa sponsorship**: Jobs outside the user's current country, with sponsorship evidence and the destination country shown. A posting that does not state sponsorship must be labeled “not stated” or “unverified,” not assumed to sponsor.
3. **Bangladesh on-site jobs**: On-site opportunities located in Bangladesh, with location and work arrangement shown.
4. **Bangladesh government jobs**: Public-sector notices in Bangladesh, filterable by grade, agency, eligibility, and deadline. Discovery and notification are available by default. Application submission requires a separately enabled mode for this track and must comply with the official portal's rules and verification requirements.

Tracks 5–10 must be user-defined. The product must not silently invent the user's remaining categories. The user may configure them for other employment, education, or opportunity types, subject to product support.

Each track must have independently configurable:

- Opportunity type and scope.
- Included/excluded locations and other filters.
- Match threshold and result count.
- Sort preferences, such as match, closing date, publication date, or user-selected ordering.
- Notification and repeat-display preferences.
- Application mode and automation-rule scope, where the opportunity and source support it.

### 6.1 Match score and explanation

- The system must show a score or clearly named match band and explain the factors that contributed to it.
- Relevant factors may include required and preferred skills, role/field, seniority, education, experience, location, work authorization, salary, language, funding, and user-specific preferences.
- Missing, ambiguous, or unverified requirements must be visible and must not be treated as satisfied.
- A high score must not conceal a hard eligibility failure. Hard requirements and uncertain requirements must be separately displayed.
- The user must be able to set the minimum displayed match threshold per track; the score scale and meaning must be explained.
- The user must be able to give feedback on recommendations. Feedback may influence future ranking, but must not silently change hard filters or profile facts.

## 7. Opportunity discovery and source handling

### 7.1 Sources

The system should support, as permitted and technically available:

- Employer career pages and their recruitment systems.
- University, department, laboratory, and supervisor pages.
- Job portals and professional-network listings, including LinkedIn where access and automation are permitted.
- Bangladesh government recruitment notices and official agency pages.
- Other sources explicitly enabled by the user or product.

Source coverage must be described honestly. The product must identify sources it can search, sources that are temporarily unavailable, and sources that require the user to visit or search manually. It must not claim worldwide completeness.

### 7.2 Search schedule and freshness

- The system must search on a recurring schedule and provide a daily digest, with user-configurable time and time zone.
- It must record when each source was last checked and whether the check succeeded, was partial, or failed.
- It must identify newly found, updated, closing-soon, closed, and previously seen opportunities.
- It must not label an opportunity new solely because its source URL or formatting changed.
- It must retain the original source link and the observed publication, discovery, and last-checked dates when available.
- If a publication or closing date is absent or ambiguous, the system must say so rather than infer a definitive date.
- Stale, withdrawn, expired, duplicate, or inaccessible listings must be marked accordingly and excluded from active recommendations when appropriate.
- The user must be able to report a dead link, inaccurate detail, or duplicate.

### 7.3 Opportunity details and evidence

Each opportunity detail page must show, when available:

- Title, employer or institution, opportunity type, location, work arrangement, department/team, and role or program level.
- Description and responsibilities, requirements, preferred qualifications, and eligibility constraints.
- Salary/range or funding/stipend and benefits, when stated, with currency and period.
- Publication date, application deadline, start date or intake, and source-observed dates.
- Sponsorship, work authorization, relocation, and language requirements, including whether each is explicit, absent, or unclear.
- Source name, direct source URL, and links to the original notice and application.
- The facts used for matching and a readable explanation of the score.
- Extraction confidence or an “unverified” indication for uncertain fields.
- Any conflicts between sources, with source attribution and no unsupported resolution.

The system should preserve a useful excerpt or source evidence for important extracted requirements, subject to source rights and data-retention rules.

### 7.4 Duplicate detection

- The system must detect the same opportunity published across multiple sources, including reposts where reasonably identifiable.
- It should group duplicates under one opportunity and retain all known source links and source-specific dates.
- It must not merge distinct openings merely because their titles or employer names are similar.
- The user must be able to report a false merge or missed duplicate.

### 7.5 Fraudulent and suspicious postings

- The system must check opportunities for common warning signs of fraudulent or misleading postings, such as requests for upfront payment or "processing/visa fees" by a non-official party, guaranteed job or visa offers, unverifiable employers, mismatched or look-alike domains, personal email addresses claiming to represent large organizations, requests for sensitive identity or banking data before an offer, and unrealistic salary for the stated role.
- Suspicious opportunities must be labeled with the specific reasons, not silently hidden. The user must be able to configure whether suspicious opportunities are excluded from recommendations.
- Automatic application, email sending, document upload, and payment must be blocked for an opportunity flagged as suspicious until the user reviews it.
- The user must be able to report a posting as fraudulent or confirm it as legitimate. Such reports must be recorded and may affect how the same source or employer is treated in future.
- A "not flagged" result must not be presented as a guarantee that a posting is legitimate.

### 7.6 Language and document formats of sources

- The system must handle opportunities published in Bangla and English, including mixed-language notices, and should support other languages enabled by the product.
- Where the system shows a translation, it must label it as a translation and keep the original text available. Eligibility, dates, and requirements must be checked against the original wording when translation is uncertain.
- The system should extract details from notices published as PDF files or scanned images (for example, government circulars and newspaper advertisements). Text read from images must carry an extraction-confidence indicator, and critical fields such as deadlines, grade, age limits, and fees must be marked unverified when confidence is low.
- Bangla numerals and Bangla date formats must be interpreted correctly and displayed unambiguously.

## 8. Job-specific requirements

### 8.1 Remote jobs

For remote roles, show whether the role is fully remote, hybrid, or unclear; countries or regions from which the employer accepts applicants; time-zone or working-hour constraints; travel or office attendance; and any location-dependent work authorization requirement. “Remote” must not be interpreted as “work from anywhere.”

### 8.2 International jobs and sponsorship

For each international role, show destination country, relocation requirement, work authorization requirements, and sponsorship evidence, distinguishing:

- Sponsorship explicitly offered.
- Sponsorship explicitly not offered.
- Sponsorship not stated.
- Sponsorship information conflicting or unverified.

The system must allow the user to exclude countries, roles that do not sponsor, or postings with unknown sponsorship status. It must not give immigration advice as a definitive legal conclusion.

### 8.3 Bangladesh on-site jobs

Show city/district and workplace location where stated, on-site/hybrid status, employer, employment type, eligibility requirements, salary when stated, and application deadline. The user must be able to filter by location, commute/relocation preference, sector, role, and other profile preferences.

### 8.4 Bangladesh government jobs

Show, when stated:

- Recruiting authority, ministry/agency, title, post count, grade, pay scale, location, and employment type.
- Citizenship, age, education, experience, quota, and other eligibility conditions.
- Application opening and closing dates, fee, required documents, application method, and official notice/application links.
- Notice publication date, source, corrections/amendments, and whether the notice appears current.

The user must be able to select one or more grades (including grades 9, 10, 11, or all grades), grade ranges, agencies, locations, and eligibility filters. The system must not assume the user's age, quota status, citizenship, or eligibility; it must ask or mark unknown. Conflicting, amended, or unclear notices must be flagged.

Government opportunities should be shown with next steps and reminders. Automatic submission is off by default and must be enabled specifically for this track. Once the user has explicitly enabled a sufficiently scoped automatic-application rule, eligible supported applications may proceed without a separate approval prompt for each application. The system must still comply with the official portal's rules and verification requirements and must pause for any required human verification or user attestation.

#### 8.4.1 Government recruitment stages

Bangladesh government recruitment typically continues after the application is submitted. The system must support tracking, for each government application:

- Application ID, user ID/password reference, or roll number issued by the official portal (stored as sensitive data and never displayed in ordinary logs).
- Application-fee payment status, payment method, transaction ID, and payment deadline, where fees are paid through an official channel such as a mobile-banking or SMS-based payment. The system must not report a fee as paid without evidence such as a confirmation message or receipt.
- Admit-card availability and download date, examination stages (for example preliminary, written, practical, viva/interview), exam dates, venues, and result publication.
- Notices of exam rescheduling, result publication, document verification, police verification, and medical checks.

The system should monitor the relevant official sources for these follow-up notices and notify the user. It must not mark a stage as passed or failed unless an official result or the user's entry supports it.

## 9. Master's and PhD discovery

The system must support discovery and tracking of master's and PhD openings, including taught/research master's, doctoral positions, funded projects, scholarships, assistantships, and other funding routes when published by supported sources.

For each program or opening, show, when available:

- University, department, program/degree, research group/lab, supervisor, country, campus, and official source.
- Research/subject area, project or coursework description, intake/start term, duration, and study mode.
- Application opening/deadline, funding deadline, expected decision date, and any separate supervisor-contact deadline.
- Admission requirements: prior degree and field, minimum grades/GPA and grading scale, prerequisites, research experience, publications, portfolio, proposal, references, statement, and required documents.
- English and other language requirements, accepted tests, minimum overall and section scores, validity period, and whether a waiver is described.
- GRE, GMAT, or other test requirements, including whether required, optional, not required, or not stated.
- Tuition, stipend/salary, scholarship, assistantship, funding amount and duration, fee waivers, living-cost information if stated, and funding conditions.
- International-student eligibility, visa or study-permit information from the source, and any application fee.
- Application process, application portal, contact details, and source links.
- Match explanation showing strengths, missing criteria, uncertain details, and actions the user can take.

Requirements must be labeled by evidence status: explicit, not stated, unclear, or conflicting. The system must not infer that funding is guaranteed merely because a position is advertised as funded. It must not interpret a missing IELTS/GRE requirement as a waiver.

The user must be able to filter by degree, field, country, university, supervisor/research topic, funding status, amount or coverage, start term, deadline, test requirements, and eligibility. The user must be able to save programs, record supervisor contacts, track documents, and manage separate program and scholarship deadlines.

For each academic application, the user must be able to track reference/recommendation letters per referee, including request date, referee agreement, submission method, the program's referee deadline, and whether the institution has confirmed receipt. The system must not mark a reference as submitted without evidence from the institution or the user. Sending reminders to referees is an external action and must follow the same authorization rules as other emails.

Scholarships that are independent of a specific program (for example, government-funded or foundation scholarships) must be trackable as separate opportunities, with links to the programs they relate to.

## 10. Application assistance and automation

### 10.1 User control and authorization

- Application actions must be off by default until the user configures and authorizes them. Preparation, form filling, email sending, and form submission must have separately configurable permissions.
- The user must be able to choose between at least these application modes for each recommendation track and supported submission method:
  - **Approve each application**: The system prepares the application and waits for the user's review and explicit approval before sending an email or submitting a form.
  - **Automatically apply within rules**: After the user explicitly enables a recurring rule, the system may prepare and submit each application that satisfies the rule without asking for separate approval for that individual application.
- Automatic application must not mean permission-free operation. The user must first knowingly enable it and grant any required external account access. After that setup, the user need not approve each in-scope application individually.
- Each automatic-application rule must be inspectable, pausable, revocable, and recorded in the activity history. At minimum, it must define the enabled track and opportunity types, eligible sources and submission methods, match threshold and hard eligibility filters, locations and other relevant limits, approved profile facts and document versions, approved reusable answers, maximum application volume or rate, whether any application fee is allowed (default: none), and an expiry or review date.
- Before automatic mode is enabled, the system must show a clear summary of what it may submit, to whom, using which profile data and documents, under what limits, and which situations will still require user action. The user must be able to test or preview the rule without submitting applications.
- The user must be able to review and edit generated emails, cover letters, answers, profile facts, and documents before approving them for automatic reuse. Changes to approved materials or rules must not be silently applied to future submissions; the user must be notified and, where material, reapprove the rule.
- The system may generate a job-specific cover letter from verified profile facts, the opportunity description, and user-approved writing preferences. In automatic mode, it may attach the generated letter without per-application review only if the user has explicitly approved the generation policy, source facts, document format, and reuse scope in the active rule.
- The user must be able to create reusable answers and answer rules for common mandatory questions. The system may automatically answer a question only when the answer is directly supported by verified profile facts or an answer explicitly approved for reuse, and the question's meaning and answer format are sufficiently clear.
- In automatic mode, notify the user of each application attempt and its outcome, including the opportunity, destination, submission method, materials used, time, and confirmation evidence where available. Notifications do not substitute for per-application approval.
- The system must never fabricate qualifications, test scores, work history, answers, or documents to complete an application.
- Unknown or conflicting facts, ambiguous or novel questions, required legal declarations, signatures/attestations, sensitive questions without an explicit approved answer, payment not expressly allowed by the rule, unsupported workflows, and required CAPTCHA/MFA/human verification must stop automatic submission and request user action.
- Automatic rules must apply only where the source permits the action and the user's connected account grants the necessary access. They must not bypass source terms, rate limits, access controls, CAPTCHA, MFA, or other verification. If a source does not permit or support automation, the system must provide manual-action guidance instead.

### 10.2 Email applications

- Where the employer explicitly requests or accepts email applications, the system may prepare an email using the user's chosen address, subject, body, and relevant attachments.
- Sending must use a user-authorized account and follow its access/authorization requirements.
- In approve-each mode, the system must show the recipient, subject, message, attachments, and opportunity and wait for the user's approval before sending. In automatic mode, it may send without an application-specific approval only when the action falls within an active rule and uses approved materials.
- A successful send must be recorded only after the email service confirms it. A draft is not a submitted application.
- Bounces, send errors, missing recipient details, and attachment failures must be reported with a retry or manual next step.

### 10.3 Online application forms

- The system may fill supported form fields from verified profile facts and user-approved answers.
- In approve-each mode, the user must be able to review filled values and correct them before submission. In automatic mode, the system may submit without application-specific review only when all required fields can be completed from facts and answers explicitly approved for reuse under the active rule.
- The system should identify mandatory questions, explain which are unanswered or uncertain, and map each answer to its source (verified profile fact, user-approved saved answer, or user input). The user must be able to maintain answer rules for common questions such as work authorization, sponsorship needs, availability, salary expectations, relocation, experience, and eligibility.
- For a new or reworded question, the system must check that its intent matches an approved answer before reusing it. It must not treat superficially similar questions as equivalent when their meaning, timeframe, jurisdiction, or requested commitment differs. Questions asking for a legal declaration, personal attestation, or an uncertain yes/no commitment must be presented to the user and must block automatic submission until resolved.
- The system may prepare a tailored cover letter for an application using verified facts and opportunity-specific requirements. It must not add unsupported claims, and must follow the active rule for whether the letter can be attached automatically or needs user review.
- The user may upload one or more recorded interview videos and specify their intended use, language, role/application scope, and whether each video is approved for reuse. The system may attach or upload a selected user-provided video only when the application requests it, the file is within supported technical limits, the active rule permits that use, and the destination supports the upload. It must not create, alter, impersonate, or submit a video interview on the user's behalf.
- Unknown, ambiguous, sensitive, legal, demographic, or declaration/attestation fields must not be guessed. Sensitive or demographic fields may be populated only from explicit, user-approved answers where permitted; required declarations or attestations must still be presented to the user for confirmation. The system must request user input or leave fields unanswered, and must not automatically submit while required fields remain unresolved.
- If a site presents a CAPTCHA, bot challenge, or other human-verification challenge, the system must pause automation and ask the user to complete it through the legitimate site flow. It must not solve, outsource, relay, circumvent, or otherwise automate CAPTCHA validation. After the user completes the challenge, automation may resume only if the source permits it and the session remains valid.
- The system must stop and hand control to the user where a site requires MFA, unsupported file upload, or another control the system cannot safely complete.
- The system must not evade anti-bot controls, access restrictions, source rate limits, or terms that prohibit the action.
- The system must distinguish form opened, form partially filled, ready for review, submitted, and submission confirmed. It must not report success based only on clicking a submit button.
- If a source does not support safe or permitted automation, show the official link and a checklist of information/documents needed for manual completion.

### 10.4 Applications requiring manual action

The dashboard must show why the user must act manually, such as unsupported portal, CAPTCHA/MFA, missing answer, required judgment/attestation, unclear requirement, unavailable source, or source restriction. Provide the source link, deadline, prepared materials where available, and a way to mark the application complete.

### 10.5 Supported application channels and routing

For each opportunity, the system should identify and present the available application routes, such as a platform's built-in application flow, an employer's official career page, a recruiter-requested email, or another application link provided by the employer. The user must be able to configure which of these routes may be used in manual-approval and automatic-application modes.

- **LinkedIn Easy Apply and comparable in-platform applications**: Where an official integration or other source-permitted method supports the flow, the system should populate supported fields, attach the user-approved résumé/document version, and submit under the active application mode. It must show when Easy Apply is unavailable, redirects to an external site, requires user action, or cannot be automated under the platform's terms or technical controls. It must not simulate a user or circumvent LinkedIn restrictions.
- **Employer career pages**: When a job posting links to the employer's official career page or applicant-tracking system, the system should follow that link, verify that the destination appears to correspond to the same employer and role, and use the official application route in preference to an unverified third-party route when appropriate. It should carry forward the job reference and preserve both listing and application URLs. If the link redirects, is broken, or appears unrelated or suspicious, stop and surface the destination for user review.
- **Career-page forms and résumé uploads**: On supported and permitted career pages, the system may create or continue the application, fill supported fields from approved profile data, and upload the user-selected, approved résumé and other required documents. Before automatic submission, it must validate required fields and document constraints that can be checked, confirm that each uploaded file is the intended approved version, and stop on unresolved required information or validation errors. It must not claim a form is error-free or guarantee acceptance by a site's validator.
- **Recruiter email**: When a recruiter or employer explicitly provides an email address or requests email applications, the system may prepare and, in automatic mode, send a tailored application email with the user-approved résumé and attachments, provided the recipient and materials are within the active rule. It must not guess or scrape an unverified recipient, send unsolicited applications contrary to the user's configured scope, or misrepresent the user's interest or qualifications. Missing/ambiguous recipients, conflicting instructions, or unsupported attachments require user review.
- **Other application links**: The system should inspect whether a link is an application destination and show its domain and relationship to the opportunity. It may proceed automatically only if the destination is sufficiently verified, the workflow is supported and permitted, and the active rule covers it. Otherwise, it must provide the link and manual next steps.

A route is not considered successfully applied merely because the system opened a page, filled fields, uploaded a résumé, or clicked a submit control. The system must record the channel and evidence of submission or confirmation, and distinguish an uncertain result from a confirmed submission.

### 10.6 Application validation and error handling

The system must make reasonable validation checks before sending or submitting, including checking required fields, field formats where known, selected document identity, attachment presence, and source-provided file constraints. It should detect and surface field-level validation messages and correct only errors that can be resolved from verified information without guessing.

The system must not promise “without any errors”: external forms and portals can change, reject valid data, or fail after submission. It must report validation failures, upload errors, site changes, timeouts, and uncertain outcomes accurately; preserve safe local progress where possible; and provide a clear retry or manual action. It must not blindly repeat a submission whose outcome is uncertain.

### 10.7 Cover letters, screening answers, and recorded video

- **Cover letters**: The system should produce a role-specific draft based on the user's approved résumé/profile, verified opportunity details, and any user-provided template or style preferences. It must distinguish generated text from user-authored material, avoid unsupported claims, and allow the user to review and edit it. Automatic attachment is permitted only under an active rule that explicitly covers cover-letter generation and reuse.
- **Mandatory questions**: The system should detect required fields and questions, answer those it can reliably map to approved facts or reusable answers, and leave unresolved questions clearly identified. The application must not be submitted automatically if any required field remains unanswered, uncertain, or requires a personal declaration the user has not confirmed. It must not invent an answer merely to complete a form.
- **Recorded interview uploads**: The system may select and upload a video recorded and provided by the user when a supported application explicitly requests a video. The user must be able to approve a specific video for a defined role or reuse scope. The system must validate file type, size, duration, and other stated constraints where possible, preserve the original file, report upload progress/failure, and verify the upload state where the site exposes it. It must never claim that an upload succeeded without evidence.
- **CAPTCHA and human verification**: CAPTCHA is an intentional human-verification boundary, not a form field to solve automatically. Automation must stop and request the user's direct completion. Once completed, the system may resume permitted tasks; if the challenge cannot be completed or the session expires, the application must be marked as requiring user action.

### 10.8 Cross-route duplicates and application volume

- Before preparing or submitting an application, the system must check whether the user has already applied, or has an application in progress, for the same opening through any route (for example LinkedIn Easy Apply and the employer's career page, or email and a portal). A likely duplicate must block automatic submission and be shown to the user.
- The system must support an overall application cap per day and per week across all tracks and rules, in addition to per-rule limits.
- The user must be able to set per-employer and per-institution limits, such as a maximum number of concurrent applications to one organization, and a waiting period before applying again to an employer that rejected the user or to a role the user withdrew from.
- The system should respect reapplication restrictions stated by the employer or institution.

### 10.9 Posting-specific instructions and employer policies

- The system must detect and show application instructions stated in the posting, such as a required email subject line, reference code, file naming, word limits, or a requested format. If such instructions cannot be followed under the active rule, automatic submission must stop.
- Where an employer or institution states a policy on the use of AI-generated application content, the system must show it. Automatic attachment of generated cover letters or answers must be blocked where the policy prohibits it, and the user must decide how to proceed.
- Instructions found in postings may change how an application is formatted, but must never override the user's settings, authorization rules, or product safeguards (see Section 25.2).

### 10.10 Application fees and payments

- Payments must be off by default. Where a rule allows fees, it must define the maximum amount per application and in total, currency, permitted payment destinations, and permitted payment methods.
- The system must show the payee, amount, currency, purpose, and official source of the payment request before any payment. Payment to an unverified or suspicious destination must always require user action.
- Each payment must be recorded with amount, time, method, transaction ID, receipt, and the application it relates to. A payment must not be reported as complete without confirmation from the payment provider or the official portal.
- Failed, uncertain, or duplicate payments must be shown with refund or verification guidance and must never be retried automatically without checking the previous attempt's outcome.

## 11. Dashboard, history, and notifications

### 11.1 Daily dashboard

The dashboard must include:

- Up to the configured number (initially five) of qualifying results for each enabled track.
- A clear empty state when no opportunity meets a track's threshold, rather than padding with poor matches.
- New, updated, closing-soon, expired, and previously seen indicators.
- Match scores, key match reasons, hard eligibility concerns, source links, and deadlines.
- Application actions required, in-progress tasks, and source-search failures requiring attention.
- Separate job and education views or filters, without mixing their criteria.

### 11.2 Application and opportunity history

The user must be able to review opportunities and applications by day, status, type, source, track, employer/university, and deadline. The system must retain:

- Opportunity identity, source links, discovery and update dates, and relevant snapshots of displayed details.
- Application status and timestamps, actions attempted, user approvals, source confirmations, and error details.
- Email/form status, including draft, prepared, submitted, confirmed, failed, or manual action required.
- User decisions, such as saved, dismissed, applied, or not eligible, and optional reasons.

Application statuses must not imply success without evidence. Users must be able to correct a status and add notes.

### 11.3 Notifications and reminders

- Send the daily digest at the user's chosen time and time zone through enabled channels.
- Notify about newly matching opportunities and configurable closing-soon deadlines.
- Provide separate reminders for job deadlines, scholarship deadlines, program deadlines, test dates, references, and other user-recorded milestones.
- Avoid duplicate notifications for unchanged opportunities; explain important changes to a previously seen listing.
- Allow notification preferences to be changed or paused without losing the opportunity history.
- Report delivery failure where available; do not claim a notification was delivered if delivery could not be confirmed.
- Support quiet hours and a limit on non-urgent notifications per day, without suppressing urgent deadline reminders the user has asked for.

### 11.4 Calendar and inbox integration (optional)

- The user should be able to export or synchronize deadlines, interviews, exams, and follow-up tasks to an external calendar, either as a subscribable calendar feed or through a user-authorized calendar account. Uncertain deadlines must be labeled as such in calendar entries.
- Where the user explicitly authorizes read access to an email inbox, the system may detect messages related to tracked applications, such as confirmations, interview invitations, assessments, rejections, and offers, and suggest status updates. Suggested updates must link to the source message and must require user confirmation unless the user has enabled automatic updates for clearly identified confirmation messages.
- Inbox access must be limited to what is needed, revocable, and must not be used to send messages unless sending is separately authorized.

### 11.5 Personal insights

The system should provide the user with summaries of their own activity and match results, such as:

- Applications by track, route, status, and outcome over time, including response and interview rates where known.
- Skills, qualifications, or test scores most often missing from well-matched opportunities, presented as observations and not as guarantees of future success.
- Sources and tracks that produce the most relevant opportunities, and tracks that repeatedly return no qualifying results.

Insights must be based only on the user's own data and recorded outcomes, and must state when the data is too limited to support a conclusion.

## 12. Error handling and exceptional cases

The system must clearly report and preserve actionable status for:

- Source unavailable, rate-limited, access denied, changed layout, partial data, or failed search.
- Missing, malformed, conflicting, translated, or ambiguous opportunity data.
- Expired or changed links, withdrawn roles/programs, and amended notices.
- Duplicate opportunities, reposts, and uncertain employer or institution identity.
- Invalid or incomplete profile data, expired documents, and missing application answers.
- Email authorization expiry, send failure, bounce, or attachment mismatch.
- Form interruption, unsupported fields, CAPTCHA/MFA, user cancellation, submission timeout, and uncertain submission result.
- Conflicting deadlines or requirements across official and secondary sources.

When status is uncertain, say so and give the user a safe next step. Do not silently discard failures, silently assume success, or retry a non-idempotent submission without determining whether the previous attempt succeeded.

## 13. Privacy, security, and trust

- The system must collect only information needed for the enabled features and explain why sensitive information is requested.
- The user must control which profile details and documents are used for matching, applications, or notifications.
- Uploaded documents and personal data must not be exposed to other users.
- The system must provide secure authentication, account recovery, session controls, and protection against unauthorized account access.
- Sensitive data, credentials, tokens, and uploaded documents must be protected in storage and transit; credentials must not be displayed in logs or ordinary activity history.
- Access to a user's connected email account and other external services must be limited to the permissions necessary for enabled actions and revocable by the user.
- The user must be able to review connected accounts, authorized automation rules, and recent external actions.
- The user must be able to export their profile, documents/metadata, opportunity history, and application history, and request account/data deletion.
- The product must communicate retention behavior and deletion limits, including any copies retained by external services.
- Source access and use must respect applicable terms, privacy requirements, copyright, and rate limits.
- Generated match explanations and application content must be distinguishable from facts copied from sources or entered by the user.

## 14. Accessibility and usability

- Core workflows must be usable on desktop and mobile-sized screens.
- The interface must support keyboard navigation, readable contrast, clear labels, and accessible status/error messages.
- Dates and times must be shown unambiguously and in the user's selected time zone, with the source's original time zone retained when known.
- Salary, stipend, grade, GPA, and test scores must show their units/scales and avoid misleading comparisons.
- The user must be able to understand why an opportunity appeared, why it did not appear, and what action is needed next.
- The interface language and the language of generated application materials should be selectable independently, with English and Bangla as candidates for initial support.

## 15. Non-functional requirements

These are product-level expectations; exact service-level targets can be set before implementation.

- **Reliability**: Scheduled searches, notifications, and recorded application actions must have visible outcomes and recoverable failures.
- **Freshness**: Search frequency and last-checked timestamps must be visible; the user must not be led to believe a source was checked more recently than it was.
- **Accuracy and provenance**: Important extracted claims must be traceable to a source and uncertainty must be visible.
- **Performance**: Profile, dashboard, and opportunity-history views should remain responsive for a normal personal account and its accumulated history.
- **Scalability**: The product should be able to add supported sources and opportunity categories without changing the user's core workflow.
- **Portability**: User data should be exportable in a commonly usable format.
- **Maintainability**: Source-specific failures must be diagnosable without hiding their effect from users.
- **Localization readiness**: Dates, currencies, languages, country names, and grading/test scales must be represented so that international opportunities can be compared without losing original values.
- **Backup and recovery**: Profile data, documents, application records, and audit history must be backed up and recoverable after failure. Loss of application evidence (confirmations, receipts, transaction IDs) must be treated as a serious failure.
- **Cost transparency**: Where the product depends on paid data sources, external services, or usage-based processing, the operator must be able to see and limit those costs, and any cost borne by the user must be disclosed before it is incurred.

## 16. Acceptance criteria

The product is ready for an initial release only when all of the following are demonstrable:

1. A user can create and edit a profile, upload application materials, and clearly see which information is verified, inferred, or missing.
2. A user can configure ten tracks, enable the four named initial tracks, define the remaining tracks, and set a separate threshold and result limit for each.
3. The daily dashboard returns no more than the configured number of results per track and does not pad a track with below-threshold opportunities.
4. A recommendation shows its source, last-checked/discovery details, match explanation, uncertain fields, and relevant deadline.
5. Remote work location limits and sponsorship status are differentiated rather than assumed.
6. Bangladesh government jobs can be filtered by grade, including 9, 10, 11, and all grades; eligibility and deadline uncertainty are explicit.
7. Master's and PhD results expose available admission, funding, English-test, GRE/GMAT, deadline, and source details, while distinguishing “not stated” from “not required.”
8. Duplicate and stale listings are identified without hiding their sources or incorrectly merging distinct opportunities.
9. Every application attempt has an honest, auditable status; a draft, partially filled form, or unconfirmed submission is never shown as a confirmed application.
10. A user can choose per track and method between approval for each application and automatic application under explicit, bounded, revocable rules; automatic mode submits qualifying applications without per-application prompts.
11. Automatic applications use only approved facts, answers, and document versions; unknown required answers, user attestations, unsupported controls, CAPTCHA/MFA, disallowed sources, or unauthorized fees stop submission and request user action.
12. Automatic application attempts and confirmed outcomes are reported and recorded; uncertain results are not blindly resubmitted.
13. For supported and permitted workflows, the system can use configured application routes, including LinkedIn Easy Apply, an employer's official career page with approved résumé upload, and recruiter-requested email, while recording which route was used.
14. The system can generate a tailored cover letter from approved facts and attach it only under the user's configured review or automatic-reuse rules.
15. The system identifies mandatory application questions and answers only when supported by verified facts or user-approved reusable answers; unresolved questions block automatic submission.
16. For a supported application requesting a video, the system can upload the specific user-recorded video approved for that use, validate available file constraints, and record the upload outcome; it does not create or alter interview videos.
17. CAPTCHA or other human verification pauses automation for the user's direct completion; the system does not solve or bypass it.
18. Application validation and portal errors are surfaced with actionable next steps; the system does not promise error-free external submissions or mark an unconfirmed attempt successful.
19. Source errors and manual actions appear with an explanation and actionable next step.
20. A user can pause discovery, change preferences, revoke external access, export data, and request deletion.
21. Postings with fraud warning signs are labeled with reasons and cannot trigger automatic application, document upload, or payment until the user reviews them.
22. Bangla and English notices, including PDF or scanned government circulars, are extracted with visible confidence, and low-confidence critical fields are marked unverified.
23. A second application to the same opening through a different route is detected and blocked from automatic submission; overall and per-employer application limits are enforced.
24. Government applications can be tracked through fee payment, admit card, exam stages, and results, with no stage or payment marked complete without evidence.
25. Application fees are paid only within explicit rule limits to verified destinations, and every payment is recorded with confirmation evidence.

## 17. Onboarding and initial setup

### 17.1 First-time setup

The system must provide guided onboarding that allows the user to configure the product without requiring every profile field to be complete before discovery begins. Onboarding must support:

- Creating an account and setting account-security preferences.
- Entering essential profile information and optionally importing a résumé/CV.
- Reviewing and correcting extracted information before it is used.
- Selecting opportunity types, countries, locations, industries, academic fields, and employment preferences.
- Configuring the ten recommendation tracks, including enabling or disabling the four named tracks.
- Setting match thresholds, result limits, notification preferences, and time zone.
- Connecting external accounts only when the user chooses to enable a feature that needs them.
- Reviewing privacy, document-use, and application-authorization settings.
- Showing which features are ready, need more information, or are unavailable due to source or account limitations.

The user must be able to skip optional questions and complete onboarding later. Missing information must reduce match certainty where appropriate; it must not automatically disqualify the user from every opportunity.

### 17.2 Profile completeness and readiness

The system should show separate readiness indicators for employment discovery, government recruitment, academic discovery, email applications, and online-form assistance. Each indicator must explain missing information and why it matters, without implying that an incomplete profile means the user is qualified or ineligible. The user must be able to preview which profile information will be used for each opportunity type before enabling related application features.

## 18. Search transparency and coverage

### 18.1 Search coverage reporting

The system must maintain a source registry describing each configured source, its supported opportunity types, access method, known limitations, last successful check, and current operational status.

For every scheduled search cycle, the system must record:

- Which sources were scheduled for checking and which were successfully checked, partially checked, skipped, or unavailable.
- Which opportunity categories and geographic areas were covered.
- Whether a source requires authentication, manual access, or additional user action.
- Whether the search was interrupted by rate limits, access restrictions, changed layouts, or other errors.
- When the next check is expected, where known.

The dashboard must distinguish “no matching opportunities found” from “search coverage was incomplete.” An empty result set must not be presented as proof that no opportunities exist.

### 18.2 Search configuration and diagnostics

The user should be able to inspect which sources contribute to each recommendation track and why a source is excluded or unavailable. Where supported, the user should be able to enable or disable individual sources, prioritize official sources, and request a manual refresh.

Manual refreshes must respect source restrictions, rate limits, and service capacity. A refresh request must not be represented as successful until its outcome is known.

## 19. Profile, document, and application-material management

### 19.1 Document versions

The system must support multiple versions of résumés/CVs, cover letters, statements of purpose, research proposals, and other application materials. Each document record should include:

- Document type and user-defined name.
- Version, creation date, and last-modified date.
- Related degree, job category, employer, institution, or application.
- Language and intended use, where applicable.
- Whether it is a draft, reviewed, approved for reuse, or archived.
- Expiration or validity information, where relevant.

The document library may also contain user-recorded interview videos. Video records should include language, duration, intended use, associated role/application, technical metadata, and whether the user approved that video for reuse. The original recording must be preserved; generated or altered interview videos are not supported.

The system must not silently replace an approved document with a new version. The user must be able to select the intended version for each application and review which file will be sent.

### 19.2 Document validation

Before preparing or submitting an application, the system should check whether required documents are present, readable, and in a supported format. Where the source specifies file size, file type, page limits, naming conventions, or document-validity requirements, the system must compare the selected materials with those constraints.

The system must identify missing, expired, unreadable, or incompatible documents and provide a corrective action. For video uploads, it should validate stated file type, size, duration, and other technical limits where possible. It must not claim a document or video satisfies a requirement unless sufficient evidence supports that conclusion.

### 19.3 Reuse and data consistency

The user must be able to approve which profile facts and documents may be reused across applications. The system should identify material inconsistencies between the profile and application documents, such as different graduation dates or job titles, and request review.

The system must not automatically modify source documents to conceal inconsistencies or create unsupported claims. Generated or edited material must remain reviewable by the user.

## 20. Application lifecycle and follow-up management

### 20.1 Application records

Each application must be a distinct record linked to an opportunity. Multiple applications to the same employer, institution, or program must remain distinguishable when they concern separate openings or application cycles.

Each record should include the opportunity and source identifiers, application type and destination, selected document versions, submission method and authorization basis, preparation/review/submission/confirmation timestamps, current status and status history, supporting evidence, confirmation number or receipt where provided, contact history, interview/follow-up dates, user notes, and next action with due date and completion state.

Saving an opportunity must not count as applying. Creating an application record must not count as proof of successful submission.

### 20.2 Application statuses

The system must support a consistent status model, including interested, saved, not started, preparing materials, awaiting user information, ready for review, awaiting user authorization, submission in progress, submitted but awaiting confirmation, submission confirmed, submission failed, manual action required, under review, interview, assessment, offer received, rejected, withdrawn, closed, and outcome unknown.

Not every status applies to every source or opportunity type. The system must distinguish system-observed events from statuses entered by the user or reported by an external organization. It must not infer rejection, acceptance, interview selection, or another employer decision solely from silence or elapsed time.

### 20.3 Follow-ups and reminders

The user must be able to record follow-up tasks, interviews, assessments, reference requests, and employer or supervisor communications. The system may recommend a follow-up date, but must label it as a recommendation rather than an official deadline.

The user must be able to complete, reschedule, dismiss, or annotate a task. Completing a task must not change the application status unless the action provides evidence for that change.

### 20.4 Withdrawal and correction

The user must be able to mark an application withdrawn, cancelled, submitted in error, or associated with the wrong opportunity. Where an external withdrawal or correction is supported, the system must show the destination and requested action and obtain the required authorization.

Recording a withdrawal locally must not imply that an employer or institution received or accepted an external withdrawal request.

## 21. Deadline and time-zone management

### 21.1 Deadline representation

The system must distinguish official application deadlines from scholarship/funding deadlines, supervisor-contact deadlines, document/reference/test-score deadlines, recommended internal completion dates, and user-created reminders. Each deadline must retain its source, original time zone when known, observed date, and evidence status.

The system must not convert a date-only deadline into an exact time without evidence. When a source specifies a time zone, the deadline must be displayed in the source time zone and, where useful, the user's selected time zone.

### 21.2 Deadline uncertainty and conflicts

Conflicting deadlines, amendments, unclear time zones, and incomplete closing dates must be flagged with relevant source links. Official corrections or amendments must be retained in the opportunity history. The system must not silently replace a verified deadline with an inferred value from another source.

### 21.3 Deadline prioritization

The dashboard should support sorting by upcoming deadline, estimated preparation effort, and urgency. Where an opportunity has multiple application stages, the earliest relevant deadline and remaining milestones should be shown separately.

The system must distinguish “deadline approaching” from “deadline verified.” An urgent notification must not imply that an uncertain deadline is confirmed.

## 22. Ranking governance and recommendation quality

### 22.1 Ranking configuration

The system must define and document the match-score calculation sufficiently for users to understand what a score means. Where weighting is configurable, the user should be able to adjust the relative importance of skills, experience, education, location, salary, funding, research interests, and other supported preferences.

Hard eligibility requirements must be handled separately from weighted preferences. A high preference score must not override a known mandatory eligibility failure. The system must identify the scoring-model version used for a recommendation so that ranking changes can be investigated.

### 22.2 Ranking stability

The system should avoid large unexplained ranking changes when the user's profile, preferences, opportunity details, and scoring model have not materially changed. Where possible, it should explain a ranking change, such as a profile update, changed opportunity details, newly verified eligibility information, or model update.

Historical recommendations must retain enough information to explain why an opportunity was shown at the time, subject to retention and privacy settings.

### 22.3 Feedback and quality review

The system should monitor recommendation quality using feedback such as relevant, irrelevant, duplicate, not eligible, and already applied. Feedback must be used only within the product's disclosed behavior and must not silently modify user-provided facts or hard eligibility rules.

The user must be able to inspect and correct profile details that caused repeated poor matches and report systematic ranking or extraction problems.

## 23. Automation safety and recovery

### 23.1 Action boundaries

The system must distinguish read-only discovery, local preparation, external account access, and irreversible external actions. Every external action must have an identifiable destination, action type, authorization basis, and recorded outcome.

Automation must be limited to actions and sources permitted by the user's configuration and applicable source restrictions. Authorization for one opportunity, account, or action type must not authorize unrelated actions.

### 23.2 Retry and duplicate-submission prevention

Before retrying an action that may create an external application, send an email, pay a fee, or otherwise produce a non-reversible result, the system must determine whether the previous attempt succeeded where feasible.

If the outcome cannot be determined, the system must mark it uncertain and request verification or user intervention instead of blindly repeating the action. The system should use confirmation identifiers and available external status information to identify likely duplicate submissions.

### 23.3 Automation interruption

The system must support safe interruption when the user cancels, authorization expires, a source changes, information is missing, or a safety constraint is encountered. It must preserve completed work where possible and distinguish saved local progress from changes made on an external service.

If interruption occurs after an external action may have been initiated, the system must report the uncertain outcome and provide a verification step.

### 23.4 Authorization expiry and revocation

When external authorization expires or is revoked, the system must stop dependent actions and notify the user when relevant. It must not request broader permissions than necessary or claim an external feature is operational without the required access.

Revoking access must prevent future use of that authorization. The product must explain whether previously retrieved data remains in local history and how it can be removed.

## 24. Operational monitoring and incident handling

### 24.1 Operational health

The product must monitor scheduled discovery, source access, opportunity processing, notification delivery, connected accounts, and application actions. Monitoring should distinguish source-specific failures from product-wide failures and user-configuration problems.

User-relevant failures must be exposed through the dashboard without revealing sensitive operational details or credentials.

### 24.2 Incident communication

When a failure affects searches, recommendations, notifications, or application actions, the system should identify affected functionality, approximate time period, and available workaround. The product must not claim an operation succeeded merely because a request was accepted or queued.

Where a failure may have caused missed deadlines, duplicate actions, or uncertain submissions, communication and recovery guidance should be prioritized.

### 24.3 Auditability

The system must maintain a reliable history of important events, including profile changes that affect eligibility, source checks, opportunity updates, user approvals, external actions, status corrections, and authorization changes.

Audit records should include event time, action type, outcome, and relevant references without unnecessarily recording sensitive content. The user must be able to inspect relevant activity, while credentials, access tokens, and other secrets remain excluded from ordinary logs and audit displays.

## 25. Testing and release readiness

### 25.1 Functional testing

Before release, the product must be tested against representative scenarios, including:

- Complete and partially completed profiles.
- Opportunities below, at, and above a configured match threshold.
- Known eligibility failures and unknown eligibility requirements.
- Remote jobs with location restrictions and international jobs with conflicting sponsorship information.
- Bangladesh government notices with amended deadlines, grade restrictions, and unclear eligibility.
- Master's and PhD listings with incomplete funding, language-test, and admission information.
- Duplicate listings, reposts, expired opportunities, and changed source URLs.
- Failed searches, unavailable sources, notification errors, and stale source data.
- Missing application documents, unsupported form fields, and expired external authorization.
- Tailored cover-letter generation using supported facts, novel or ambiguous mandatory questions, and user-approved reusable answers.
- User-recorded video upload requests with supported and unsupported file constraints, upload failures, and reuse permissions.
- CAPTCHA or other human-verification challenges requiring user completion, followed by permitted resumption or session-expiry handling.
- Email failures, uncertain submission outcomes, and duplicate-submission prevention.
- User cancellation, permission revocation, export, and deletion requests.
- Fraudulent or suspicious postings, including fee-demanding recruiters and look-alike domains.
- Bangla, mixed-language, PDF, and scanned-image notices, including Bangla numerals and dates.
- The same opening offered through multiple application routes, and per-employer or overall application limits being reached.
- Government follow-up stages such as fee payment, admit card release, exam rescheduling, and results.
- Fee payments that fail, time out, or have an uncertain outcome.

### 25.2 Security and privacy testing

The product must be tested for unauthorized access to profiles and documents, inappropriate reuse of application materials, exposure of secrets in logs, and unintended external actions. Tests must verify authorization boundaries across tracks, opportunities, connected accounts, and application actions.

The product must safely handle malicious or misleading content retrieved from external sources. Instructions contained in job postings, web pages, documents, or emails must not override the user's settings, product safeguards, or authorization requirements.

### 25.3 Acceptance evidence

Acceptance testing must produce evidence that each criterion in Section 16 passed or has an explicitly approved limitation. Source coverage, automation restrictions, unsupported workflows, and known accuracy limitations must be documented before the product is presented as production-ready.

Critical failures involving privacy, unauthorized external actions, fabricated application data, or false submission confirmations must block release until resolved or formally addressed through an approved release decision.

## 26. Product delivery and prioritization

### 26.1 Minimum viable release

The initial release should prioritize:

1. Profile creation, résumé/CV import, review, and preference management.
2. The four named recommendation tracks and configuration of the remaining six.
3. Supported-source discovery, deduplication, evidence-backed opportunity details, and match explanations.
4. Daily recommendations, search history, source-health indicators, and deadline reminders.
5. Master's and PhD discovery with admission, funding, language-test, and deadline information.
6. Application preparation, manual-action guidance, and reliable application-status tracking.
7. Privacy controls, external-authorization management, audit history, and data export/deletion.

External application submission should be enabled only for explicitly supported and tested workflows. Features that depend on unavailable or restricted sources must be presented as limitations rather than implied capabilities.

### 26.2 Future enhancements

Potential future enhancements may include additional source integrations, more advanced ranking customization, application-document tailoring, interview preparation, academic supervisor outreach, application analytics, and broader language support.

These enhancements must not be treated as existing capabilities until implemented, tested, and included in supported-feature documentation.

### 26.3 Scope and change management

New opportunity types, integrations, ranking behaviors, and automation capabilities must be reviewed for their effects on privacy, source permissions, application safety, user experience, and existing acceptance criteria.

Changes to ranking logic, source coverage, or application automation must be documented so users can understand material changes to product behavior.

## 27. Decisions to confirm before implementation

These are product choices not fully determined by the initial request. They should be resolved before implementation or exposed as user settings where appropriate:

1. What does “10 steps” mean exactly: ten recommendation tracks (assumed here), ten workflow stages, or ten ordered preference categories?
2. What are the desired names and scopes of tracks 5–10? Until defined, they remain user-configurable and are not pre-populated.
3. Should “percentile” mean a match-score threshold from 0–100, a percentile ranking among discovered opportunities, or another measure? This document assumes a per-track minimum match-score threshold.
4. Should top-five mean five results per enabled track per day, or five total across all tracks? This document assumes up to five per track, adjustable by the user.
5. Which job categories, industries, countries, languages, and Bangladesh locations should be enabled initially?
6. Which sources should be prioritized, and which user accounts/portals may the system connect to? Availability and automation permission vary by source and country.
7. Which tracks and submission methods should have automatic application enabled, and what match thresholds, source limits, application-volume caps, expiry/review dates, and notifications should each automatic rule use?
8. Should automatic application be available for Bangladesh government roles when an official portal supports it and permits automation, or should that track remain manual-only? The default is manual-only until the user explicitly enables an eligible workflow.
9. What application answers and documents may be reused, and which answers must always require per-application review?
10. Which notification channels and daily delivery time should be supported?
11. Which countries and degree types should be prioritized for master's and PhD search?
12. What match-score definition, weights, and minimum eligibility rules should be used, and how much should users be able to customize them?
13. How long should profile documents, source snapshots, and application history be retained?
14. Which currencies, salary comparison rules, grading scales, and language/localization requirements are needed at launch?
15. What service targets should apply to search frequency, source availability, dashboard responsiveness, and notification delivery?
16. Which résumé/CV file formats and languages must import and extraction support recognize?
17. Should the product support multiple user profiles or separate versions of one person's profile for different career and academic goals?
18. Which application statuses and follow-up workflows are essential for the initial release?
19. Should document versions and approved application answers vary by track, employer, university, or program?
20. Which source-health and search-coverage details should be visible to users?
21. Should historical match scores and source snapshots be retained, and for how long?
22. Which external actions must always require per-action approval (for example, payments or personal attestations), and which can use narrowly scoped recurring authorization?
23. What retry, duplicate-submission, and uncertain-outcome rules should apply to email, online applications, payments, and other external actions?
24. What measurable performance, availability, recovery, and data-loss targets should apply before production release?
25. Which security, privacy, accessibility, and localization standards or regulatory requirements apply to intended launch markets?
26. What feedback measures should evaluate recommendation quality, and how should ranking changes be reviewed?
27. What incident-notification process should apply when source or system failures could affect deadlines or application outcomes?
28. What minimum functional, security, and privacy test evidence is required before enabling external application automation?
29. Should the interface and generated application materials support Bangla at launch, or English only?
30. Should fee payments ever be automated (for example, Bangladesh government application fees), or always handed to the user?
31. Should the product read the user's email inbox to detect application responses, and should it ever update statuses without confirmation?
32. Which calendar integration, if any, is needed at launch: a calendar feed export or direct calendar-account synchronization?
33. What warning signs and thresholds should be used to flag suspicious postings, and should flagged postings be hidden or shown with a warning by default?
34. What overall daily/weekly application caps and per-employer reapplication waiting periods should be the defaults?
35. What budget limits apply to paid data sources and usage-based services, and who bears those costs?

## 28. Document control

| Field | Value |
| --- | --- |
| Document | Job Discovery and Application Assistant – Requirements |
| Version | 0.2 (draft) |
| Owner | To be confirmed |
| Status | Draft – pending review of Section 27 decisions |

### 28.1 Revision history

| Version | Date | Summary of changes |
| --- | --- | --- |
| 0.1 | — | Initial requirements draft. |
| 0.2 | 2026-10-20 | Added portfolio, identity, and referee profile fields; fraudulent-posting detection (7.5); Bangla and PDF/scanned notice handling (7.6); government recruitment stages (8.4.1); referee and standalone scholarship tracking (Section 9); cross-route duplicate and volume limits, posting-specific instructions, and fee payments (10.8–10.10); quiet hours, calendar/inbox integration, and personal insights (11.3–11.5); UI language selection; backup/recovery and cost transparency; acceptance criteria 21–25; additional test scenarios; decisions 29–35. |

### 28.2 Requirement traceability

Before implementation, each requirement should be given a stable identifier (for example, `REQ-10.8-01`) and a priority (must / should / could), so that design items, test cases, and acceptance evidence in Section 25.3 can be traced back to it.
