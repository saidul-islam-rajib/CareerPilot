# E19 Bangladesh profile data — Requirements

**Requirement IDs:** §35.1 (profile data for Bangladesh applications), §8.4 (do not assume age, quota, or citizenship), §19 (profile), §46.1

## User stories

- As a job seeker applying in Bangladesh, I want my official identity, SSC/HSC and degree records, addresses, and any special status stored once, so that government and private forms can be filled exactly as on my certificates.
- As a job seeker, I want a warning when my name, date of birth, or parents' names differ between my records, so that I fix them before an application is rejected.

## Acceptance criteria

- THE SYSTEM SHALL offer these profile sections, defined in `config/defaults/profile.yaml` and shown when the user's home country is Bangladesh or the section already has entries:
  - **Identity for official forms** (at most one entry): name in English and Bangla exactly as on certificates and NID, date of birth, father's and mother's names in English and Bangla, NID or birth registration number, citizenship, home district.
  - **SSC, HSC, and degree records**: examination (SSC, Dakhil, O level, HSC, Alim, A level, diploma, bachelor's honours or pass, master's, MBBS, other), board or university, roll number, registration number, passing year, group or subject, result scale (GPA out of 5, CGPA out of 4, division, class, grade), result, and the name, date of birth, and parents' names printed on the certificate.
  - **Addresses**: present or permanent, address line, division, district, upazila or thana, post office, post code.
  - **Special status** (quota), only if the user adds it: status (child or grandchild of a freedom fighter, person with disability, ethnic minority, Ansar-VDP, orphan, other), supporting document name, notes.
- THE SYSTEM SHALL validate a new `date` field type as `YYYY-MM-DD` within the configured year range on the server and on every client.
- THE SYSTEM SHALL validate select fields against the active values in `config/defaults/enum-values.yaml`, including all 8 divisions and 64 districts.
- WHEN the profile is read THE SYSTEM SHALL list consistency warnings, with the section, entry, and both values, when:
  - the identity English name differs from the profile name or a certificate name;
  - the identity date of birth differs from a certificate date of birth;
  - the identity father's or mother's name differs from a certificate;
  - a phone contact of a Bangladesh user is not a valid `+880` mobile number.
- Names are compared ignoring case, punctuation, and repeated spaces; any other difference is a warning.
- THE SYSTEM SHALL never fill or guess any of these values; empty stays empty.
