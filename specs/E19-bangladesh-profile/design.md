# E19 Bangladesh profile data — Design

## Data

- No new tables: entries live in the workspace profile `sections` like every config-driven section.
- `ProfileFieldType.DATE` (`YYYY-MM-DD`).
- Section config gains `countries` (shown when the home country matches or entries exist) and `max_entries`.
- Select options come from active `enum_values` rows (one source for server and clients); `SELECT_OPTIONS` is removed.
- New enum keys: `bd_exam`, `result_scale`, `address_kind`, `special_status`, `citizenship` (types, so also Python `StrEnum` and TypeScript enums), `bd_division`, `bd_district` (reference data, config only, TypeScript id lists for the in-memory catalog).
- `profile.consistency` config: comparisons `{kind, source: section.field, targets: [profile.full_name | section.field]}` and `mobile_patterns` by country.

## API

- `GET /v1/profile` adds `homeCountry` and `consistency: [{kind, section, entryId, field, expected, found}]`.
- Adding an entry beyond `max_entries` returns `validation` with detail `<section>`.

## UI

- Web and mobile filter sections by `countries` and hide **Add** once `maxEntries` is reached.
- Date fields: web `<input type="date">`; mobile text with a `YYYY-MM-DD` hint.
- Mobile selects with more options than `ui.segmented_max_options` open a searchable list (`SelectField`).
- A "Check these details" card lists consistency warnings at the top of the profile; each opens the entry.

## Edge cases

- Comparisons skip empty values on either side.
- A warning never blocks saving.
