# E19 Bangladesh profile data — Test plan

Unit tests only (Planning/14-Testing-and-Quality.md).

- Python: date parsing and bounds; select values from enum values (district accepted, unknown refused); `max_entries`; each consistency kind, the ignore-case-and-punctuation rule, skipped empty values, phone rule only for Bangladesh users; profile API returns `homeCountry` and `consistency`.
- TypeScript: dynamic-forms date validation; enum catalog equals config; web and mobile show Bangladesh sections, hide Add after one identity entry, show the consistency card; mobile searchable select picks a district.
