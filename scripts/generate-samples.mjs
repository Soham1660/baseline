import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const outDir = path.resolve('public/samples');
fs.mkdirSync(outDir, { recursive: true });

// Generate a 3840x720 panoramic interior apartment scene as raw PPM, then pan across it at 1280x720 for 16s.
const W = 3840;
const H = 720;

function createPanoramaBuffer(variant) {
  const buf = Buffer.alloc(W * H * 3);

  function setPixel(x, y, r, g, b) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const idx = (y * W + x) * 3;
    buf[idx] = Math.max(0, Math.min(255, r | 0));
    buf[idx + 1] = Math.max(0, Math.min(255, g | 0));
    buf[idx + 2] = Math.max(0, Math.min(255, b | 0));
  }

  function fillRect(x0, y0, w, h, r, g, b) {
    const xEnd = Math.min(W, x0 + w);
    const yEnd = Math.min(H, y0 + h);
    for (let y = Math.max(0, y0); y < yEnd; y++) {
      for (let x = Math.max(0, x0); x < xEnd; x++) {
        const idx = (y * W + x) * 3;
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
      }
    }
  }

  function drawLine(x0, y0, x1, y1, r, g, b, thickness = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.round(x0 + (x1 - x0) * t);
      const cy = Math.round(y0 + (y1 - y0) * t);
      for (let dy = -thickness; dy <= thickness; dy++) {
        for (let dx = -thickness; dx <= thickness; dx++) {
          setPixel(cx + dx, cy + dy, r, g, b);
        }
      }
    }
  }

  // Base ceiling & walls across 4 rooms:
  // 0..960: Living Room (warm alabaster plaster + oak floor)
  // 960..1920: Bedroom West Wall (soft warm gray plaster + window + oak floor)
  // 1920..2880: Kitchen (sage-tinted cabinetry + laminate counter + tile backsplash)
  // 2880..3840: Bathroom (ceramic tile + vanity + tub rim)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 3;
      const room = Math.floor(x / 960);
      const grain = ((x * 13 + y * 7) % 5) - 2;
      if (y < 520) {
        // Wall lighting gradient
        const shade = Math.round((y / 520) * 14);
        if (room === 0) {
          buf[idx] = 236 - shade + grain;
          buf[idx + 1] = 232 - shade + grain;
          buf[idx + 2] = 223 - shade + grain;
        } else if (room === 1) {
          buf[idx] = 229 - shade + grain;
          buf[idx + 1] = 228 - shade + grain;
          buf[idx + 2] = 224 - shade + grain;
        } else if (room === 2) {
          buf[idx] = 234 - shade + grain;
          buf[idx + 1] = 235 - shade + grain;
          buf[idx + 2] = 230 - shade + grain;
        } else {
          buf[idx] = 232 - shade + grain;
          buf[idx + 1] = 236 - shade + grain;
          buf[idx + 2] = 237 - shade + grain;
        }
      } else {
        // Floor
        if (room < 2) {
          // Oak planks
          const plank = Math.floor((y - 520) / 28);
          const seam = (y - 520) % 28 === 0 || (x + plank * 170) % 260 === 0;
          const woodTone = ((plank * 19) % 14) - 7;
          buf[idx] = seam ? 128 : 176 + woodTone + grain;
          buf[idx + 1] = seam ? 102 : 145 + woodTone + grain;
          buf[idx + 2] = seam ? 75 : 108 + woodTone + grain;
        } else {
          // Tile floor
          const seam = (y - 520) % 48 === 0 || x % 64 === 0;
          buf[idx] = seam ? 165 : 214 + grain;
          buf[idx + 1] = seam ? 163 : 212 + grain;
          buf[idx + 2] = seam ? 158 : 206 + grain;
        }
      }
    }
  }

  // Room vertical corner dividers
  for (const rx of [960, 1920, 2880]) {
    fillRect(rx - 4, 0, 8, 520, 196, 193, 186);
  }

  // Baseboards across all rooms
  fillRect(0, 480, W, 40, 245, 244, 240);
  fillRect(0, 480, W, 3, 210, 208, 200);
  fillRect(0, 518, W, 2, 175, 172, 165);

  // --- ROOM 1: Living Room (0..960) ---
  // Framed architectural art + sunlight patch on floor
  fillRect(220, 130, 180, 230, 218, 214, 205);
  fillRect(232, 142, 156, 206, 246, 244, 238);
  fillRect(262, 180, 96, 130, 188, 178, 162);
  // Subtle surface scuff on oak floor near baseboard (x=540, y=545) — PRE-EXISTING in both
  drawLine(510, 548, 575, 558, 108, 86, 65, 2);
  drawLine(522, 554, 560, 562, 118, 96, 74, 1);

  if (variant === 'move-out') {
    // Dim shadow near far right corner of living room (poor lighting / ambiguous area)
    for (let y = 420; y < 640; y++) {
      for (let x = 780; x < 950; x++) {
        const idx = (y * W + x) * 3;
        buf[idx] = Math.round(buf[idx] * 0.55);
        buf[idx + 1] = Math.round(buf[idx + 1] * 0.55);
        buf[idx + 2] = Math.round(buf[idx + 2] * 0.55);
      }
    }
  }

  // --- ROOM 2: Bedroom West Wall (960..1920) ---
  // Window frame (x=1440..1760)
  fillRect(1430, 80, 320, 310, 246, 245, 242);
  fillRect(1450, 100, 130, 270, 218, 229, 238);
  fillRect(1600, 100, 130, 270, 218, 229, 238);
  // Electrical outlet near lower wall (x=1240, y=420)
  fillRect(1230, 410, 28, 44, 246, 245, 241);
  fillRect(1238, 420, 12, 8, 150, 148, 142);
  fillRect(1238, 434, 12, 8, 150, 148, 142);

  // PRE-EXISTING hairline plaster crack near upper left of window (x=1360..1420, y=135..220) — IN BOTH!
  drawLine(1418, 138, 1392, 168, 118, 114, 108, 1);
  drawLine(1392, 168, 1378, 195, 118, 114, 108, 1);
  drawLine(1378, 195, 1364, 222, 126, 122, 116, 1);
  // Slight drywall nail-pop shadow next to crack
  fillRect(1386, 150, 8, 8, 162, 158, 152);

  // Minor paint rub near outlet (x=1275, y=418) — PRE-EXISTING
  fillRect(1272, 412, 34, 22, 206, 203, 198);

  if (variant === 'move-out') {
    // NEW dark furniture scuff on lower bedroom baseboard (x=1140..1210, y=488..508)
    drawLine(1130, 492, 1205, 504, 62, 58, 55, 3);
    drawLine(1145, 502, 1195, 510, 74, 70, 66, 2);
  }

  // --- ROOM 3: Kitchen Countertop & Cabinetry (1920..2880) ---
  // Upper cabinets
  fillRect(2020, 40, 680, 190, 214, 218, 210);
  for (const cx of [2190, 2360, 2530]) {
    fillRect(cx - 2, 40, 4, 190, 168, 172, 165);
  }
  // Backsplash subway tile
  fillRect(2020, 230, 680, 130, 242, 241, 236);
  for (let ty = 230; ty <= 360; ty += 26) {
    drawLine(2020, ty, 2700, ty, 212, 210, 204, 0);
  }
  // Countertop slab
  fillRect(2000, 360, 720, 24, 184, 182, 176);
  // Lower cabinets
  fillRect(2020, 384, 680, 136, 204, 208, 199);
  for (const cx of [2190, 2360, 2530]) {
    fillRect(cx - 2, 384, 4, 136, 158, 162, 155);
  }
  // PRE-EXISTING laminate chip on countertop edge (x=2280, y=364)
  fillRect(2274, 362, 18, 12, 92, 86, 78);

  // --- ROOM 4: Bathroom Vanity & Tub (2880..3840) ---
  // Mirror
  fillRect(3060, 90, 220, 240, 192, 196, 198);
  fillRect(3072, 102, 196, 216, 222, 230, 234);
  // Vanity
  fillRect(3020, 360, 300, 158, 228, 226, 220);
  fillRect(3010, 348, 320, 16, 245, 245, 243);
  // Tub rim & caulk seam (x=3420..3780)
  fillRect(3420, 380, 360, 138, 244, 244, 242);
  // Subtle caulk discoloration along tub rim (x=3480..3610, y=378)
  fillRect(3480, 376, 130, 6, 178, 165, 138);

  if (variant === 'move-out') {
    // Slightly tilted towel bar on wall (x=3350, y=240)
    drawLine(3335, 236, 3405, 252, 110, 112, 115, 3);
  } else {
    // Level towel bar on wall at move-in
    drawLine(3335, 240, 3405, 240, 110, 112, 115, 3);
  }

  return buf;
}

