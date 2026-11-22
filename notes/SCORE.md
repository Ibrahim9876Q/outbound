# Outbound exposure score

The score is a heuristic for comparing observed exposure. It estimates neither harm nor the probability of an incident.

| Factor | Weight | Raw observations for full weight |
| --- | ---: | ---: |
| Tracker companies in recent destination records | 30 | 8 |
| Estimated endpoint countries in recent records | 10 | 8 |
| Newly observed background sockets today | 15 | 30 |
| Sensitive capabilities with registry use recorded | 15 | 4 |
| Distinct flagged extension IDs across the browser's scanned profiles | 10 | 8 |
| Matching startup, scheduled task or service entries | 10 | 5 |
| Distinct verified incidents in the app and its publisher's dossier | 10 | 4 |

Each known factor earns its weight multiplied by the smaller of one and raw count divided by its threshold. The app score is the rounded percentage of covered weight earned. Coverage is the sum of weights with observed input, out of 100. Missing inputs remain null and reduce coverage. A known zero means zero findings in the available records. It does not imply complete coverage outside those records. When coverage is zero, the score is null. The overall score applies the same formula to the mean observed raw count for each factor across apps.

Browser and Windows inventory factors require an opt-in scan. Score factors based on endpoint attribution and scan permissions use the local observations described in the dossier and scan documentation.
