# E15 Add a job by link — Design

- `discovery/job_links.py` `JobLinkReader(fetch_page).read(url) -> RawListing | None` (guarded page fetcher; `HtmlConnector.from_posting` for JSON-LD; else `page_heading` + `PageScan.body_text()`).
- `DiscoveryService.listing_for(source_id, raw)` returns the listing at that address or saves a new one (screened, archived).
- Source id `link:{user_id}` (`administration/sources.py`); `listing_visibility` shows such listings only to that user; the source shows as "Added by you from a link".
- `RecommendationService.place(user_id, listing)` scores eligible tracks, places in the best, publishes the opportunity, decision `saved` (so automatic mode leaves it to the user).
- `JobLinkService` (`candidate/services/job_links.py`); `POST /v1/opportunities/by-link {url}` → personalized `OpportunityDetail`.
- Apps: Today (web) "Add a job by link" dialog; Home (mobile) button → `opportunity/add` screen; both open the job after adding (`useAddJobByLink`).