function writePpm(filePath, buf) {
  const header = Buffer.from(`P6\n${W} ${H}\n255\n`, 'ascii');
  fs.writeFileSync(filePath, Buffer.concat([header, buf]));
}

function buildVideo(variant, outFileName) {
  const ppmPath = path.join(outDir, `${variant}.ppm`);
  const mp4Path = path.join(outDir, outFileName);
  const buf = createPanoramaBuffer(variant);
  writePpm(ppmPath, buf);

  // Pan smoothly from x=0 to x=2560 across 16 seconds (1280x720 viewport), adding subtle timestamp HUD
  const roomOverlay =
    "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:" +
    "text='SAMPLE WALKTHROUGH · " +
    (variant === 'move-in' ? 'MOVE-IN' : 'MOVE-OUT') +
    " · %{pts\\:hms}':" +
    "x=36:y=32:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8";

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loop',
      '1',
      '-i',
      ppmPath,
      '-t',
      '16',
      '-vf',
      `fps=24,crop=1280:720:'min(2560,max(0,(t/16)*2560))':0,${roomOverlay}`,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      mp4Path,
    ],
    { stdio: 'pipe' }
  );

  fs.unlinkSync(ppmPath);
  const bytes = fs.readFileSync(mp4Path);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  return { outFileName, sizeBytes: bytes.length, sha256 };
}

const moveInMeta = buildVideo('move-in', 'move-in-sample.mp4');
const moveOutMeta = buildVideo('move-out', 'move-out-sample.mp4');
console.log(JSON.stringify({ moveInMeta, moveOutMeta }, null, 2));
