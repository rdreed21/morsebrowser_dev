# wordfiles/

Practice-text word lists and random-generation configs for lessons.

- `.txt` files — one word/phrase per line, played as-is.
- `.json` files — random word generation configs:
  `{ "letters": "rea", "minWordSize": 3, "maxWordSize": 3, "practiceSeconds": 120 }`

A lesson is only selectable in the UI if it has an entry in
`src/wordfilesconfigs/wordlists.json` mapping
class / letter group / display name → `fileName` here.

## Uncatalogued files (intentional)

Roughly 76 files in this directory have **no** catalog entry and are kept
deliberately as experiments / future curriculum rather than deleted:

- `ICR*` — instant character recognition drills (ICR15–ICR25 ranges)
- `POL_*` — suffix/prefix ("Polish") training experiments
- `BC3_Fam_Contest1/2.txt` — contest-exchange familiarity lists
- `B2.json`, `Com_test.json`, numbered `IB*/SB*` variants — older drafts

To make one live, add a `wordlists.json` entry for it. The React port
(`morsebrowser-react`) mirrors this data — after changing the catalog or
presets here, run `node packages/core/scripts/sync-lesson-data.mjs` over
there to propagate.
