#!/usr/bin/env bash
# Convert Playwright .webm captures to constant-30fps H.264 for Remotion.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../remotion/public/clips
for f in ../recordings/clips/*.webm; do
  n=$(basename "$f" .webm)
  ffmpeg -v error -y -i "$f" -vf "fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 14 -an "../remotion/public/clips/$n.mp4"
  echo "transcoded $n"
done
