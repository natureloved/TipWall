#!/usr/bin/env bash
set -euo pipefail
FF=$(node -p "require('ffmpeg-static')")
F=marketing/teaser/frames
O=marketing/teaser
ENC="-c:v libx264 -crf 19 -preset veryfast -pix_fmt yuv420p -r 30"

# shot 1 — hook: animated brand gradient + headline layer (3.0s)
"$FF" -y -v error -f lavfi -i "gradients=s=1080x1920:d=3:r=30:c0=0x171614:c1=0x202631:c2=0x7a3a12:c3=0x1d3a44:speed=0.03" \
  -loop 1 -t 3 -i "$F/layer-hook.png" \
  -filter_complex "[0:v]fps=30[bg];[1:v]scale=1080:1920[ly];[bg][ly]overlay=0:0,format=yuv420p" \
  -t 3 $ENC "$O/shot1.mp4"

# shot 2 — wall Ken Burns + caption (3.5s)
"$FF" -y -v error -loop 1 -t 3.5 -i "$F/wall.png" -loop 1 -t 3.5 -i "$F/layer-capwall.png" \
  -filter_complex "[0:v]scale=1160:-2,crop=1080:1920:x=(in_w-1080)/2:y=(in_h-1920)*min(t/7\,1),fps=30[bg];[1:v]scale=1080:1920[ly];[bg][ly]overlay=0:0,format=yuv420p" \
  -t 3.5 $ENC "$O/shot2.mp4"

# shot 3 — overlay mock on dark teal gradient (3.5s)
"$FF" -y -v error -f lavfi -i "gradients=s=1080x1920:d=3.5:r=30:c0=0x101418:c1=0x1d3a44:c2=0x171614:c3=0x2d697c:speed=0.03" \
  -loop 1 -t 3.5 -i "$F/layer-overlaymock.png" \
  -filter_complex "[0:v]fps=30[bg];[1:v]scale=1080:1920[ly];[bg][ly]overlay=0:0,format=yuv420p" \
  -t 3.5 $ENC "$O/shot3.mp4"

# shot 4 — explore Ken Burns + caption (3.0s)
"$FF" -y -v error -loop 1 -t 3 -i "$F/explore.png" -loop 1 -t 3 -i "$F/layer-capexplore.png" \
  -filter_complex "[0:v]scale=1160:-2,crop=1080:1920:x=(in_w-1080)/2:y=(in_h-1920)*min(t/6\,1),fps=30[bg];[1:v]scale=1080:1920[ly];[bg][ly]overlay=0:0,format=yuv420p" \
  -t 3 $ENC "$O/shot4.mp4"

# shot 5 — CTA on paper (3.0s)
"$FF" -y -v error -f lavfi -i "color=c=0xF2EDE3:s=1080x1920:d=3:r=30" \
  -loop 1 -t 3 -i "$F/layer-cta.png" \
  -filter_complex "[0:v]fps=30[bg];[1:v]scale=1080:1920[ly];[bg][ly]overlay=0:0,format=yuv420p" \
  -t 3 $ENC "$O/shot5.mp4"

# music bed — soft G-major pad, 14.4s
"$FF" -y -v error \
  -f lavfi -i "sine=frequency=196:d=14.4" -f lavfi -i "sine=frequency=246.94:d=14.4" \
  -f lavfi -i "sine=frequency=293.66:d=14.4" -f lavfi -i "sine=frequency=392:d=14.4" \
  -filter_complex "[0]volume=0.14[a];[1]volume=0.10[b];[2]volume=0.10[c];[3]volume=0.07[d];[a][b][c][d]amix=inputs=4:normalize=0,tremolo=f=0.5:d=0.35,lowpass=f=1400,afade=t=in:d=1.2,afade=t=out:st=13.2:d=1.2" \
  -ac 2 -ar 44100 "$O/music.wav"

# final — crossfade chain + music
"$FF" -y -v error -i "$O/shot1.mp4" -i "$O/shot2.mp4" -i "$O/shot3.mp4" -i "$O/shot4.mp4" -i "$O/shot5.mp4" -i "$O/music.wav" \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.4:offset=2.6[x1];[x1][2:v]xfade=transition=fade:duration=0.4:offset=5.7[x2];[x2][3:v]xfade=transition=fade:duration=0.4:offset=8.8[x3];[x3][4:v]xfade=transition=fade:duration=0.4:offset=11.4[v]" \
  -map "[v]" -map 5:a -c:v libx264 -crf 19 -preset medium -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -movflags +faststart -shortest \
  "$O/tipwall-teaser-9x16.mp4"

echo "BUILT"
"$FF" -hide_banner -i "$O/tipwall-teaser-9x16.mp4" 2>&1 | grep -E "Duration|Stream"
