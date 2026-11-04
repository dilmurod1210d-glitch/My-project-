import asyncio, ssl, json, sys, os
import edge_tts, edge_tts.communicate as c
c._SSL_CTX = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
LINES = json.load(open("script.json"))["lines"]
async def main():
    for i, l in enumerate(LINES):
        out = f"audio/line{i:02d}.mp3"
        voice = "uz-UZ-MadinaNeural" if l["who"] == "M" else "uz-UZ-SardorNeural"
        com = edge_tts.Communicate(l["text"], voice, rate=l.get("rate", "+12%"), proxy=os.environ.get("HTTPS_PROXY"))
        await com.save(out)
        print(out)
asyncio.run(main())
