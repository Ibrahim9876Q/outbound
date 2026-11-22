# Builds render4.py from render3.py, applying the wording fixes from research/PROMO-SOURCES.md.
src = open('render3.py', encoding='utf-8').read()

R = [
    # card headings
    ("'[ WHAT THEY COLLECT ]  ' + c['label']", "'[ DATA THAT MAY BE COLLECTED ]  ' + c['label']"),
    ("\"[ USED TO TRACK YOU ACROSS OTHER COMPANIES' APPS AND SITES ]\"",
     "\"[ DATA THAT MAY BE USED TO TRACK YOU ACROSS OTHER COMPANIES' APPS AND SITES ]\""),
    ("'[ WHAT THEY WERE CAUGHT FOR ]'", "'[ ENFORCEMENT, SETTLEMENTS AND FINDINGS ]'"),
    # card items
    ("'Phone numbers given for two-factor security were also used for advertising, the FTC said'",
     "'Privacy penalty; the FTC also alleged phone numbers given for two-factor security were used for ads'"),
    ("'Collected iOS users\\' contacts \"from their address books without notice or consent\"'",
     "'FTC alleged it collected iOS users\\' contacts \"from their address books without notice or consent\"'"),
    ("'\"Transmitted geolocation information\" from its Android app; disappearing-message promises were false'",
     "'FTC alleged misleading disappearing-message promises; its Android app \"transmitted geolocation information\"'"),
    # uses
    ("'WHAT YOU DO IN OTHER APPS PERSONALIZES THEIR ADS'", "'ACTIVITY SHARED BY OTHER APPS AND SITES CAN HELP PERSONALIZE ADS'"),
    ("('we may also show you personalized ads based on your interests, activity'",
     "('Depending on your settings, we may also show you personalized ads based on your interests, activity'"),
    ("('displaying advertisements between users\\u2019 Gmail emails without their consent',\n         'CNIL, €325 million fine against Google, Sep 3 2025 (translated from French)')",
     "('~Ads were inserted between emails in Gmail users\\u2019 inboxes without their consent (paraphrase)',\n         'CNIL, €325 million fine against Google, Sep 3 2025')"),
    ("'WHAT YOU WATCH FEEDS THE ALGORITHM THAT PICKS WHAT YOU SEE NEXT'",
     "'WHAT YOU WATCH AND HOW YOU ENGAGE CAN INFLUENCE RECOMMENDATIONS'"),
    ("'PURCHASES, LOCATION, CONTACTS, BROWSING HISTORY: LINKED TO YOU'",
     "'LOCATION, CONTACTS, BROWSING HISTORY: DATA THAT MAY BE LINKED TO YOU'"),
    ("('Health & Fitness · Financial Info · Location · Contacts · Browsing History · Sensitive Info',\n         'Instagram, Apple App Store privacy label, \"Data Linked to You\", Nov 2026')",
     "('~Health & Fitness · Financial Info · Location · Contacts · Browsing History · Sensitive Info',\n         'Categories Instagram\\u2019s developer declares under \"Data Linked to You\" on its App Store label (viewed Nov 2026)')"),
    ("('GPS and other sensor data from your device · Wi-Fi access points, cell towers, and Bluetooth',\n         'Google Privacy Policy, location sources, effective Oct 16 2026')",
     "('~Location can come from GPS and other sensors, and from nearby Wi-Fi access points, cell towers and Bluetooth-enabled devices (paraphrase)',\n         'Google Privacy Policy, location sources, effective Oct 16 2026')"),
    ("'AND THE APPS SHARE IT WITH EACH OTHER'", "'SOME SERVICES DISCLOSE DATA TO PARTNERS OR ALLOW ACCESS ABROAD'"),
    ("'Quotes are verbatim from the linked publications, shortened with no change in meaning.'",
     "'Quoted text is excerpted from the linked publications. Unquoted lines are paraphrases or listed categories.'"),
    # stats
    ("'SITES WE VISITED HAD TRACKERS WATCHING'", "'VISITED DOMAINS MATCHED A PUBLIC TRACKER DATASET'"),
    ("'TRACKER COMPANIES SAW ONE LAPTOP BROWSE'", "'TRACKER COMPANIES LISTED FOR THOSE MATCHED SITES'"),
    ("'TRACKER COOKIE DOMAINS SITTING ON THE PC'", "'COOKIE DOMAINS ON THE PC FLAGGED AS TRACKER-RELATED'"),
    # features
    ("'SEE WHICH COUNTRY YOUR DATA LANDS IN'", "'SEE ESTIMATED COUNTRIES FOR OBSERVED ENDPOINTS'"),
    ("'EVERY APP. EVERY COMPANY IT TALKS TO. LIVE.'", "'APP CONNECTIONS AND ATTRIBUTED COMPANIES, LIVE'"),
    ("'330+ APPS · 240+ VERIFIED FINES, CASES & INVESTIGATIONS'", "'330+ APP ENTRIES · 240 DOCUMENTED INCIDENTS'"),
    ("'Real Outbound Dossier screens: 334 apps, 244 incidents, 575 sources, each fetched and verified.'",
     "'Real Outbound Dossier screens. Current dossier: 338 app and extension entries, 240 incidents, 587 source URLs.'"),
    ("'Auth0 FGA records who approved which rule, and only then", "'Auth0 FGA records the approval against that rule\\'s ID, and only then"),
    # paraphrase support: a leading ~ means no quotation marks
    ("        d.text((x - 4, y + 26), '\\u201c', font=bahn(80), fill=fade(GREY, b))\n        yy = para(d, x + 30, y + 48, q + '\\u201d', semi(38), colw - 50, fade(WHITE, b), 42)",
     "        if q.startswith('~'):\n            yy = para(d, x + 30, y + 48, q[1:], semi(34), colw - 50, fade(WHITE, b), 38)\n        else:\n            d.text((x - 4, y + 26), '\\u201c', font=bahn(80), fill=fade(GREY, b))\n            yy = para(d, x + 30, y + 48, q + '\\u201d', semi(38), colw - 50, fade(WHITE, b), 42)"),
    ("render(float(s)).save(f'v3_{s}.png')", "render(float(s)).save(f'v4_{s}.png')"),
    ("'outbound-promo-v3.mp4']", "'outbound-promo-v4.mp4']"),
]
for a, b in R:
    n = src.count(a)
    assert n == 1, (n, a[:80])
    src = src.replace(a, b)
open('render4.py', 'w', encoding='utf-8').write(src)
print('ok', len(R))
