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
8. Automate the full journey, from discovery through application, confirmation, and follow-up, wherever sources permit and the user has authorized it, leaving the user only the steps that legally or technically require them.
9. Show the user an accurate, well-designed record of every application, including the exact questions answered, emails sent, documents attached, and evidence of submission.

## 3. Users and terminology

- **User**: The individual who owns the profile, reviews opportunities, and authorizes actions.
- **Opportunity**: A job, internship, government recruitment notice, master's opening, PhD opening, scholarship, fellowship, assistantship, or other explicitly enabled opportunity type (see Sections 33.1 and 34.6).
- **Source**: A career page, employer or university site, job portal, public-sector notice source, or other permitted publication channel.
- **Match score**: A relevance estimate based on the user's profile and preferences. It is not a promise of eligibility, interview, admission, or employment.
- **Application assistance**: Preparing an email, opening a source application form, filling supported fields, or tracking an application. It does not mean a submission succeeded unless the system has evidence of success.
- **Recommendation track**: One of up to ten user-configurable lists, each with its own scope, ranking preferences, match threshold, and result limit.
- **Administrator (admin)**: A platform operator who uses the separate admin application to view and manage all users, data, sources, and settings (Section 53). Unless a section says otherwise, "user" in this document means the job seeker or student, not an admin.
- **User application** and **admin application**: The two separate applications that make up the product (Section 53.1).

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
- End-to-end automated application in both approve-each and automatic modes (Sections 27 and 37).
- Applied-applications report with full question, answer, email, document, and evidence records (Section 28).
- The full student journey (Section 33) and the job seeker journey after applying (Section 34).
- Bangladesh-specific profile data, government application stages, and portals (Sections 8.4.1 and 35).
- A separate admin application with a full platform dashboard and management of all data (Section 53).

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
- Set a maximum number of results per track; the initial requested default is five. Changing one track's count (for example, ten for remote jobs) must not change any other track's count (Section 48).
- Choose whether a track includes only new opportunities or also still-open opportunities previously shown.
- Set preferred and excluded locations, industries, employers, institutions, roles, job types, and keywords.
- Set countries the user will not apply to, as defined in Section 5.3.
- Set salary, funding, degree, academic, work authorization, and other eligibility filters where applicable.
- Mark an opportunity as interested, saved, dismissed, applied, not eligible, or irrelevant, and optionally provide a reason.
- Correct a match explanation or profile detail that produced a poor result.
- Configure daily delivery time, time zone, notification channel, and frequency.
- Pause discovery and notifications without deleting their profile or history (pause options are defined in Section 47).
- Choose an application mode separately for each recommendation track and supported submission method: manual approval for every application, or pre-authorized automatic application within user-defined rules.
- Configure, review, pause, and revoke automatic-application rules, including their scope, eligibility filters, permitted materials, maximum application volume, any allowed fees, and expiry.

### 5.3 Excluded countries

Users may not want to, or may not be able to, apply for opportunities connected to certain countries.

- The user must be able to keep a list of excluded countries, globally and per track, and add, change, or remove countries at any time.
- For each excluded country, the user must be able to choose what it applies to:
  - the country where the job or study program is located (always included);
  - the country where the employer or institution is based or registered;
  - remote roles that require working from, or being employed through, that country;
  - travel or relocation to that country required by the role.
