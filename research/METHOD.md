# Dossier method

The dossier separates publisher disclosures from regulator findings. Candidate records name the terms required to support each short paraphrase. The build downloads public URLs with curl, follows HTTPS redirects, uses a browser user agent, and checks the page text after stripping scripts and styles. A response must contain each required term before the source receives `verified: true` and a fetch timestamp. Review the evidence snippets and keep claims narrow. Failed fetches or evidence checks are recorded in [rejected.md](rejected.md).

An empty section means no claim was verified for that section. A null headquarters field or source date means it was omitted for lack of verified metadata. App domains are identity hints. Policy disclosures describe possible collection or transfers and do not identify the destinations of any particular user's traffic. Enforcement summaries distinguish allegations and settlements from findings. No local traffic, user files, or credentials are used as research inputs.

The first three app batches follow the priority Windows and popular-app list. Later batches use the [US App Store charts](https://apps.apple.com/us/iphone/charts/36?chart=top-free), [Apple's prior-year chart](https://apps.apple.com/us/iphone/story/id1847717004), and adjacent widely used products to select additional leads. The chart tool fetches each app's listing separately, matches the app title, and extracts the named provider and categories disclosed under Apple's “Data Linked to You” label. These are developer disclosures. The chart records omit process names and domains when the listing does not establish them.

For enforcement research, PDF sources are downloaded with the same curl settings and converted to text with Poppler's `pdftotext.exe` before checking evidence. The FTC catalog tool starts from the [FTC's privacy cases index](https://search.ftc.gov/enforcement/cases-proceedings/terms/1420), then fetches each case page, verifies the title and topic, and checks for a dated case timeline. Topic evidence comes from the case summary or a press release headline in the timeline. The record's year identifies the earliest item shown in the timeline. The file number is recorded where the page exposes it and is used to avoid counting multiple pages for the same matter. Catalog entries summarize the docket topic, which may concern allegations or a procedural development.

This snapshot contains 222 apps, including 87 additional chart apps, and 136 company records. The dossier contains 162 incident records, 36 sharing disclosures, and 39 country transfer disclosures. The index contains 26 executable names and 123 domains. Some entries have an enforcement source only. The FTC's `search.ftc.gov` host supplied official case pages when its main hostname returned a 404 to curl.

## Scan-prioritized coverage

An opt-in scan on loopback port 4321 returned 20 tracker companies in `summary.topTrackers`, the endpoint's limit. To cover the requested 28, the remaining eight were ranked from the same scan's site tracker records by counting unique sites per company and sorting ties by company name. This reproduced the published top 20 exactly. Tracker ranks are dataset matches against visited sites, which do not establish that a connection was made. Six installed apps mapped to app entries. Company-only matches were excluded from the app count. Scan data stayed local.

| Group | Targeted | With a dossier entry | All four fields | Collection | Sharing | Destinations | Incidents |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tracker companies | 28 | 26 | 12 | 24 | 24 | 17 | 17 |
| Installed apps matched to the dossier | 6 | 6 | 6 | 6 | 6 | 6 | 6 |

A populated field has at least one curl-verified source. Product-specific statements identify their scope and historical disclosures identify their date. Gaps remain where a source failed to load, could not substantiate the claim, or lacked incident coverage. Akamai's candidate notices returned HTTP 403 to curl, and UNPKG's public material did not substantiate a privacy claim. Failed leads are documented in [rejected.md](rejected.md).
