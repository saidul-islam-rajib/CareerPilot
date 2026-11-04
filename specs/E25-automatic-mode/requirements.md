# E25 Automatic mode — Requirements

**Requirement IDs:** 10.1, 10.8, 23, 27.2, 27.3, 27.4, 38, 39, 41, 47, 49, 52.3

## User stories

- As a job seeker, I want to define automatic rules (scope, filters, materials, limits, schedule) so that the product applies only to opportunities I would accept.
- As a job seeker, I want a dry run of a rule so that I see exactly what would be applied, with which materials, before anything is submitted.
- As a job seeker, I want daily and weekly caps, submission windows, a deadline buffer, a pause and an emergency stop so that automation never surprises me.
- As a job seeker, I want automation to pause by itself when I have been away so that nothing is sent on my behalf while I am not watching.
- As a job seeker, I want to see why an opportunity was not applied to automatically.

## Acceptance criteria

- WHEN no rule exists THE SYSTEM SHALL keep the track-level default: a track in automatic mode applies to matches without a known failed hard requirement, and never to unknown hard requirements (Section 38).
- WHEN at least one rule is enabled THE SYSTEM SHALL apply automatically only to opportunities accepted by an enabled rule that covers the opportunity's track.
- WHEN several rules cover an opportunity THE SYSTEM SHALL apply at most once, a block (excluded employer or keyword) in any covering rule wins, and the first accepting rule by priority governs (Section 38 most restrictive wins).
- WHEN a track is in approve-each mode THE SYSTEM SHALL never apply automatically for that track.
- WHEN a hard requirement is unknown THE SYSTEM SHALL not apply unless the governing rule explicitly allows it.
- WHEN the route is not an automatable route THE SYSTEM SHALL not apply automatically and shall mark the step as user-only (Section 27.3).
- WHEN a dry run is requested THE SYSTEM SHALL return would-apply, deferred and skipped items with reasons, materials (CV, cover letter) and the earliest time, and SHALL NOT create approvals, applications, emails or notifications.
- WHEN the emergency stop, pause or inactivity period is active THE SYSTEM SHALL not queue new automatic applications and SHALL hold queued ones.
- WHEN the daily cap (platform), weekly cap, or a rule cap (daily, weekly, total) is reached THE SYSTEM SHALL hold automatic applications until the next period.
- WHEN the global window or the rule schedule is closed THE SYSTEM SHALL hold automatic applications, except as the deadline setting below says.
- WHEN the next allowed window falls after deadline minus buffer THE SYSTEM SHALL follow the user's setting: notify and ask (default; a pending approval is created or the user is notified), submit at the earliest possible time, or skip and notify (Section 49.2).
- WHEN a queued automatic application's rule is disabled, deleted or expired, or its deadline has passed THE SYSTEM SHALL cancel it with a timeline entry (reconciliation).
- WHEN the outcome of a submission is unknown THE SYSTEM SHALL never resubmit it.
- WHEN an opportunity leaves the pipeline before submission THE SYSTEM SHALL record the stage and reasons.
- User-only steps (Section 27.3) and pre-submission checks (Section 27.4) always apply and cannot be turned off by any rule.