- Opportunities matching an excluded country must never be applied to, in either application mode, and must not be recommended unless the user chooses to see them marked as "excluded country".
- When the country is unclear (for example, an employer's base country is not stated, or a remote role does not say where the contract is), the opportunity must be treated as uncertain: it may be recommended with a warning but must not be applied to automatically.
- Multi-country postings (for example, "Dubai or London") must be checked for each listed country. If any listed country is excluded, the user's chosen setting decides whether the posting is excluded or only the excluded locations are removed from the application.
- An excluded country is a block and always wins over track settings, rules, and approvals (Section 38). If the user approves an application that a newly added country exclusion now blocks, the approval must be cancelled and the user notified.
- Country names must be matched reliably, including alternative names, cities, and regions within a country.
- Administrators may also set countries where applications are not allowed on the platform, for legal reasons (Section 53); these apply to all users and are shown to them.

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

The result count limits only how many opportunities are shown in the daily dashboard and digest for that track. It does not limit which opportunities an automatic-application rule may apply to; that is governed by the rule's own threshold, filters, and volume caps (Section 10.1) and the global caps (Section 10.8). Every application made by a rule must appear in the applications list (Section 28.1) even if the opportunity was not among the displayed results.

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

The system must keep a full archived copy of the original circular for every opportunity that was recommended to the user or applied to, as defined in Section 50.

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
  - **Approve each application**: The system prepares the application and waits for the user's review and explicit approval before sending an email or submitting a form. Once the user approves (with or without changes), the system completes all remaining steps automatically, as specified in Section 37.
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
- The system must distinguish form opened, form partially filled, ready for review, submitted, and submission confirmed, using the status model in Section 20.2. It must not report success based only on clicking a submit button.
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

- Opportunity identity, source links, discovery and update dates, and the archived original circular with all its versions (Section 50).
- Application status and timestamps, actions attempted, user approvals, source confirmations, and error details.
- Email/form status, including draft, prepared, submitted, confirmed, failed, or manual action required, as defined in the status model in Section 20.2.
- User decisions, such as saved, dismissed, applied, or not eligible, and optional reasons.

Application statuses must not imply success without evidence. Users must be able to correct a status and add notes.

### 11.3 Notifications and reminders

- Send the daily digest at the user's chosen time and time zone through enabled channels.
- Notify about newly matching opportunities and configurable closing-soon deadlines.
- Provide separate reminders for job deadlines, scholarship deadlines, program deadlines, test dates, references, and other user-recorded milestones.
- Avoid duplicate notifications for unchanged opportunities; explain important changes to a previously seen listing.
- Allow notification preferences to be changed or paused without losing the opportunity history.
- Report delivery failure where available; do not claim a notification was delivered if delivery could not be confirmed.
- Support quiet hours and a limit on non-urgent notifications per day. Notifications classed as urgent (Section 36) may be sent during quiet hours only if the user has allowed urgent notifications to override quiet hours; otherwise they must be sent when quiet hours end, and the deadline buffer (Section 27.2) must account for this delay.

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
- Uploaded documents and personal data must not be exposed to other users. Administrators may access them through the admin application under the safeguards in Section 53.5.
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
26. With automatic mode enabled, a qualifying opportunity moves from discovery to confirmed submission without user involvement, and every opportunity that stops before submission shows the step and reason.
27. The emergency stop halts all automatic external actions immediately, and a rule dry run shows what would be submitted without submitting anything.
28. Every automatic submission passes the pre-submission checks in Section 27.4; a cover letter or email naming a different employer or program is never sent.
29. The posting is re-checked immediately before submission, and material changes trigger re-matching or re-approval.
30. The applications list and detail views show every question exactly as asked, the exact answer and its source, full email content and thread, the exact files sent, and submission evidence.
31. Submission records cannot be altered; corrections appear as separate timestamped entries.
32. New questions that blocked automatic applications appear in the question bank, and approving an answer there unblocks later applications.
33. Daily and weekly application reports are delivered and exportable as PDF and spreadsheet.
34. Portal accounts are created only when authorized, with unique passwords in an encrypted store, and are listed for the user.
35. Portal-parsed résumé values are checked and corrected; choice questions without an exact matching option are sent to the user.
36. Tailored résumés contain only verified facts and the exact version sent is recorded.
37. Photos and signatures are resized to portal specifications without altering appearance, and originals are kept.
38. Student plans include reverse-planned milestones, test-score expiry warnings, official score-sending tracking, and an application budget.
39. Supervisor outreach respects per-day and per-department limits and stops for professors who decline.
40. Assessments, interviews, and offers are tracked with reminders; the system never takes an assessment for the user.
41. Bangladesh government age eligibility is calculated as of each circular's stated date, and applicant copies and portal-issued credentials are stored securely.
42. In approve-each mode, after the user approves (with or without edits), the system completes account sign-in, filling, uploads, approved fees, checks, submission, confirmation, and recording without asking again, except for the cases in Section 37.4.
43. Edits made during approval apply to that application only unless the user saves them as a reusable answer or profile update, and saved answers never change already approved or submitted applications.
44. A new question appearing after approval pauses only for that question, keeps all other approved values, and can be answered from a WhatsApp or push notification.
45. Approvals expire as configured, can be cancelled before submission starts, and approvals never count as legal attestations.
46. An opportunity matching several tracks or rules is applied to at most once, using the most restrictive settings (Section 38).
47. All screens, reports, and notifications use the single status model in Section 20.2.
48. Age, years of experience, availability, and document expiry are computed as of the relevant date and shown in the approval package and submission record.
49. Excluded employers (such as the current employer) are never applied to or contacted.
50. The data shared with each organization is recorded in the submission record.
51. Automatic applications pause after the configured inactivity period and when key profile facts are overdue for confirmation.
52. Agency postings, rolling deadlines, multi-position postings, reposts, and bilingual duplicates are handled as specified in Section 42.
53. WhatsApp and push notifications are delivered, with fallback to email when delivery fails.
54. The user can add, update, undo, and delete every type of their data, with change history and warnings when an item is used by a rule, approval, or in-progress application.
55. The user can delete their account; all automation stops immediately, connected access and stored credentials are revoked, data is deleted after any grace period, and a confirmation is sent.
56. The user can pause for days, weeks, months, years, until a date, a future date range, or indefinitely, for everything or for selected tracks, rules, routes, or notifications; nothing is submitted during a pause.
57. Changing one track's result count (for example, remote jobs to ten) leaves all other tracks unchanged.
58. Applications are submitted only within the user's chosen time windows (for example, 12:00 a.m.), with the deadline rule applied when a window falls too late.
59. Every recommended, saved, or applied opportunity has an archived copy of the original circular, including original files and versions, which remains viewable after the source removes it.
60. Compensation rules work as hard filters or preferences, handle "not stated" as configured, and salary answers never go below the user's minimum.
61. Every recommendation and every system action has exactly one record; reconciliation finds no missing or duplicate records, and report counts match the records.
62. The admin application is separate from the user application, with its own access point and sign-in; user accounts cannot reach it.
63. A Super Admin can read, create, update, and delete all user, opportunity, source, application, settings, template, and audit data, and see every dashboard figure in Section 53.3 with drill-down.
64. Secrets are never shown in readable form to admins; admins cannot submit, send, or pay on a user's behalf without the user's authorization; every admin access and change is audited and visible to the affected user.
65. The platform emergency stop halts automatic actions for all users, a group, a source, or a route, and affected users are notified.
66. Opportunities connected to a user- or platform-excluded country are never applied to; unclear countries block automatic application; adding an exclusion cancels affected approvals.
67. The web app and the Android and iOS apps are released together with all user features, share the same data, and stay in sync; offline actions in the mobile app are shown as pending until saved.

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
- Choosing an application mode for each track (approve each application, or automatic within rules) and seeing what each mode means, including the steps that always stay with the user (Section 27.3).
- Connecting and verifying notification channels (WhatsApp, push, and email) and choosing which events are urgent.
- Answering the most common screening questions once (work authorization, sponsorship, notice period, salary expectations, relocation, demographic preferences) so they can be approved for reuse.
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

This section is the single status model for the whole product. All other sections, screens, reports, and notifications must use these statuses and labels.

**Opportunity decisions** (set by the user on an opportunity, not an application): interested, saved, dismissed, not eligible, irrelevant. Saving or marking interest is not an application.

**Submission status** (what the system or user did to submit):

| Status | Meaning |
| --- | --- |
| Not started | Application record exists; no preparation yet. |
| Preparing | Materials and answers being prepared; includes form opened and form partially filled. |
| Awaiting user information | Blocked on a missing answer, document, or fact. |
| Awaiting approval | Ready for review in approve-each mode, or a rule requires review for this item. |
| Approved – queued | User approved (Section 37) or a rule authorized it; waiting to be submitted. |
| Submitting | Submission in progress. |
| Submitted – awaiting confirmation | Submit action completed but no confirmation evidence yet. |
| Confirmed | Confirmation evidence received: a confirmation page or number, confirmation email, or for email applications, the email service's confirmation that the message was sent with no bounce received. |
| Failed | Submission did not go through; a reason and next step are recorded. |
| Manual action required | A step must be completed by the user (Section 27.3). |
| Outcome unknown | The system cannot tell whether the submission succeeded (Section 23.2). |
| Cancelled | Stopped by the user or emergency stop before submission. |

**Outcome status** (the employer's or institution's process, observed from evidence or entered by the user): no response yet, under review, assessment, interview, offer received, admitted, conditionally admitted, waitlisted, deferred, rejected, offer accepted, offer declined, withdrawn, closed. "No response yet" is shown with the date of last contact and is never treated as rejection.

Form-level steps (form opened, partially filled, ready for review) and email-level steps (draft, prepared, sent, bounced) are details within these statuses and must be shown in the timeline (Section 28.2), not as separate status systems. A bounce after "Confirmed" must move an email application to "Failed".

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

User-relevant failures must be exposed through the user dashboard without revealing sensitive operational details or credentials. The admin application must show full operational details (Section 53.3), excluding secrets (Section 53.5).

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
- Full automatic pipeline runs, including postings that close or change between matching and submission.
- Cover letters and emails reused across employers (cross-contamination), leftover placeholders, and wrong document versions.
- Multi-page conditional forms, portal résumé auto-parse errors, choice questions without a matching option, character limits, and knock-out questions.
- Portal account creation, existing accounts, email verification, expired sessions, and account lockout risk.
- Large attachments, email sending limits, out-of-office replies, and recruiter questions in reply threads.
- Photo and signature resizing to exact portal specifications; DOCX-to-PDF conversion and file compression.
- Expiring test scores, early scholarship deadlines, conditional offers, and referee invitations through university portals.
- Interview scheduling within the user's availability and time-zone differences.
- Emergency stop during an in-progress submission.
- Accuracy of the applications report against the actual submitted forms and sent emails.
- Approve-each flows: approve as-is, edit and approve, edits saved for reuse or to the profile, new questions after approval, posting changes after approval, approval expiry, cancellation, and bulk approval.
- Conflicting tracks and rules matching the same opportunity, and conflicting user settings.
- Answers computed across date boundaries: birthdays, expiring passports or test scores, notice periods, and daylight-saving changes.
- Excluded current employer, agency duplicates, rolling deadlines, multi-position postings, and reposts.
- Inactivity pause, profile-freshness pause, rule expiry, and re-authentication for sensitive actions.
- WhatsApp and push delivery failures, fallback to email, and approvals completed from a notification.
- Adding, editing, undoing, bulk-deleting, and restoring data; deleting a document used by an active rule; account deletion with and without cancelling during the grace period.
- Pauses of every duration and scope, approved applications falling inside a pause, pause end with a backlog, and extending a pause.
- Changing one track's result count and limits, "apply to all tracks", and track limits above global limits.
- Submission windows at midnight and across time zones, windows after the deadline, and many applications in one window.
- Circular archiving for postings removed after recommendation or application, amended circulars, PDF and image circulars, and partial captures.
- Compensation in other currencies, salary ranges, "negotiable" or missing salary, benefits filters, and salary-expectation questions.
- Reconciliation of recommendation and application records after interrupted actions, failures, and restores from backup.
- Excluded countries by job location, employer base, remote contract country, and required travel; multi-country postings; unclear countries; alternative country names; exclusions added after approval.
- Admin role permissions, attempts by user accounts to reach the admin application, admin edits appearing in the user's change history, secret masking, admin bulk deletion, and the platform emergency stop.

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
8. Approve-each application mode with automatic completion after approval (Section 37), for supported routes.
9. The applied-applications report and submission records (Section 28).
10. WhatsApp and push notifications with approvals from the notification (Section 36).
11. The admin application with the Super Admin role, dashboard, and management areas (Section 53).
12. The user web app and the Android and iOS mobile app, released together (Section 53.7).

External application submission should be enabled only for explicitly supported and tested workflows. Features that depend on unavailable or restricted sources must be presented as limitations rather than implied capabilities.

### 26.2 Future enhancements

Potential future enhancements may include additional source integrations, more advanced ranking customization, and broader language support. Application-document tailoring, interview preparation, supervisor outreach, and application analytics are now specified in Sections 11.5, 32, 33.5, and 34.2; their release priority must be agreed under Section 26.1.

These enhancements must not be treated as existing capabilities until implemented, tested, and included in supported-feature documentation.

### 26.3 Scope and change management

New opportunity types, integrations, ranking behaviors, and automation capabilities must be reviewed for their effects on privacy, source permissions, application safety, user experience, and existing acceptance criteria.

Changes to ranking logic, source coverage, or application automation must be documented so users can understand material changes to product behavior.

## 27. End-to-end automated workflow

### 27.1 Automated pipeline

Once the user has completed setup and enabled automatic application for a track, the system must run the following pipeline without requiring the user to start each step:

1. **Discover**: Search enabled sources on schedule and accept opportunities the user adds manually (Section 27.5).
2. **Verify**: Check that the posting is live, open, legitimate (Section 7.5), not a duplicate, and not already applied to through any route (Section 10.8).
3. **Match**: Score against the profile, apply hard eligibility filters, and place it in the correct track.
4. **Prepare**: Select the approved résumé version, generate or select the cover letter, answer questions from approved facts and answers, prepare required documents in the required formats, and choose the application route.
5. **Pre-submission check**: Run the quality checks in Section 27.4. Any failure stops this application only, not the whole pipeline.
6. **Re-check the posting**: Immediately before submission, confirm the posting is still open and its requirements, deadline, and application instructions have not materially changed since matching. A material change requires re-matching and, where the rule requires it, re-approval.
7. **Submit**: Submit through the chosen route under the active rule.
8. **Confirm**: Collect submission evidence (confirmation page, confirmation number, confirmation email, sent-email record).
9. **Record**: Store the complete submission record (Section 28.2).
10. **Report**: Include the application in the daily application report and notify the user according to their preferences.
11. **Follow up**: Track responses, deadlines, next stages, and reminders until the application reaches a final outcome.

Every opportunity that leaves the pipeline before submission must record the step at which it stopped and the reason, so the user can see why a matching opportunity was not applied to.

### 27.2 Global automation controls

- **Emergency stop**: One clearly visible control must immediately stop all automatic applications, emails, uploads, and payments across all tracks. In-progress actions must be brought to a safe state and their outcome reported.
- **Vacation/pause mode**: The user must be able to pause automatic applications for a period, with discovery and reminders optionally continuing. Pause durations and scopes are defined in Section 47.
- **Submission time windows**: The user must be able to choose when applications are submitted (for example, only at 12:00 a.m.), as defined in Section 49.
- **Rule simulation (dry run)**: The user must be able to run a rule against current opportunities and see exactly which applications would have been submitted, with which materials and answers, without submitting anything.
- **Deadline buffer**: The user must be able to set a minimum time before a deadline by which automatic applications should be submitted (for example, 24 hours), to reduce the risk of last-minute portal failures.
- **Approval escalation**: If an application is waiting for user action and its deadline is approaching, the system must escalate the reminder through the user's urgent notification channel.

### 27.3 Steps that always remain with the user

Some steps cannot or must not be automated, either because they require the user personally, because sources prohibit automation, or because they are legal commitments. The product must clearly state these limits during onboarding and in each affected application:

- Completing CAPTCHA, MFA, identity verification, or other human checks.
- Taking online assessments, coding tests, psychometric tests, language tests, or exams. The system must never complete or assist in real time with an assessment on the user's behalf.
- Recording or attending live or one-way video interviews, phone screens, and interviews. (Uploading a video file the user has already recorded, when a form asks for a video file, is allowed under Section 10.7.)
- Signing legal declarations, attestations, contracts, or offer acceptances.
- Making payments outside an active payment rule.
- Accepting or declining offers.
- Any action on a source whose terms or technical controls prohibit automation.

Every other step should be automated where the source supports and permits it and the user has authorized it.

### 27.4 Error prevention and quality checks

The product cannot guarantee that external portals, emails, or third-party data will be free of errors. It must aim for zero avoidable errors by running the following checks before every submission the system makes, in both automatic and approve-each modes, and stopping the individual application if any check fails:

- **Correct target**: Employer/institution name, role/program title, and job reference in the cover letter, email, and answers match the opportunity being applied to. Text written for a different employer or program must never be sent (cross-contamination check).
- **Correct documents**: The attached files are the intended approved versions, are readable, open correctly, meet stated format/size/page limits, and have sensible file names.
- **Complete answers**: All required fields are answered from approved sources; no placeholder text, template variables, or empty sections remain.
- **Consistent facts**: Dates, titles, grades, contact details, and names are consistent across the profile, résumé, cover letter, and form answers.
- **Language quality**: Generated text passes spelling and grammar checks in the language of the application.
- **Valid contacts**: Recipient email addresses and application links are valid, verified, and belong to the employer or institution.
- **Within limits**: The application is within the rule's volume, fee, and source limits, and the deadline has not passed in the source time zone.
- **Allowed country**: No country connected to the opportunity is excluded by the user or the platform (Section 5.3).
- **No duplicates**: The user has not already applied to this opening.

After submission, the system must check the confirmation evidence. If the evidence is missing or does not match the opportunity, the status must be "submitted but awaiting confirmation" or "outcome unknown", not "confirmed".

### 27.5 Adding opportunities manually

- The user must be able to paste a job or program link, upload a circular (PDF/image), or forward an email, and the system must extract the details, score it, and handle it like a discovered opportunity, including automatic application where a rule covers it.
- The user must be able to ask why an opportunity was not shown (for example, by pasting its link) and see whether it was not found, filtered out, below threshold, ineligible, or a duplicate.
- The user should be able to search all stored opportunities in free text (for example, "remote Python jobs in Europe with sponsorship closing this month").

## 28. Applied-applications report and submission record

This is the user's main view of what the system has done on their behalf. It must be accurate, complete, and easy to read.

### 28.1 Applications list

The user must be able to see a list of all applications, with at least:

- Opportunity title, employer/institution, location, and track.
- Application route (for example LinkedIn Easy Apply, career page, email, government portal, university portal).
- Applied by (automatic rule name, user-approved, or manual by the user).
- Date and time submitted, in the user's time zone.
- Current submission status and outcome status (Section 20.2), shown with both a text label and a visual indicator.
- Deadline, next action, and next action due date.
- Match score at the time of application.

The list must support sorting, filtering (by date, track, status, route, employer, country, rule, and opportunity type), free-text search, and grouping by day or week. The list must also show opportunities that matched but were not applied to, with the reason (Section 27.1).

### 28.2 Application detail and submission record

For every submitted or attempted application, the detail view must show:

- **Original circular**: The archived copy of the posting exactly as it appeared at the time of application (Section 50), including title, description, requirements, deadline, attachments, and source links. It must remain available even after the employer removes the posting. Later changes to the posting must be shown as separate versions.
- **Timeline**: Every step with time and outcome, such as discovered, matched, prepared, checked, submitted, confirmed, and later status changes.
- **Questions and answers**: Every question asked by the form, shown exactly as written on the form, with its field type, the options offered (for choice questions), whether it was required, the exact answer submitted, the source of the answer (verified profile fact, approved reusable answer, generated text approved under a rule, or entered by the user), and whether the user edited it.
- **Email applications**: The sender address, recipients (to/cc/bcc), subject, full message body, attachments, sending time, and message identifier, plus any replies, bounces, or automatic responses in the same thread.
- **Documents**: Each file submitted, its version, file name, size, and a fingerprint (hash), with the ability to open the exact file that was sent.
- **Evidence**: Confirmation number, confirmation email, and, where permitted, a screenshot or saved copy of the completed form and the confirmation page.
- **Rule and authorization**: Which rule or approval allowed the submission, and the rule version at that time.
- **Issues**: Any warnings, uncertain answers, skipped optional questions, or errors, and how each was resolved.

Information in the submission record must not be edited afterwards. User corrections and notes must be added as separate entries with timestamps. The only exception is deletion requested by the user under privacy controls (Section 13), which must remove the content and keep only a minimal record that a deletion took place.

### 28.3 Question bank

- The system must keep a library of all application questions encountered across applications, grouping questions with the same meaning.
- For each question group, show how it was answered, how often it appears, and whether an approved reusable answer exists.
- New or unanswered questions that blocked automatic applications must be highlighted so the user can add approved answers once and unblock future applications.

### 28.4 Reports

- **Daily application report**: Applications submitted, confirmed, failed, and waiting for user action that day, with links to each record, delivered with or alongside the daily digest.
- **Weekly summary**: Totals by track, route, and status; responses received; upcoming deadlines, interviews, and exams.
- Reports and individual records must be exportable (for example as PDF and spreadsheet), and printable.

### 28.5 Presentation and design

- Layouts must prioritize what needs the user's action first, then recent activity, then history.
- Status must never be shown by colour alone; each status must have a text label and an explanation of what it means.
- Generated text, user-written text, and text copied from sources must be visually distinguishable.
- The list and detail views must work on mobile-sized screens, including approving or answering blocked questions from a phone.
- Dates must show the time zone; amounts must show currency and period.
- Long content (job descriptions, emails, essays) must be collapsible with the key facts summarized first.

## 29. Employer and university portal accounts

Many applicant-tracking systems and university portals require a separate account per employer or institution.

- The system must detect whether the user already has an account on a portal before creating one.
- Account creation is an external action and must be covered by the active rule or approved by the user. The rule must state whether the system may create accounts and with which email address.
- Passwords for created accounts must be strong, unique, and stored in an encrypted credential store. The user's main email or other account passwords must never be reused. The user must be able to view, export, and delete stored credentials.
- Email-verification links and one-time codes may be completed automatically only if the user has authorized inbox access for that purpose (Section 11.4); otherwise the user must be asked.
- "Sign in with Google/LinkedIn/Microsoft" or similar options require the user's consent for each provider and must show what access is being granted.
- The system must keep a list of all portal accounts it created or used, with portal, employer, email used, creation date, and a link to manage or delete the account.
- Expired sessions, locked accounts, and password-reset requests must be reported, and the system must not repeatedly attempt logins in a way that could lock the account.

## 30. Online-form corner cases

The system must handle the following situations correctly or stop and ask the user:

- **Multi-page and conditional forms**: Questions that appear only after earlier answers; the full set of questions must be known before submission is considered ready.
- **Résumé auto-parse by the portal**: Many portals pre-fill fields by parsing the résumé. All pre-filled values must be checked against verified profile facts and corrected; parsed values must not be accepted unchecked.
- **Choice questions without an exact match**: When the user's approved answer is not among the options, the system must not pick the "closest" option if that changes the meaning; it must ask the user.
- **Format constraints**: Character and word limits, numeric-only fields, phone formats with country code, date formats, address formats, month/year fields where the exact month is unknown, and "years of experience" fields requiring a whole number. The system must not truncate or round an answer in a way that changes its meaning without approval.
- **Employment and education history entries**: Multiple entries, "currently working here", gaps, and overlapping dates must be entered consistently with the profile.
- **Knock-out questions**: Questions whose answer disqualifies the user (for example, "Do you require sponsorship?") must be answered truthfully from approved answers. The system must never change an answer to pass a knock-out question.
- **Voluntary and demographic questions** (gender, ethnicity, disability, veteran status, and similar): Answered only from the user's explicit choice per question, including "prefer not to say" where the user has chosen it.
- **Consent and terms checkboxes**: Privacy consent, data-processing consent, and terms acceptance must be covered by the rule or presented to the user; declarations of truthfulness are attestations (Section 27.3).
- **Free-text and essay questions**: Answered from approved reusable answers or generated under a rule that explicitly allows generated essay answers; otherwise sent to the user.
- **Questions in another language**: Answered only if the meaning is clear and the language of the answer is allowed by the user's settings.
- **"How did you hear about us"** and referral fields: Answered with the actual source; referral names only if the user recorded a real referral.
- **Location and preference selections**: Multiple location, shift, or department choices must follow the user's preferences.
- **Session timeouts, save-as-draft, and resumed forms**: Progress must be saved where the portal allows, and resumption must not create a duplicate application.
- **Job closed or changed during application**: Stop, record the reason, and notify the user.
- **"Already applied" messages**: Record them and do not attempt again.
- **Portal errors after clicking submit**: Treat as an uncertain outcome (Section 23.2).
- **One-way video, live coding, or assessment steps embedded in the form**: Hand over to the user (Section 27.3).

## 31. Email-application corner cases

- Attachments must respect common size limits; when too large, the system should compress files without changing their content, or use another method allowed by the employer, and never silently drop an attachment.
- File names must be professional and consistent (for example, "Firstname-Lastname-CV.pdf").
- Emails must use the user's configured signature and contact details.
- Sending must follow the user's submission time windows (Section 49). If the user has not set a window for email applications, the default should be business hours in the recipient's time zone.
- The system must respect the email provider's daily sending limits and avoid patterns likely to mark the user's account as spam.
- Replies, out-of-office responses, bounces, and recruiter questions must be linked to the application thread and shown to the user. Automatic replies to recruiters must be limited to what the active rule allows; questions requiring the user's judgment must be sent to the user.
- Follow-up emails after no response may be sent only if the rule allows it, at most a user-defined number of times, and not if the employer asked not to be contacted.
- Emails must never be sent to addresses not stated by the employer for applications, and must never be sent in bulk to multiple employers in one message.

## 32. Application materials: tailoring and formatting

### 32.1 Résumé/CV tailoring

- The system should create role-specific résumé versions by selecting, reordering, and rewording the user's verified experience, skills, and achievements to match the posting's requirements and keywords.
- Tailoring must never add skills, experience, employers, dates, titles, results, or qualifications the user does not have.
- Tailored versions must be checked for compatibility with applicant-tracking systems (readable text, standard section headings, no information hidden in images, supported file type) and for page-length targets set by the user.
- Whether tailored versions may be sent automatically or need review must be set in the rule, as for cover letters.
- The system must record exactly which version was sent with each application.
- Academic CVs, Bangladesh-style CVs, and country-specific formats (for example, Europass) should be supported where the user enables them.

### 32.2 Document preparation and conversion

- The system should convert documents to required formats (for example DOCX to PDF), compress files to size limits, merge multiple pages into one file where required, and rename files to required conventions.
- For photos and signatures with exact requirements (pixel size, file size, background, format), the system should resize and compress the user's original image to meet the specification and show the result for approval. It must not alter the person's appearance.
- Conversion must never change the content of a document. The original must always be kept, and converted files must be linked to their source.

### 32.3 Generated writing

Cover letters, statements of purpose, personal statements, research statements, motivation letters, essay answers, and emails must:

- Be based only on verified profile facts, approved materials, and verified opportunity details.
- Be specific to the employer/program, not generic, and respect stated word or character limits.
- Pass the cross-contamination and language-quality checks (Section 27.4).
- Avoid copying text from other people's work; quotations from sources must be attributed.
- Follow the user's chosen tone, length, and language.

## 33. Student and academic journey

### 33.1 Opportunity types for students

In addition to master's and PhD programs, the system should support, when enabled: internships, part-time and campus jobs, graduate trainee and fresher programs, research assistantships, teaching assistantships, fellowships, scholarships, exchange programs, summer schools, and postdoctoral positions.

For international study opportunities, the system should show work-hour limits for students and post-study work options as published by official sources, with source links and dates, labeled as information and not legal advice.

### 33.2 Application planning

- For each target intake (for example, Fall/Spring/Winter), the system must create a plan working backwards from the deadlines, including test dates, test registration deadlines, score-sending time, document preparation, referee requests, and application submission.
- Early-decision, priority, and scholarship-consideration deadlines that are earlier than the final deadline must be tracked separately.
- The system must estimate the total application budget (application fees, test fees, score-sending fees, document evaluation, translation, courier, visa fees), showing which amounts are from official sources and which are estimates.
- The system must show application fee waivers where published, with their conditions.

### 33.3 Tests and scores

- Track test registration deadlines, test dates, score release dates, and score validity expiry dates, and warn when a score will expire before a program's deadline or start date.
- Track official score reports sent to each institution (for example, via institution codes), including date sent and whether the institution confirmed receipt. Sending official scores may involve fees and must follow payment rules.
- Show whether a program accepts self-reported scores, requires official scores, or accepts alternatives such as a medium-of-instruction letter, and label each as stated, not stated, or unclear.

### 33.4 Academic credentials

- Grades must be stored in their original scale (for example, CGPA out of 4.00, GPA out of 5.00, percentage, division/class). Any conversion must be labeled as an estimate unless the program or an evaluation service provides an official conversion.
- The system must show whether a program requires a credential evaluation (for example, WES or similar), certified or attested copies, translations, notarization, or sealed transcripts, with timelines and costs where published.
- Degree-equivalence rules (for example, three-year versus four-year bachelor's degrees) must be shown when stated and flagged as uncertain when not stated.

### 33.5 Supervisor and professor outreach

For research degrees where contacting a supervisor is expected or helpful:

- The system should find potential supervisors whose research matches the user's interests, using faculty pages and publication listings, and show the evidence of the match.
- The system may draft personalized emails that refer accurately to the supervisor's real work and the user's verified background. Sending is an external action under the email authorization rules.
- The user must be able to set limits such as maximum outreach emails per day, per department, and per university, and whether follow-ups are allowed.
- Replies must be tracked and linked to the program; positive replies, requests for a call, or requests for documents must be raised to the user immediately.
- The system must not send the same generic email to many professors, and must stop outreach to a professor who declines or asks not to be contacted.

### 33.6 University application portals

- Track each university portal application: account, sections completed, documents uploaded, referees invited, fee status, and submission status.
- Inviting referees through a portal sends an email to a third party and requires the user's authorization for each referee and program, or a rule that explicitly covers it.
- Show missing items that block submission and items the institution must still receive (for example, official transcripts or test scores).

### 33.7 Decisions, offers, and next steps

- Track admission decisions: accepted, conditionally accepted (with the conditions to meet and their deadlines), waitlisted, interview invited, rejected, and deferred.
- Track acceptance deadlines, deposit amounts and deadlines, deferral options, and scholarship acceptance requirements.
- Provide a comparison of offers, covering total cost, funding amount and duration, net cost, location, program length, and other factors the user selects, using only stated or clearly labeled estimated values.
- Accepting an offer, paying a deposit, and declining other offers are user actions (Section 27.3); the system may prepare the messages.

### 33.8 After admission

The system should provide a checklist and deadlines for steps after admission, based on official sources for the destination country and institution: admission documents (for example, I-20, CAS, CoE, or admission letter), proof of funds, visa or study-permit application and appointment, health insurance, accommodation, tuition payment, travel, and arrival registration. Requirements must be linked to their official sources and dates, and must not be presented as legal or immigration advice.

## 34. Job seeker journey after applying

### 34.1 Assessments

The system must detect assessment invitations (from emails, portals, or user input), record their type, platform, deadline, and duration, remind the user, and provide preparation material relevant to the role. The system must not take or assist in real time with any assessment (Section 27.3).

### 34.2 Interviews

- Record interview invitations, rounds, format (phone, video, on-site), date and time with time zone, interviewers where provided, and meeting links or addresses.
- Where the user has authorized calendar access and set availability, the system may select an interview slot from an employer's scheduling link within the user's available times, under a rule that allows it; otherwise it must propose slots for the user to choose.
- Provide an interview preparation pack: company and role summary, requirements from the posting, likely questions, and the user's relevant experiences mapped to the requirements.
- Send reminders before the interview and prepare a thank-you email draft afterwards.

### 34.3 Offers

- Record offer details: salary and its period, bonus, benefits, start date, location, work arrangement, probation, notice period, and acceptance deadline.
- Normalize salaries for comparison (annual/monthly/hourly, gross where stated, currency with the conversion date), labeling assumptions.
- Check offers for fraud warning signs (Section 7.5).
- Provide offer comparison and negotiation preparation based on the user's stated priorities and available market information, labeled as guidance.
- After the user accepts an offer, the system should suggest pausing automatic applications and preparing withdrawal messages for other active applications, each requiring the user's authorization.

### 34.4 Rejections and outcomes

Record rejections with any stated reason, apply reapplication waiting periods (Section 10.8), and use outcomes in personal insights (Section 11.5). Silence must not be recorded as rejection; the outcome status remains "no response yet" with the date of last contact (Section 20.2), and after a user-defined period the system may suggest a follow-up (Section 31) or let the user close the application.

### 34.5 Employer research and networking

- Show employer information such as size, industry, locations, official website, and legitimacy indicators, and employer reviews where permitted by the source.
- Allow the user to record contacts (recruiters, employees, referrers, alumni) and link them to employers and applications.
- Draft referral requests and networking messages from verified facts; sending them follows the email authorization rules.

### 34.6 Job types

Each track must be able to filter by full-time, part-time, contract, temporary, freelance, internship, apprenticeship, graduate trainee, and volunteer roles. Bidding on freelance marketplaces is out of scope unless explicitly enabled.

## 35. Bangladesh-specific requirements

### 35.1 Profile data for Bangladesh applications

- Name in both English and Bangla, matching the spelling on certificates and NID exactly. The system must warn when names, dates of birth, or parents' names differ between documents.
- SSC/HSC (or equivalent such as Dakhil/Alim, O/A level) and degree records: board or university, roll number, registration number, passing year, group/subject, and result in the original scale (GPA out of 5, CGPA out of 4, or division/class).
- Present and permanent addresses with division, district, and upazila/thana, and home district.
- Mobile number in the Bangladesh format (+880) and its connection to payment services where used for fees.
- Quota or special-status information (for example, children/grandchildren of freedom fighters, persons with disabilities, ethnic minorities) only if the user provides it, with supporting document references.

### 35.2 Government application specifics

- **Age calculation**: Age eligibility must be calculated as of the date specified in each circular, which may differ from the deadline. Age relaxations (for example, for specific quotas or special government orders) must be applied only when the circular states them and the user's status is verified.
- **Photo and signature**: Prepare the user's photo and signature to the exact size, dimension, and format requirements of each portal (Section 32.2).
- **Post selection**: Where one circular includes multiple posts, the system must show each post separately with its own eligibility, and the user's selection rules must determine which posts to apply for. Rank-ordered preferences (for example, cadre or post preferences) must always come from the user.
- **Fee payment**: Fees paid through mobile or SMS-based payment within an official time limit after form submission must be tracked as a separate deadline; the application is not complete until payment is confirmed.
- **Applicant copy**: The system must download and store the applicant copy or confirmation provided by the portal, along with the user ID and password the portal issues.
- **Holidays and office hours**: Public holidays and official working hours that affect deadlines, payments, or document submission must be shown where relevant.

### 35.3 Private-sector job portals

The system should support Bangladesh job portals and employer career pages as permitted, including keeping the user's portal profile consistent with the verified profile, and handle "salary negotiable" as "not stated".

## 36. Notifications, approvals, and communication channels

- The product must support WhatsApp and mobile push notifications as primary channels, and email for the daily digest, reports, and as a fallback. SMS and Telegram may be added as optional channels. The user must be able to choose different channels for urgent and non-urgent messages.
- If a notification cannot be delivered on the chosen channel (for example, the WhatsApp number is not verified or push permission is turned off), the system must use the user's fallback channel and show the delivery problem in the dashboard.
- Channels with sending restrictions (for example, messaging-platform rules on message templates and reply windows) must be handled within those rules; if an approval cannot be completed in the channel, the notification must link to the app.
- Urgent notifications include: approval needed close to a deadline, a blocked automatic application, an interview invitation, an offer, a payment request, a suspected fraudulent posting, and authorization expiry.
- The user should be able to approve an application, answer a blocking question, or complete a simple action directly from a notification, with secure authentication and a link to the full details.
- Approvals given through a notification must be recorded the same way as approvals in the main interface.

## 37. Approve-each mode: approval and automatic completion

In approve-each mode, the user approves each application once. After approval, the system must complete every remaining step automatically, without asking again, except for the steps that must stay with the user (Section 27.3) or a situation listed in Section 37.4.

### 37.1 Approval package

Before asking for approval, the system must prepare the application as completely as possible and present one approval package containing:

- The opportunity summary, match explanation, hard-eligibility status, deadline, and any fraud or uncertainty warnings.
- The application route and destination (portal, career page, email address).
- Every question known so far, exactly as asked, with the proposed answer and its source.
- The full text of the cover letter, email, and any generated essays.
- The exact files to be sent (résumé version, cover letter, transcripts, photo, signature, video), each viewable.
- Any account that will be created, fee that will be paid, consent checkbox that will be ticked, and personal data that will be shared with the employer or institution.
- Items still missing that the user must provide, clearly separated from items ready to send.

The package must be readable on a phone and must highlight what needs the user's attention first.

### 37.2 What the user can do

The user must be able to:

- **Approve** the package as it is.
- **Edit and approve**: change any answer, text, recipient (within verified addresses), or file selection, and then approve.
- **Answer missing items** and approve in the same step.
- **Approve with timing**: choose to submit now or at a set time before the deadline.
- **Reject** with an optional reason (for example "not interested", "not eligible"), which is used as recommendation feedback (Section 22.3).
- **Defer**: keep the package for later; it must be re-checked before it can be approved again.

For each edit, the user must be able to choose whether the change applies:

- **to this application only** (the default);
- **as a saved reusable answer** for questions with the same meaning, used in future approval packages and, if the user adds it to a rule, in automatic mode; or
- **as a profile update**, which changes the verified profile fact and is shown as a profile change in the audit history.

Edits applied to this application only must not change the profile, saved answers, or approved documents. Edits saved for reuse must not be applied to applications that were already approved or submitted.

### 37.3 After approval

After approval, the system must automatically and in order: create or sign in to the portal account (if the approval covered it), fill all fields with the approved values, upload the approved files, tick only the consents included in the approval, pay any approved fee, run the pre-submission checks (Section 27.4), re-check the posting (Section 27.1, step 6), submit, collect confirmation evidence, store the submission record (Section 28.2), and notify the user of the result.

The approval covers only the opportunity, route, content, files, fees, and consents shown in the package. It must not be used for any other application (Section 23.1).

### 37.4 When the system must come back to the user after approval

The system may continue without asking again for differences that do not change meaning or content, such as a field order change or a different page layout. It must pause and ask the user only about the specific new item, keeping all other approved values, when:

- The form shows a question that was not in the approval package and cannot be answered from an approved reusable answer with the same meaning.
- A required file, fee, consent, or account step was not in the package.
- The posting, deadline, requirements, or destination changed materially since approval.
- A pre-submission check fails, a CAPTCHA/MFA or other user-only step appears (Section 27.3), or a fraud warning is raised.

A short new question should be answerable directly from the notification (Section 36).

### 37.5 Approval validity and cancellation

- An approval expires if the application has not been submitted within a user-defined period (default to be decided, Section 54) or after the deadline passes; an expired approval requires a new review.
- The user must be able to cancel an approved application until submission starts. For emails, the user should be able to set a short cancel window (for example, 30 seconds to 10 minutes) during which a queued email can still be stopped.
- The emergency stop (Section 27.2) also stops approved applications that have not started submitting.

### 37.6 Bulk approval

The user should be able to review several approval packages in a list and approve many at once. Bulk approval must show, for each item, the employer, role, route, files, and any warnings, and must exclude items with blocking warnings, fees, or attestations, which must be approved individually.

### 37.7 Approval is not an attestation

Approving a package does not count as signing a legal declaration or attestation. Declarations of truthfulness, terms acceptance with legal effect, and similar statements must be shown with their full text and confirmed separately, even inside an approval package.

## 38. Rule precedence and conflict resolution

To avoid contradictory behaviour, the following order of precedence applies whenever settings or rules disagree. A higher item always wins over a lower one:

1. Law, source terms, and technical restrictions (for example CAPTCHA, prohibited automation).
2. Product safeguards that can never be turned off: no fabrication, no bypassing verification, user-only steps (Section 27.3), and the emergency stop.
3. Platform settings set by administrators (Section 53): platform emergency stop, disabled sources or routes, and platform maximum limits.
4. The user's explicit decision on a specific item (an approval, rejection, edit, or cancellation).
5. Global user settings (global caps, paused mode, excluded employers, privacy choices, quiet hours).
6. Track settings.
7. Automatic-application rules.
8. Platform defaults set by administrators, which apply only where the user has not chosen a setting.
9. Generated suggestions and recommendations.

Further rules:

- **Most restrictive wins**: If an opportunity matches more than one track or rule, it must be applied to at most once, and the most restrictive applicable settings apply: approve-each wins over automatic, a lower fee limit wins over a higher one, and a block wins over an allow. The user may set an explicit track priority to decide which track the opportunity is reported under.
- **Official source wins over secondary**: When sources conflict, the official employer, institution, or government source is preferred, and the conflict is shown (Sections 7.3 and 21.2).
- **Verified profile facts win over documents and extracted data**: Inconsistencies are shown for review (Section 19.3), never resolved silently.
- **Newer user decisions win over older ones**, but must not change actions already completed.
- **Unknown is not satisfied**: An unknown hard requirement blocks automatic application by default. A rule may allow applying when a hard requirement is unknown (not when it is known to fail) only if the user explicitly enables that option for the rule.

When the system detects two user settings that conflict and the precedence above does not settle it, it must show the conflict to the user and apply the more restrictive setting until the user resolves it.

## 39. Computed answers and eligibility over time

Many answers depend on the date of submission. The system must compute them at submission time, not when the profile was created:

- **Age**: From date of birth as of the date the opportunity specifies (Section 35.2), otherwise as of submission.
- **Years of experience**: Overall and per skill, calculated from employment history using user-approved counting rules (for example, whether internships, part-time work, and overlapping roles count). The computed value and rule must be shown in the approval package and submission record.
- **Availability and start date**: Calculated from the user's notice period or availability rule (for example, "one month after offer"), not a fixed stored date that may already be in the past.
- **Expected graduation and pending results**: Shown as expected, with the expected date. The system must not state that a degree is completed before it is.
- **Expiring documents and status**: Passports, visas, work permits, and test scores must be checked against the deadline and expected start date; an expiry before those dates must be flagged.
- **Salary expectations**: Converted to the posting's currency and period using a stated rate and date, only within user-approved ranges.
- **"Or equivalent experience"**: Treated as satisfied only if the user's approved rule says so; otherwise shown as uncertain.

## 40. Confidentiality of the job search and third-party data

### 40.1 Confidential job search

- The user must be able to mark their current employer (and related companies or recruiters) as excluded. The system must never apply to, contact, or share the user's profile with excluded organizations.
- The user must be able to choose whether portal profiles created or updated by the system are visible to recruiters or searchable, where the portal allows this setting.
- Notifications must not show sensitive details on a lock screen if the user turns on private notifications.

### 40.2 Sharing personal data with employers and institutions

- Every application shares personal data with a third party. The approval package (Section 37.1) or the active rule must show which data and documents will be shared and with whom.
- The system must keep a record of what personal data was shared with each organization and when, as part of the submission record.
- Where an employer's or institution's privacy notice is shown during application, the system must keep a link to it in the submission record.

### 40.3 Data about other people

- Referee and contact details are personal data of other people. The user must confirm that each referee has agreed to be listed before the system shares their details.
- The system must not collect personal data about recruiters, professors, or employees beyond what is needed for the application and what is publicly published for professional contact.

### 40.4 Use of AI services

- If generated text, extraction, or matching uses external AI services, the product must tell the user which data is sent to them and why.
- User data must not be used to train external models without the user's explicit consent.
- The model version used for generated content and scoring must be stored in the submission record (Section 22.1).

## 41. Account security and automation safety over time

- The product must support multi-factor authentication for the user's own account, and should require it when automatic application, payments, or connected email accounts are enabled.
- Sensitive actions must require recent re-authentication: enabling or widening an automatic rule, enabling payments, viewing stored portal passwords, exporting all data, and deleting the account.
- The user must be able to see active sessions and devices and sign out of all of them.
- The user must be notified of new sign-ins, rule changes, and connected-account changes.
- **Inactivity safety**: If the user has not opened the product or responded to notifications for a user-defined period, automatic applications must pause automatically until the user returns, and the user must be notified.
- **Profile freshness**: If key profile facts (contact details, current job, availability, salary expectations) have not been confirmed within a user-defined period, the system must ask the user to confirm them, and may pause automatic applications until they do.
- **Rule expiry**: Automatic rules expire on their set review date (Section 10.1); the user must be reminded before expiry.
- **Security incidents**: If a security incident may have affected the user's data or connected accounts, the user must be informed promptly with what happened and what to do.

## 42. Additional opportunity corner cases

The system must handle these situations explicitly:

- **Recruitment agencies**: Identify postings by agencies versus direct employers; show the agency and, where stated, the client. The user must be able to exclude agencies. Applying to the same job through an agency and directly must be treated as a duplicate (Section 10.8).
- **Rolling or "open until filled" deadlines**: Show as rolling, recommend applying early, and never invent a deadline.
- **No stated deadline**: Show "deadline not stated" and re-check that the posting is still live before submission.
- **Multiple positions in one posting**: Show each position separately with its own requirements and apply only to the positions the user's rules or approval select.
- **Reposted jobs**: Link reposts to earlier versions, and show any earlier application or rejection for the same job.
- **Bilingual or translated duplicates**: Treat the same posting in two languages as one opportunity.
- **Language requirements**: A required language the user does not speak at the required level is a hard eligibility failure.
- **Contractor and employer-of-record roles**: Show whether a role is employment or contract, and the country of contract, where stated.
- **Unpaid or very low-paid roles**: Label unpaid internships and roles below the user's minimum, and exclude them if the user chooses.
- **Daylight-saving changes and time zones**: Deadlines must remain correct across daylight-saving changes in both the source and user time zones.
- **Posting removed after application**: Keep the snapshot taken at application (Section 28.2) and continue tracking the application.
- **Job closed early**: Notify the user if an opportunity awaiting approval closes before the stated deadline.
- **Same person, multiple names or spellings**: Support name variants (for example, the name order on a passport versus certificates) and use the variant each application requires, with a consistency warning (Section 35.1).
- **Minors**: If the user is under the minimum age set for the product, guardian consent or other restrictions required by law must apply.

## 43. Standards and compliance

- **Accessibility**: The product should meet WCAG 2.2 Level AA.
- **Security**: The product should be verified against a recognized application-security standard (for example, OWASP ASVS Level 2) before external application automation is enabled.
- **Data protection**: The product must comply with the data-protection laws that apply to the user and to launch markets, including Bangladesh's applicable law and, where users or employers are in the EU/UK, GDPR. Consent records, purpose limitation, data minimization, and the user's rights to access, correct, export, and delete must be supported.
- **Email and messaging rules**: Emails and messages must follow anti-spam rules and the messaging platforms' usage policies.
- **Source terms**: Each source's terms on access, automation, and data reuse must be recorded in the source registry (Section 18.1) and respected.
- **Transparency**: The product must clearly state its limits, including what it cannot automate, that coverage is not complete, and that match scores are estimates.

## 44. Help, support, and feedback

- The product must provide in-app help explaining each feature, status, and setting in plain language, in the interface language the user selects.
- The user must be able to report a problem with a specific application, opportunity, or notification, and the report must include the relevant record automatically (without secrets).
- The user must be able to see the status of reported problems.
- Product-wide incidents affecting the user must be communicated as described in Section 24.2.

## 45. Requirement consistency rules

To keep this document free of contradictions as it grows:

- Section 20.2 is the only status model; Section 38 is the only precedence order; Section 27.3 is the only list of user-only steps; Section 27.4 is the only list of pre-submission checks; Section 47 is the only definition of pause; Section 49 is the only definition of submission timing; Section 50 is the only definition of circular archiving; Section 51 is the only definition of compensation rules; Section 53 is the only definition of administrator access. Other sections must refer to these rather than define their own versions.
- Where a section says "automatic" without further detail, it means "within an active rule or an approval, and subject to Sections 27.3 and 38".
- Where a section says "must not report success", success means the "Confirmed" status in Section 20.2.
- Any new requirement must be checked against Sections 20.2, 27.3, 27.4, and 38 before it is added.

## 46. User data management

### 46.1 Add, update, and delete everything

The user must be able to add, view, update, and delete every type of data they own, including:

- Profile facts, education, employment, skills, tests, links, identity details, addresses, and referees.
- Documents and all their versions, videos, photos, and signatures.
- Saved reusable answers and the question bank (Section 28.3).
- Tracks, filters, thresholds, result counts, compensation rules (Section 51), submission windows (Section 49), and automatic-application rules.
- Notification channels and preferences.
- Connected accounts, stored portal credentials, and portal-account records.
- Contacts, notes, tasks, reminders, and follow-ups.
- Opportunity decisions (saved, dismissed, not eligible) and feedback.
- Recommendation history, application records, and archived circulars (subject to Section 46.3).

For every change:

- The previous value must be kept in the change history so the user can see what changed and when, and undo a recent change.
- Deleting an item that is used by an active rule, a queued approval, or an in-progress application must show what will be affected and ask the user to confirm. Applications already submitted keep the values that were actually sent (Section 28.2).
- Bulk actions (for example, delete several documents or dismiss many opportunities) must show a summary before they are applied.
- Deleted items should go to a recently-deleted area for a user-defined period (default to be decided) before permanent deletion, unless the user chooses permanent deletion immediately.

### 46.2 Account deletion

- The user must be able to delete their whole account from the settings, after re-authentication (Section 41).
- Before deletion, the product must offer a full data export (Section 13) and show what will be deleted, what cannot be deleted by the product (for example, applications already received by employers, and accounts on employer portals, which the user must close with each portal), and any grace period.
- During an optional grace period (default to be decided), the user must be able to cancel the deletion. All automatic applications, emails, and payments must stop immediately when deletion is requested.
- On deletion, the product must revoke all connected-account access, delete stored portal credentials, delete all personal data, documents, records, and archives, and send a final confirmation to the user's email.
- Data kept after deletion because of legal obligations must be listed, kept only for the required period, and not used for any other purpose.

### 46.3 Deleting application history

Deleting an application record or archived circular is allowed, but the product must warn the user that the record will no longer be available as evidence. Deletion follows Section 28.2 (a minimal record that a deletion happened is kept).

## 47. Pausing

### 47.1 Pause durations

The user must be able to pause for:

- A number of days, weeks, months, or years.
- Until a specific date and time.
- A custom date range starting in the future (for example, from 1 to 15 December).
- Indefinitely, until the user resumes manually.

### 47.2 Pause scope

The user must be able to choose what is paused:

- Everything (discovery, recommendations, applications, and notifications).
- Applications only (discovery and recommendations continue).
- Notifications only, or specific notification types.
- One or more specific tracks, rules, or application routes.

### 47.3 Pause behaviour

- During a pause of applications, no application may be submitted, including those already approved. Approved applications whose deadline falls within the pause must be listed for the user before the pause starts, with the option to submit them first, keep them paused, or cancel them.
- Reminders for deadlines, interviews, exams, and offers the user has already recorded should continue unless the user pauses those too.
- The dashboard must clearly show what is paused and until when.
- The user must be reminded before a timed pause ends (for example, one day before), and must be able to extend or end the pause early.
- When a pause ends, the system must re-check approvals (Section 37.5), rule expiry, and profile freshness (Section 41) before resuming applications, and must not submit a large backlog at once beyond the volume caps (Section 10.8).
- A pause never deletes data. Account deletion is a separate action (Section 46.2).

## 48. Per-track customization

Every track setting is independent. Changing one track must not change any other track unless the user explicitly chooses "apply to all tracks" or "apply to selected tracks". In particular, the user must be able to set separately for each track:

- Number of results shown per day (for example, ten for remote jobs while other tracks stay at five).
- Number of applications allowed per day and per week.
- Match threshold, filters, compensation rules (Section 51), application mode, submission windows (Section 49), notification settings, and pause (Section 47).

The product must have a clear "reset to default" per track and show which settings differ from the defaults. Per-track limits must stay within global limits (Section 10.8). If a track limit is higher than the global limit, the global limit applies, and the conflict must be shown (Section 38).

## 49. Submission timing

### 49.1 Time windows

- The user must be able to choose when applications are submitted: as soon as ready, at a specific time (for example, 12:00 a.m.), within a time window (for example, 11 p.m. to 2 a.m.), or on specific days of the week.
- Windows can be set globally, per track, and per application route (for example, emails during the recipient's business hours, portal applications at midnight).
- The user must choose whether times are in the user's time zone or the recipient's time zone.
- In approve-each mode, the user can also choose a time for a single application when approving it (Section 37.2).

### 49.2 Deadlines and windows

- If the next allowed window falls after the deadline buffer (Section 27.2) or the deadline, the system must follow the user's chosen setting: submit at the earliest possible time before the deadline, or skip and notify. The default must be to notify the user and ask.
- The deadline must be checked in the source's time zone.
- If many applications are scheduled for the same window, they must be submitted one after another within volume caps and source rate limits, not all at once.
- If a submission in the window fails, retries must follow Section 23.2, and the next window may be used if the deadline allows.

### 49.3 Records

The scheduled time, actual submission time, and the reason for any delay must be stored in the submission record.

## 50. Circular archive

### 50.1 What is archived

For every opportunity that was recommended to the user, saved, or applied to, the system must keep a complete private copy of the original circular, including:

- The full text exactly as published, in its original language, and any translation (labeled as a translation).
- The page as it appeared (for example, as a saved page or PDF), and the original files, such as PDF circulars, images of newspaper advertisements, and attached documents.
- The source URL, source name, publication date, the date and time the copy was taken, and a fingerprint (hash) to show it has not been changed.
- The application form questions as seen when applying, where they could be captured.

### 50.2 Versions

- The circular must be archived when the opportunity is first recommended or saved, and again at the time of application.
- If the posting changes (for example, an amended deadline or corrigendum), each version must be archived and the differences highlighted.
- The archived copy at the time of application is the one linked to the submission record (Section 28.2).

### 50.3 Availability

- Archived circulars must remain available to the user even after the employer or source removes or changes the posting, for as long as the user keeps their account and has not deleted them (Section 46).
- The product must show clearly when the live posting has been removed and that the user is viewing the archived copy.
- Archived circulars are private to the user (and visible to administrators under Section 53) and must not be shared or republished. If a source's terms or applicable law restrict storing a copy, this must be recorded in the source registry (Section 18.1), the user must be told what could not be kept, and the decision is listed in Section 54.
- If the system could not capture a complete copy (for example, the page was unavailable), it must say so and must not present a partial copy as complete.

## 51. Compensation rules

### 51.1 What the user can set

The user must be able to set compensation rules globally and per track, including:

- Minimum and target salary, with currency, period (hourly, monthly, yearly), and whether gross or net.
- Different minimums by country, city, or work arrangement (for example, a higher minimum for on-site roles abroad than for remote roles).
- For Bangladesh government jobs, the minimum grade or pay scale.
- For academic opportunities, minimum stipend or salary, required tuition coverage (full, partial, none), and minimum funding duration.
- Required or preferred benefits, such as bonus, equity, health insurance, paid leave, housing, relocation support, visa and immigration costs, remote-work allowance, transport, meals, festival bonus, provident fund, gratuity, and retirement benefits.

### 51.2 How compensation rules are applied

- Each compensation rule is either a hard filter (opportunities below it are excluded and never applied to) or a preference (it affects the match score only). The user chooses which.
- When a posting does not state compensation ("negotiable" or "not stated"), the user must choose whether such opportunities are included, excluded, or included only for recommendations and not automatic applications. The default is: include in recommendations, exclude from automatic applications.
- Salary ranges must be compared using the top and bottom of the range as the user chooses (for example, the top of the range must meet the minimum).
- Comparisons in a different currency must use a stated exchange rate and date, and must be labeled as converted.
- Compensation that is unclear (for example, a period not stated) must be shown as uncertain and treated as "not stated" for hard filters.

### 51.3 Salary questions in applications

- The user must set approved answers for salary-expectation questions per country, currency, and track, including whether to give a number, a range, or "negotiable" where the form allows.
- The system must never state a figure below the user's minimum, and must not reveal the user's minimum unless the user has approved that answer.
- Current-salary questions must only be answered from a user-approved answer, and must be left to the user where the user has not approved one. Where local law restricts such questions, the product may show this as information.

### 51.4 Offers

Offers must be checked against the user's compensation rules, and differences shown in the offer comparison (Section 34.3).

## 52. Tracking accuracy

### 52.1 What "100% accurate" means in this product

- **Records of what the system did must be complete and exact**: every recommendation, application, email, upload, payment, status change, and user decision must be recorded, with no missing or duplicated records. This is a strict requirement.
- **External outcomes depend on evidence**: whether an employer received or processed an application can only be as accurate as the evidence available. The product must never show an external outcome as certain without evidence (Section 20.2).

### 52.2 Recommendation history

Every recommendation must be recorded with: date and time, track, position in the list, match score and explanation, scoring-model version, the archived circular (Section 50), whether the user opened it, and the user's action (applied, saved, dismissed, ignored). The user must be able to search and filter this history like the applications list.

### 52.3 Integrity controls

- A record must be written for each external action before and after the action, so an interrupted action can never disappear from the history.
- The product must regularly reconcile its records: every submission must have an application record, every application record must have a matching archived circular, and counts in reports and dashboards must match the underlying records.
- Any mismatch must be shown to the user and investigated; it must not be hidden or silently corrected.
- Records must be protected against accidental change (Section 28.2) and backed up (Section 15).
- The product must not delete or merge records automatically, except for duplicates the user confirms.

## 53. Administration application

### 53.1 Separate applications

- The product must consist of two separate applications:
  - **User application**: used by job seekers and students, as described in the rest of this document. It must be delivered at launch as both a **web app** and a **mobile app** (Section 53.7).
  - **Admin application**: used only by administrators to view and manage the whole platform.
- The two applications must have separate access points (for example, separate web addresses) and separate sign-in. The admin application must not be reachable from the user application, and a user account must never gain admin access.
- The two applications may look and behave differently. Whether they share underlying services is an implementation decision.
- A person who is both an administrator and a user must use separate accounts for each role.

### 53.2 Administrator roles

- The product must have a **Super Admin** role with full read, write, update, and delete permissions over everything in the admin application.
- The product should allow additional roles with narrower permissions (for example, Support, Operations, Read-only) to be created later. Permissions must be configurable per area and per action (read, create, update, delete).
- Super Admins must be able to create, edit, suspend, and delete admin accounts and assign roles.

### 53.3 Admin dashboard

The admin home dashboard must show, with filters by date range, country, track, and user, and drill-down to individual records:

- **Users**: total, new, active, inactive, paused, suspended, pending deletion, and deleted; users with automatic application enabled; users with incomplete profiles.
- **Recommendations**: number generated per day and per track, average match score, user actions (opened, saved, applied, dismissed), and tracks returning no results.
- **Applications**: totals by submission status and outcome status (Section 20.2), route, track, country, and opportunity type; approve-each versus automatic; approvals waiting; applications blocked and why; failures; outcomes unknown.
- **Automation queue**: scheduled submissions (Section 49), in-progress submissions, retries, and paused items.
- **Sources**: source registry status, last successful check, failures, rate limits, layout changes, and coverage gaps (Section 18).
- **Opportunities**: discovered, active, expired, duplicates, flagged as suspicious, and archived circulars (Section 50).
- **Notifications**: sent, delivered, failed, and fallback use per channel (WhatsApp, push, email).
- **Payments**: fees paid, failed, uncertain, and refunds.
- **Integrity**: reconciliation results and mismatches (Section 52.3).
- **Support and incidents**: open problem reports (Section 44), incidents, and affected users (Section 24.2).
- **Costs and usage**: usage of paid data sources, AI services, messaging, and email, against budgets (Section 15).
- **System health**: service status, error rates, and backup status.

### 53.4 Management areas

The admin application must provide full read, create, update, and delete for:

- **Users**: every user's complete data, including profile, sensitive identity details, documents, videos, photos, signatures, tracks, rules, compensation rules, submission windows, pauses, saved answers, notification settings, connected-account details, portal-account records, sessions and devices, contacts, notes, recommendations, applications, submission records, archived circulars, change history, and audit history. Admins must be able to create users, suspend and reactivate them, reset MFA, sign them out of all devices, pause or resume their automation, export their data, and process account deletion.
- **View as user**: Admins must be able to see any user's screens exactly as the user sees them, in read-only mode.
- **Opportunities and circulars**: view, correct extracted details, merge or split duplicates, mark expired or fraudulent, and manage archived copies.
- **Sources**: add, edit, enable, disable, and remove sources; record terms and limitations; set check frequency; run a manual check.
- **Applications**: view every application and its full record, cancel queued applications, verify uncertain outcomes, and record corrections.
- **Platform rules and defaults**: default tracks, thresholds, result counts, global and maximum caps, deadline buffer, pause limits, recently-deleted and grace periods, retention periods, scoring-model versions and weights, fraud warning signs, supported application routes, and feature switches.
- **Templates and content**: email, cover-letter, and notification templates (including messaging-platform templates), help articles, announcements, and incident messages.
- **Question bank**: platform-wide grouping of questions with the same meaning (Section 28.3).
- **Support**: problem reports, responses, and status.
- **Admins and roles**: Section 53.2.
- **Compliance**: data-export and deletion requests, consent records, and security incidents.
- **Audit logs**: all user, system, and admin actions, searchable and exportable.
- **Reports**: every dashboard figure exportable as PDF and spreadsheet.

### 53.5 Safeguards that still apply to admins

Admins can see and manage all information. The following limits are required by law, security practice, or the user's authorization rules, and are the only exceptions:

- **Secrets**: Passwords, access tokens, and similar secrets must never be shown in readable form to anyone, including admins (Section 13). Admins can see that a secret exists, when it was created and last used, and can revoke, reset, or delete it.
- **External actions as the user**: Admins must not submit applications, send emails, make payments, or accept terms on a user's behalf without that user's authorization (Section 23.1). Admins may always stop, pause, or cancel such actions.
- **Submission records**: Admin corrections are added as separate entries; the original record is not overwritten (Section 28.2).
- **Audit of admin actions**: Every admin view of sensitive data and every admin change must be recorded with the admin, time, and what was accessed or changed. Audit entries may be removed only through the retention policy, not by individual deletion.
- **User visibility**: Changes an admin makes to a user's data or settings must appear in the user's change history as made by an administrator, and the user must be notified of changes that affect applications, rules, or account status.
- **Admin account security**: MFA is mandatory for admins; destructive and bulk actions require re-authentication and confirmation; admin sessions time out after inactivity.
- **Transparency**: The privacy notice must tell users that administrators can access their data and for what purposes.

### 53.6 Platform emergency stop

Super Admins must be able to stop all automatic external actions for all users, a selected group of users, a source, or an application route, for example during an incident or when a source changes its terms. Affected users must be notified, and in-progress actions handled as in Section 27.2.

### 53.7 User web app and mobile app

- The user application must be released at the same time as a web app and a mobile app for Android and iOS. Neither is a later phase.
- Both must provide every user feature in this document, including profile and document management, tracks and rules, approval packages, the applications list and submission records, archived circulars, pause, and account deletion.
- The mobile app must support push notifications, approving and answering blocked questions from notifications (Section 36), uploading documents and photos from the device, and secure sign-in (including device biometrics where available).
- The web app, mobile app, and admin application must use the same backend and data, so any change on one appears on the others without the user doing anything.
- The same account must work on the web and mobile apps at the same time. Session management (Section 41) must cover all devices.
- The mobile app should let the user view recent applications, records, and archived circulars when offline. Actions taken offline must be clearly marked as pending and must not be treated as done until they reach the backend.

## 54. Decisions to confirm before implementation

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
36. May the system create portal accounts automatically, and which email address should be used for them?
37. May generated essay answers, tailored résumés, and supervisor-outreach emails be sent automatically, or must they always be reviewed?
38. What default deadline buffer should automatic applications use?
39. WhatsApp, push, and email are required (Section 36). Should SMS or Telegram also be offered at launch, and which events count as urgent by default?
40. Which student opportunity types (internships, assistantships, exchange programs, summer schools, postdocs) are in scope for the first release?
41. Should screenshots or saved copies of submitted forms be kept as evidence, and for how long, given source terms and privacy?
42. Should follow-up emails to recruiters and professors be allowed automatically, and how many times?
43. How long should an approval stay valid before it expires (Section 37.5), and what should the default email cancel window be?
44. Should bulk approval be available at launch, and which items must always be approved individually?
45. What inactivity period should automatically pause automatic applications, and how often must key profile facts be reconfirmed (Section 41)?
46. What counting rules should be the defaults for years of experience (internships, part-time, overlapping roles) (Section 39)?
47. Should automatic rules ever be allowed to apply when a hard requirement is unknown (Section 38)?
48. What is the minimum user age, and is guardian consent needed for younger students?
49. Which data-protection laws and standards apply at launch (Section 43)?
50. How long should deleted items stay in recently deleted, and how long should the account-deletion grace period be (Section 46)?
51. What maximum result count and application count per track should be allowed (Section 48)?
52. Where a source's terms or law restrict keeping a copy of a circular, what may still be archived (Section 50.3)?
53. Which benefits should be offered as compensation filters at launch, and which exchange-rate source should be used (Section 51)?
54. Should submission windows default to "as soon as ready" or a specific time (Section 49)?
55. Which admin roles besides Super Admin are needed at launch, and who may hold Super Admin access (Section 53.2)?
56. For which purposes may admins view a user's sensitive data, and should users be notified each time an admin views it, or only when an admin changes it (Section 53.5)?
57. Should the admin application be desktop-only, or also usable on mobile-sized screens?
58. By default, should a country exclusion also cover the employer's base country, or only the job location (Section 5.3)?
59. Which minimum Android and iOS versions must the mobile app support (Section 53.7)?

## 55. Document control

| Field | Value |
| --- | --- |
| Document | Job Discovery and Application Assistant – Requirements |
| Version | 1.0 (draft) |
| Owner | To be confirmed |
| Status | Draft – pending review of Section 54 decisions |

### 55.1 Revision history

| Version | Date | Summary of changes |
| --- | --- | --- |
| 1.0 | 2026-10-20 | Version 1 requirements. |

### 55.2 Requirement traceability

Before implementation, each requirement should be given a stable identifier (for example, `REQ-10.8-01`) and a priority (must / should / could), so that design items, test cases, and acceptance evidence in Section 25.3 can be traced back to it.
