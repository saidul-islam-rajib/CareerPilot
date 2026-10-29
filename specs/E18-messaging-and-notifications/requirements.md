# E18 Messaging, in-app notifications, and submitted-job tracking — Requirements

**Requirement IDs:** REQ-11.3, REQ-20.2, REQ-27.3, REQ-36, REQ-36.1, REQ-53.4, REQ-53.5

## User stories

- As a job seeker, I want to tell CareerPilot that I finished an application on the employer's site, so that it moves to Submitted and I can track it.
- As a job seeker, I want an in-app notification when one of my applications is submitted, so that I can open it and see exactly what was sent.
- As a member, I want to find other members by name, email, or phone and chat with them like on WhatsApp (text, photos, voice notes, PDFs), without either of us seeing the other's phone number or email.
- As a member, I want an in-app notification when someone messages me, and I want to block someone who bothers me and stop others from finding me.
- As an administrator, I want to message any member directly and get their replies.
- As an administrator, I want to see everything about a member, including their profile, contacts, and uploaded CVs and documents.
- As an administrator, I want to see who each member is connected with, like a friends list, and open a conversation when I need to, with that access recorded.

## Acceptance criteria

- WHEN an application needs the user to finish on the employer's site (Manual action required) and the user confirms they submitted it THE SYSTEM SHALL set it to Submitted – awaiting confirmation, record the user as the actor in the timeline, set the applied date, and never claim confirmation evidence it does not have.
- WHEN an application reaches Submitted – awaiting confirmation or Confirmed THE SYSTEM SHALL create one in-app notification for the user (no email) linking to the application, whose page shows what was submitted: route and destination, CV and documents, cover letter, answers, sent email, and the timeline.
- WHEN a member searches the directory THE SYSTEM SHALL match names by text and emails or phone numbers only exactly, return only name, photo, and headline, and leave out members who turned off "Let members find me", members who blocked the searcher, and the searcher.
- WHEN a member sends a message THE SYSTEM SHALL accept text, an image, a voice note, or a PDF within the configured limits, store attachments in private storage served by signed links, and create an in-app notification for every other member of the conversation unless they muted it.
- WHEN a member opens a conversation THE SYSTEM SHALL mark it read for them and show the sender each message as sent, delivered (the recipient's app received it), or read.
- WHEN a member blocks another THE SYSTEM SHALL stop messages between them in both directions and hide each from the other's search.
- WHEN an administrator messages a member THE SYSTEM SHALL deliver it in a support conversation shown as the CareerPilot team, and the member SHALL be able to reply in it.
- WHEN an administrator opens a member's connections THE SYSTEM SHALL list the members they talk with, with when they connected, message counts, and last activity; opening a member-to-member conversation SHALL be recorded in the audit log with the administrator and time.
- WHEN an administrator opens a member's record THE SYSTEM SHALL show the full profile, every contact (unmasked, recorded in the audit log), and every uploaded document with a way to open it.
- THE SYSTEM SHALL never send these notifications by email; phones show them inside the app. Push notifications while the app is closed need Firebase (Android) and Apple push credentials (`- [!]` until the owner provides them).
