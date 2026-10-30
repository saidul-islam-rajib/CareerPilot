# E21 Mail and calendar sync (Google) — Requirements

**Requirement IDs:** REQ-11.4, REQ-20.2, REQ-34.1, REQ-34.2, REQ-34.4, REQ-38, REQ-53.5

## User stories

- As a job seeker, I want to connect my Google account so that CareerPilot can read replies to my applications and keep my interviews on my calendar.
- As a job seeker, I want each employer reply to show up on the application timeline, with a link to the original email, so that I do not have to search my inbox.
- As a job seeker, I want a notification when an employer invites me to an interview or an assessment, replies, or seems to reject or offer, so that I can act in time.
- As a job seeker, I want to disconnect Google at any time and have CareerPilot stop reading my mail.
- As an administrator, I want to see whether a member has connected an account and when it last synced, without ever seeing tokens.

## Acceptance criteria

- WHEN a signed-in user asks to connect Google THE SYSTEM SHALL return a Google sign-in address that uses the authorization-code flow with PKCE and a signed state that expires after the configured minutes, asking only for the configured scopes (identity, `gmail.readonly`, `calendar.events`).
- WHEN Google redirects back with a valid state and code THE SYSTEM SHALL exchange the code, store the account email and granted scopes, keep the tokens encrypted, and send the browser to the web app's connected-accounts page with a success flag; WHEN the state is invalid or expired, the user denied access, or the exchange fails THE SYSTEM SHALL store nothing and send the browser there with an error flag naming the reason, never revealing tokens.
- THE SYSTEM SHALL store access and refresh tokens encrypted at rest and SHALL NOT return them from any user API, admin API, log, or error response.
- WHEN a user opens the connected-accounts status THE SYSTEM SHALL show connected or not, the account email, granted scopes, time of the last sync, and the last error as a catalog message.
- WHEN a user disconnects THE SYSTEM SHALL revoke the grant at Google (a failed revoke does not block), soft delete the connection with its tokens, and stop syncing.
- WHEN a sync runs for a connected user THE SYSTEM SHALL read only recent messages that match one of the user's applications by an employer address or domain taken from submission records and opportunity contacts, or by the organization name together with an application keyword, and SHALL NOT send, label, move, or delete any mail.
- WHEN a message is matched to exactly one application THE SYSTEM SHALL classify it as interview invite, assessment, rejection, offer, or other reply, record it once (never twice for the same message) on the application timeline with the employer as actor and a link to the source message, and notify the user.
- WHEN a matched message is an interview invite, assessment, or other reply with enough confidence THE SYSTEM SHALL move the outcome status forward (under review, assessment, interview) and, for an application that was awaiting confirmation, treat the reply as confirmation evidence; it SHALL NOT move an outcome backward or change an outcome that is final or was set further along by the user.
- WHEN a matched message looks like a rejection or an offer THE SYSTEM SHALL only suggest it (timeline entry and notification asking the user to confirm), never set the outcome itself, and SHALL NOT infer anything from silence (REQ-20.2).
- WHEN a message matches more than one application equally well, or none, THE SYSTEM SHALL skip it.
- WHEN an interview task has a date and time and the user has connected Google with calendar access THE SYSTEM SHALL create one Google Calendar event for it (time zone included), update the same event when the task changes, and cancel it when the task is dismissed; the event id is stored so a second event is never created.
- WHEN a detected interview invite contains a clear date and time THE SYSTEM SHALL create an interview task from it so the calendar picks it up; otherwise it creates the task without a date for the user to complete.
- WHEN Google reports that access was revoked or the refresh token expired THE SYSTEM SHALL mark the connection as needing reconnection, notify the user once, and stop syncing until reconnected.
- WHEN an administrator opens a member's record THE SYSTEM SHALL list the member's connected accounts with provider, email, status, and last sync, and nothing secret.
