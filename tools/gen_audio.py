# -*- coding: utf-8 -*-
"""Makes the mp3 files in audio/en, audio/ms, audio/zh from data.js using Microsoft Edge neural voices (edge-tts).
Run:  python tools/gen_audio.py        (needs: pip install edge-tts, and internet)
Existing files are skipped, so you can re-run safely. Delete a file to make it again.
"""
import asyncio, json, os, sys
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICES = {'en': ('en-GB-LibbyNeural', '-12%'), 'ms': ('ms-MY-YasminNeural', '-5%'), 'zh': ('zh-CN-XiaoxiaoNeural', '-5%')}

raw = open(os.path.join(ROOT, 'data.js'), encoding='utf-8').read()
C = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])

jobs = []
for u in C['units']:
    for it in u['items']:
        act = it['kind'] == 'action'
        jobs.append(('en', it['id'], it['cmd'] if act else it['en']))
        jobs.append(('ms', it['id'], it['cmdBm'] if act else it['bm']))
        jobs.append(('zh', it['id'], it['cmdZh'] if act else it['zh']))
    for s in u['sentences']:
        jobs.append(('en', s['id'], s['en']))
        jobs.append(('ms', s['id'], s['bm']))
        jobs.append(('zh', s['id'], s['zh']))

sem = asyncio.Semaphore(6)
fails = []

async def one(lang, id_, text):
    out = os.path.join(ROOT, 'audio', lang, id_ + '.mp3')
    if os.path.exists(out) and os.path.getsize(out) > 1000:
        return
    os.makedirs(os.path.dirname(out), exist_ok=True)
    voice, rate = VOICES[lang]
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, voice, rate=rate).save(out)
                return
            except Exception as e:
                await asyncio.sleep(1.5 * (attempt + 1))
        fails.append((lang, id_, text))

async def main():
    await asyncio.gather(*[one(*j) for j in jobs])
    print('jobs', len(jobs), 'failed', len(fails))
    for f in fails:
        print('FAILED', f)

asyncio.run(main())
