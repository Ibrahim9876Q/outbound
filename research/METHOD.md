# Dossier method

The dossier separates publisher disclosures from regulator findings. Candidate records name the terms required to support each short paraphrase. The build downloads public URLs with curl, follows HTTPS redirects, uses a browser user agent, and checks the page text after stripping scripts and styles. A response must contain each required term before the source receives `verified: true` and a fetch timestamp. Review the evidence snippets and keep claims narrow. Failed fetches or evidence checks are recorded in [rejected.md](rejected.md).

An empty section means no claim was verified for that section. A null headquarters field or source date means it was omitted for lack of verified metadata. App domains are identity hints. Policy disclosures describe possible collection or transfers and do not identify the destinations of any particular user's traffic. Enforcement summaries distinguish allegations and settlements from findings. No local traffic, user files, or credentials are used as research inputs.

The first three app batches follow the priority Windows and popular-app list. Later batches use the [US App Store charts](https://apps.apple.com/us/iphone/charts/36?chart=top-free), [Apple's prior-year chart](https://apps.apple.com/us/iphone/story/id1847717004), and adjacent widely used products to select additional leads. The chart tool fetches each app's listing separately, matches the app title, and extracts the named provider and categories disclosed under Apple's “Data Linked to You” label. The [Microsoft Store free-app chart](https://apps.microsoft.com/collections/computed/apps/topfree?gl=US&hl=en-US), [Microsoft Store photo and video chart](https://apps.microsoft.com/collections/computed/apps/topfree/photo%20%26%20video?gl=US&hl=en-US), and [Steam most-played chart](https://store.steampowered.com/charts/mostplayed) supply leads checked against their publishers' privacy materials. The records identify general publisher policies when the source covers multiple products.

Extension candidates come from the [Chrome Web Store charts](https://chromewebstore.google.com/top-charts/popular) and individual listings. The build matches each fetched listing's canonical extension ID, developer name, and explicit privacy label. These are publisher declarations. Broad permission flags from a scan measure requested access. Extension records deliberately omit process names and domains unless separately established.

For enforcement research, PDF sources are downloaded with the same curl settings and converted to text with Poppler's `pdftotext.exe` before checking evidence. The FTC catalog tool starts from the [FTC's privacy cases index](https://search.ftc.gov/enforcement/cases-proceedings/terms/1420), then fetches each case page, verifies the title and topic, and checks for a dated case timeline. Topic evidence comes from the case summary or a press release headline in the timeline. The record's year identifies the earliest item shown in the timeline. The file number is recorded where the page exposes it and is used to avoid counting multiple pages for the same matter. Catalog entries summarize the docket topic, which may concern allegations or a procedural development.

This snapshot contains 306 apps, 32 Chromium extensions, and 197 company records. The dossier contains 240 incident records, 60 sharing disclosures, and 61 country transfer disclosures. The index contains 26 executable names, 127 domains, and 32 extension IDs. Detailed FTC orders supersede generic docket summaries for the same party and matter where both were sourced. Some entries have an enforcement source only. The FTC's `search.ftc.gov` host supplied official case pages when its main hostname returned a 404 to curl.

The Canadian cases use the [Privacy Commissioner's published PIPEDA findings](https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-businesses/). The Home Depot e-receipt disclosure to Meta was published as Canadian finding 2023-001 on January 26, 2023. That finding describes offline conversions and lack of meaningful consent.

## Scan-prioritized coverage

An opt-in scan on loopback port 4321 returned 20 tracker companies in `summary.topTrackers`, the endpoint's limit. To cover the requested 28, the remaining eight were ranked from the same scan's site tracker records by counting unique sites per company and sorting ties by company name. This reproduced the published top 20 exactly. Tracker ranks are dataset matches against visited sites, which do not establish that a connection was made. Six installed apps mapped to app entries. Company-only matches were excluded from the app count. Scan data stayed local.

| Group | Targeted | With a dossier entry | All four fields | Collection | Sharing | Destinations | Incidents |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tracker companies | 28 | 28 | 21 | 27 | 28 | 24 | 23 |
| Installed apps matched to the dossier | 6 | 6 | 6 | 6 | 6 | 6 | 6 |

A populated field has at least one curl-verified source. Product-specific statements identify their scope and historical disclosures identify their date. Seven tracker entries still have gaps.

| Tracker | Unverified fields | Evidence reviewed |
| --- | --- | --- |
| Akamai Technologies | Incidents | Verified DataStream disclosures and Spotify's Korea transfer notice. Found no sufficiently sourced privacy incident for this entry. |
| Amplitude | Incidents | Found operational outage reporting, with insufficient evidence for a privacy incident. |
| Blockthrough | Destinations, incidents | Its policy describes overseas providers in general terms. Found no verified processing country or privacy incident. |
| Criteo | Destinations | The Media Grid list gives subprocessors' headquarters. Actual processing countries were unverified. |
| jsDelivr | Destinations | Its policy describes transfers outside the visitor's jurisdiction without naming processing countries. |
| Stripe | Incidents | Curl could not substantiate the Stripe Elements court record. The court PDF timed out, and the mirror did not provide the necessary text. |
| UNPKG | Collection, destinations, incidents | The operator identifies Cloudflare as its CDN. The sources did not establish what UNPKG collects, named processing countries, or a privacy incident. |

Failed leads are documented in [rejected.md](rejected.md).

## Student laptop demo coverage

The demo set covers 25 selected apps. Verified collection, sharing, destinations, and incidents are present for 25, 24, 20, 18 entries respectively. 14 entries have all four fields. These counts describe evidence coverage.

Adobe refers to Acrobat Reader, with service-specific hosting information from Adobe. The NVIDIA entry uses the GeForce NOW Android developer label because curl could not verify the NVIDIA desktop disclosure. Riot collection and processing claims use the company-wide notice and are scoped accordingly.

| App | Fields we could not verify |
| --- | --- |
| Steam | destinations |
| OneDrive | incidents |
| Instagram | destinations |
| WhatsApp | sharing, destinations |
| Telegram | incidents |
| Netflix | destinations |
| Riot Vanguard | incidents |
| NVIDIA GeForce NOW | destinations, incidents |
| Adobe Acrobat Reader | incidents |
| Grammarly | incidents |
| Notion | incidents |

Named countries require explicit processing or transfer evidence. Publisher-wide incidents without a verified link to the app are kept on the company record. Failed or insufficient sources are in [rejected.md](rejected.md).

## Source quality checks

`node research/audit.js --strict` fetches public incident sources with the same curl and PDF pipeline that the dossier build uses. It checks the first dated FTC docket entry when applicable and looks for each recorded year on the other source pages. It also checks the amounts in both structured fields and incident summaries, normalizing equivalent currency formats. The current audit captures dates for 240 incident records and evidence for 32 monetary figures. Run `node research/audit.js --retry-gaps --strict` to retain prior successful checks and retry failed or new ones.

`npm test` verifies the captured evidence offline, flags stated years or amounts that have changed, and checks HTTPS URLs, verification timestamps, and duplicate claim sources and incidents. It compares incident titles, case references, and single-matter source URLs across app and company entries. Distinct matters with reference numbers may share a regulator's register, and different claim fields may cite the same policy. Six redundant incident records were consolidated in the demo audit.
