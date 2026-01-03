Utilsing Software which uses `yt-dlp` I can use spotDL to scrape Spotify Playlist Metadata to download them quickly and legally through YouTube. The main bottleneck at the moment is without Youtube Premium I am capped at 128kps bitrate. There may be alternatives in the future but as I am not an audiofile I don't mind so much.

To create dynamic directories through the web application we must change the spotDL/config.json to include:

```bash
"output": "/home/<user>/Music/artists/{artist}/{album}",
"file_format": "{title}.{output-ext}",
"web_use_output_dir": true,
```

to run the web client we must install it through pip (`pip install spotdl`)

then run `spotdl web`

This is handy as supposedly this also populate mp3 files with ID3 data. Which I have a function for to extract if present to not constantly using the AcousticID Fingerprint.