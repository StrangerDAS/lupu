const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT_DIR = path.resolve(__dirname, '../..');
const SOURCE_PNG_PATH = path.join(ROOT_DIR, 'frontend/public/android-chrome-512x512.png');
const ASSETS_DIR = path.join(__dirname, '../assets');

// Brand Colors
const BRAND_HEX = '#FF5C00';
const BRAND_R = 255;
const BRAND_G = 92;
const BRAND_B = 0;

console.log('Reading source image:', SOURCE_PNG_PATH);
const src = PNG.sync.read(fs.readFileSync(SOURCE_PNG_PATH));
console.log('Source loaded:', src.width, 'x', src.height);

// 1. Extract glyph alpha map from source image
// The white bike glyph sits roughly in x=[110, 400], y=[130, 385]
// Inside the source, background is orange (g ~ 104) and bike is white (g ~ 255)
const glyphAlpha = new Float32Array(512 * 512);
let minX = 512, maxX = 0, minY = 512, maxY = 0;

for (let y = 130; y <= 385; y++) {
  for (let x = 110; x <= 400; x++) {
    const idx = (y * 512 + x) << 2;
    const g = src.data[idx + 1];
    const a = Math.max(0, Math.min(1, (g - 104) / (255 - 104)));
    if (a > 0.02) {
      glyphAlpha[y * 512 + x] = a;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const glyphW = maxX - minX + 1;
const glyphH = maxY - minY + 1;
const glyphCenterX = (minX + maxX) / 2;
const glyphCenterY = (minY + maxY) / 2;
console.log(`Extracted glyph: [${minX}, ${minY}] to [${maxX}, ${maxY}], size=${glyphW}x${glyphH}, center=(${glyphCenterX.toFixed(1)}, ${glyphCenterY.toFixed(1)})`);

// Bilinear sample of the glyph alpha
function sampleGlyphAlpha(sx, sy) {
  if (sx < 0 || sx >= 511 || sy < 0 || sy >= 511) return 0;
  const x0 = Math.floor(sx), x1 = x0 + 1, fx = sx - x0;
  const y0 = Math.floor(sy), y1 = y0 + 1, fy = sy - y0;
  const a00 = glyphAlpha[y0 * 512 + x0];
  const a10 = glyphAlpha[y0 * 512 + x1];
  const a01 = glyphAlpha[y1 * 512 + x0];
  const a11 = glyphAlpha[y1 * 512 + x1];
  return (1 - fx) * (1 - fy) * a00 + fx * (1 - fy) * a10 + (1 - fx) * fy * a01 + fx * fy * a11;
}

// Signed distance to 2D rounded box
function sdRoundedBox(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - halfW + r;
  const qy = Math.abs(py) - halfH + r;
  return Math.min(Math.max(qx, qy), 0.0) + Math.hypot(Math.max(qx, 0.0), Math.max(qy, 0.0)) - r;
}

// ── 1. Generate adaptive-icon.png (512x512) ──
// Center white glyph scaled by 0.85 to fit comfortably inside the 170.7px safe zone radius
console.log('Generating adaptive-icon.png (512x512)...');
const adaptiveIcon = new PNG({ width: 512, height: 512 });
const adaptiveScale = 0.85;
let maxAdaptiveR = 0;

for (let ty = 0; ty < 512; ty++) {
  for (let tx = 0; tx < 512; tx++) {
    const sx = glyphCenterX + (tx - 256) / adaptiveScale;
    const sy = glyphCenterY + (ty - 256) / adaptiveScale;
    const a = sampleGlyphAlpha(sx, sy);
    const idx = (ty * 512 + tx) << 2;

    if (a > 0.02) {
      adaptiveIcon.data[idx] = 255;
      adaptiveIcon.data[idx + 1] = 255;
      adaptiveIcon.data[idx + 2] = 255;
      adaptiveIcon.data[idx + 3] = Math.round(a * 255);
      const r = Math.hypot(tx - 256, ty - 256);
      if (r > maxAdaptiveR) maxAdaptiveR = r;
    } else {
      adaptiveIcon.data[idx] = 0;
      adaptiveIcon.data[idx + 1] = 0;
      adaptiveIcon.data[idx + 2] = 0;
      adaptiveIcon.data[idx + 3] = 0;
    }
  }
}
console.log(`  Adaptive icon max radius: ${maxAdaptiveR.toFixed(1)} px (Android safe-zone limit: 170.7 px)`);

// ── 2. Generate android-icon-background.png (512x512) ──
console.log('Generating android-icon-background.png (512x512)...');
const bgIcon = new PNG({ width: 512, height: 512 });
for (let i = 0; i < 512 * 512; i++) {
  const idx = i << 2;
  bgIcon.data[idx] = BRAND_R;
  bgIcon.data[idx + 1] = BRAND_G;
  bgIcon.data[idx + 2] = BRAND_B;
  bgIcon.data[idx + 3] = 255;
}

// ── 3. Generate icon.png (512x512) ──
// Full-bleed official brand icon (brand orange background with white bike glyph)
console.log('Generating icon.png (512x512)...');
const fullIcon = new PNG({ width: 512, height: 512 });
for (let ty = 0; ty < 512; ty++) {
  for (let tx = 0; tx < 512; tx++) {
    const a = sampleGlyphAlpha(tx, ty);
    const idx = (ty * 512 + tx) << 2;
    // Composite white over brand orange
    fullIcon.data[idx] = Math.round(255 * a + BRAND_R * (1 - a));
    fullIcon.data[idx + 1] = Math.round(255 * a + BRAND_G * (1 - a));
    fullIcon.data[idx + 2] = Math.round(255 * a + BRAND_B * (1 - a));
    fullIcon.data[idx + 3] = 255;
  }
}

// ── 4. Generate splash-icon.png (1024x1024) ──
// Centered 512x512 rounded tile (corner radius 144px = 0.28) on transparent canvas
// Fits comfortably within Android 12+ splash circle mask (radius 341.3px)
console.log('Generating splash-icon.png (1024x1024)...');
const splashIcon = new PNG({ width: 1024, height: 1024 });
const halfW = 256, halfH = 256, cornerR = 144;
let maxSplashR = 0;

for (let ty = 0; ty < 1024; ty++) {
  for (let tx = 0; tx < 1024; tx++) {
    const px = tx - 512;
    const py = ty - 512;
    const d = sdRoundedBox(px, py, halfW, halfH, cornerR);
    const boxAlpha = Math.max(0, Math.min(1, 0.5 - d));
    const idx = (ty * 1024 + tx) << 2;

    if (boxAlpha > 0.01) {
      const r = Math.hypot(px, py);
      if (r > maxSplashR) maxSplashR = r;

      const sx = 256 + px;
      const sy = glyphCenterY + py;
      const bikeAlpha = sampleGlyphAlpha(sx, sy);

      // Composite white bike over brand orange tile
      splashIcon.data[idx] = Math.round(255 * bikeAlpha + BRAND_R * (1 - bikeAlpha));
      splashIcon.data[idx + 1] = Math.round(255 * bikeAlpha + BRAND_G * (1 - bikeAlpha));
      splashIcon.data[idx + 2] = Math.round(255 * bikeAlpha + BRAND_B * (1 - bikeAlpha));
      splashIcon.data[idx + 3] = Math.round(boxAlpha * 255);
    } else {
      splashIcon.data[idx] = 0;
      splashIcon.data[idx + 1] = 0;
      splashIcon.data[idx + 2] = 0;
      splashIcon.data[idx + 3] = 0;
    }
  }
}
console.log(`  Splash icon tile max radius: ${maxSplashR.toFixed(1)} px (Android 12 splash limit: 341.3 px)`);

// Write files to assets
fs.writeFileSync(path.join(ASSETS_DIR, 'adaptive-icon.png'), PNG.sync.write(adaptiveIcon));
fs.writeFileSync(path.join(ASSETS_DIR, 'android-icon-foreground.png'), PNG.sync.write(adaptiveIcon));
fs.writeFileSync(path.join(ASSETS_DIR, 'android-icon-monochrome.png'), PNG.sync.write(adaptiveIcon));
fs.writeFileSync(path.join(ASSETS_DIR, 'android-icon-background.png'), PNG.sync.write(bgIcon));
fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), PNG.sync.write(fullIcon));
fs.writeFileSync(path.join(ASSETS_DIR, 'splash-icon.png'), PNG.sync.write(splashIcon));

console.log('All branding assets generated successfully in mobile/assets/!');
