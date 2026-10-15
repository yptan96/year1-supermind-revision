# Year 1 English Practice (Unit 0 to Unit 4)

Pupil practice app for Year 1 (KSSR BI, Super Minds 1). Pupils pick unit(s), skill and level, then play a 10-question round.
Login, resume, Student View, Teacher View (TP1-6), leaderboard and CSV follow the `edu-game-login-page` and `edu-game-teacher-tools` skills.

## Folders
- `index.html`, `app.js`, `data.js`: the app. `data.js` is generated, do not edit it by hand.
- `img/`: 107 pictures (transparent PNG), named by word. `audio/en|ms|zh/`: 564 mp3 files, named by word or sentence id.
- `api/`: save, leaderboard, comment, clear-results (Vercel serverless, unchanged from the teacher-tools skill). `package.json`: `@vercel/kv`.
- `tools/build_content.py`: the word list, sentences, Malay and Chinese meanings, DSKP text. Edit this, then run it.
- `tools/gen_audio.py`: makes the audio from `data.js`. Existing files are skipped; delete a file to remake it.
- `dev/server.js`: local test server using the real `api/*.js` with an in-memory database.

## Change a word or meaning
1. Edit `tools/build_content.py`.
2. `python tools/build_content.py`
3. Delete the old mp3 files for that word (`audio/en/<id>.mp3`, `audio/ms/...`, `audio/zh/...`), then `python tools/gen_audio.py`.

## Test on your computer
`node dev/server.js` then open http://localhost:3000 (results are kept in memory and lost when the server stops).

## Skills and games
| Skill button | Game | DSKP |
|---|---|---|
| Listen | Listen and Tap (Star 1: 3 pictures, 2: 4, 3: 6) | 1.1.1, 1.2.2, 1.2.4, 1.2.5 |
| Speak | Listen and Repeat (BM / 中文 meaning audio, "I said it", Next) | 2.1.1, 2.1.4, 2.1.5 |
| Read | Star 1 word to picture, 2 picture to word, 3 sentence to picture | 3.2.1, 3.2.2, 3.3.1 |
| Write | Word Builder (1 guided, 2 with extra letters, 3 listen only) | 4.1.2, 4.3.2 |
| Sentences | Sentence Builder (3 has one extra word, no picture) | 4.2.1, 4.2.2, 4.2.4, 4.3.1 |
| Sounds | First letter, last letter, missing letter | 3.1.1 to 3.1.4 |
| Words | Memory Match (4, 6, 8 pairs) | 3.2.1, 3.3.1 |

## Saved result (standard record, no schema change)
`game` is `<unit>-<skill>-s<level>`, for example `u4-write-s2` or `mix-listen-s1` (`mix` = more than one unit).
`total` is always 10 (Words: number of pairs). `mistakes` lists wrong answers.

## TP
TP is worked out when shown, not stored. Bands: 0-29 TP1, 30-44 TP2, 45-59 TP3, 60-74 TP4, 75-89 TP5, 90-100 TP6.
Basis: each pupil's best attempt per skill, averaged within the DSKP skill (Reading = Read, Sounds, Words; Writing = Write, Sentences).
Speaking has no TP: the game only counts rounds done, the teacher judges. Descriptors are copied from the DSKP Year 1 SJK Performance Standards Guides.

## Leaderboards
My Result shows two boards, both ranked by TOTAL STARS (never by time): Star Champions (all games) and Game boards (one game, optionally one unit). Stars = best result for each unit + game + star level (90%+ = 3 stars, 70%+ = 2, 40%+ = 1), so replaying the same game cannot add more than 3. A switch shows My class only (default) or All classes.

## Storage
One Vercel KV database is shared by several games. This app saves only under its own keys, `y1-supermind-results` and `y1-supermind-comments` (set in `api/_kv.js`), so its Clear All never touches another game's results. Settings names are read with or without the `year1SupermindRevision_` prefix.

## Before real pupils use it
1. `TEACHER_PIN` is set in `app.js`, `api/comment.js` and `api/clear-results.js` (all three the same).
2. Deploy with `edu-game-teacher-tools/references/deployment-checklist.md` (GitHub, Vercel, connect KV, redeploy, check the live commit).
