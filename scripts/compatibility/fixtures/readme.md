# Compatibility media fixtures

`audio.mp3` contains 0.1 seconds of silence. `video.mp4` contains a 0.1-second
black frame, encoded as baseline H.264. They exercise media transport and Anki's
playback path with valid files instead of plain text renamed as media.

Generated locally with FFmpeg 9.0.2, without external source media:

```sh
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 0.1 -c:a libmp3lame -b:a 32k -map_metadata -1 audio.mp3
ffmpeg -f lavfi -i color=c=black:s=16x16:r=10 -t 0.1 -c:v libx264 -profile:v baseline -pix_fmt yuv420p -map_metadata -1 -movflags +faststart video.mp4
```

The workflow verifies both files with `mpv` before starting Anki. Each disposable
Anki base folder receives `mpv.conf`, which selects null audio and video outputs.
Media decoding still runs; the survey does not assess audible output or video
presentation and does not need physical audio hardware or a separate video window.
