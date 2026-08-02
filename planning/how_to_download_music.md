Utilsing Software which uses `yt-dlp` I can use spotDL to scrape Spotify Playlist Metadata to download them quickly and legally through YouTube. The main bottleneck at the moment is without Youtube Premium I am capped at 128kps bitrate. There may be alternatives in the future but as I am not an audiofile I don't mind so much.

To create dynamic directories through the web application we must change the spotDL/config.json to include:

```bash
"output": "/home/<user>/Music/artists/{artist}/{album}",
"file_format": "{title}.{output-ext}",
"web_use_output_dir": true,
```

to run the web client we must install it through pip (`pip install spotdl`)

then run `spotdl web`

This is handy as supposedly this also populate mp3 files wACith ID3 data. Which I have a function for to extract if present to not constantly using the AcousticID Fingerprint.

---

As of 05/-1/2026 Sptofy has Messed up Developer tools so using Sptofy won't work.
---

I have resulted in using a GUI wrapper for yt-dlp: https://github.com/dsymbol/yt-dlp-gui

I must go to my dir where it lives to spin this up: Documents/code/other_projects/yt-dlp-gui && python app.py