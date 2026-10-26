import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Crisp, high-contrast Flying Paper Plane SVG with Google 4-color palette
const createPaperPlaneSvg = ({ width, height, isMaskable = false }) => {
  const safePadding = isMaskable ? width * 0.15 : 0;
  const size = width - safePadding * 2;
  const translateOffset = safePadding;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 256 256">
  <defs>
    <!-- Blue Upper Wing Gradient -->
    <linearGradient id="blueWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4285F4" />
      <stop offset="100%" stop-color="#1a73e8" />
    </linearGradient>

    <!-- Green Right Wing Gradient -->
    <linearGradient id="greenWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34A853" />
      <stop offset="100%" stop-color="#188038" />
    </linearGradient>

    <!-- Red Keel Shadow Gradient -->
    <linearGradient id="redKeelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EA4335" />
      <stop offset="100%" stop-color="#d93025" />
    </linearGradient>

    <!-- Yellow Fold Accent Gradient -->
    <linearGradient id="yellowFoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBC05" />
      <stop offset="100%" stop-color="#f29900" />
    </linearGradient>

    <!-- Soft Glow Shadow for Plane -->
    <filter id="planeGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#1a73e8" flood-opacity="0.25" />
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.12" />
    </filter>

    <style>
      .speed-line {
        stroke-dasharray: 8 6;
        stroke-linecap: round;
        opacity: 0.85;
      }
    </style>
  </defs>

  ${isMaskable ? `<rect width="256" height="256" rx="0" fill="#ffffff" />` : ''}

  <g transform="translate(${translateOffset * (256/width)}, ${translateOffset * (256/width)}) scale(${(256 - safePadding * 2 * (256/width)) / 256})">
    <!-- Optional background rounded container if not maskable -->
    ${!isMaskable ? `<rect x="8" y="8" width="240" height="240" rx="56" fill="#ffffff" />` : ''}

    <!-- Dynamic Motion & Speed Trails -->
    <path d="M 24 185 C 45 195, 80 180, 110 162" fill="none" stroke="#4285F4" stroke-width="5" class="speed-line" />
    <path d="M 12 160 C 35 170, 65 155, 95 138" fill="none" stroke="#EA4335" stroke-width="4" class="speed-line" />
    <path d="M 40 205 C 65 212, 95 198, 125 180" fill="none" stroke="#FBBC05" stroke-width="4.5" class="speed-line" />

    <!-- Main Flying Paper Plane Body -->
    <g filter="url(#planeGlow)">
      <!-- 1. Left Primary Wing (Google Blue) -->
      <polygon points="228,32 36,124 136,156" fill="url(#blueWingGrad)" />

      <!-- 2. Right Fold Wing (Google Green) -->
      <polygon points="228,32 136,156 188,212" fill="url(#greenWingGrad)" />

      <!-- 3. Under-body Keel Shadow (Google Red) -->
      <polygon points="228,32 108,176 136,156" fill="url(#redKeelGrad)" />

      <!-- 4. Center Fold Accent (Google Yellow) -->
      <polygon points="108,176 128,206 188,212 136,156" fill="url(#yellowFoldGrad)" />
    </g>

    <!-- Sparkle Speed Star in Nose -->
    <circle cx="228" cy="32" r="4" fill="#ffffff" />
  </g>
</svg>`;
};

async function generateAssets() {
  console.log('Generating favicon and app icon assets...');

  // 1. Save Vector SVG Icon
  const svgContent = createPaperPlaneSvg({ width: 256, height: 256, isMaskable: false });
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');
  console.log('Created public/icon.svg');

  // 2. Generate PNG sizes
  const sizes = [
    { name: 'favicon-16x16.png', size: 16, maskable: false },
    { name: 'favicon-32x32.png', size: 32, maskable: false },
    { name: 'apple-touch-icon.png', size: 180, maskable: false },
    { name: 'pwa-192x192.png', size: 192, maskable: false },
    { name: 'pwa-512x512.png', size: 512, maskable: false },
    { name: 'pwa-maskable-512x512.png', size: 512, maskable: true },
  ];

  for (const item of sizes) {
    const svgStr = createPaperPlaneSvg({ width: item.size, height: item.size, isMaskable: item.maskable });
    const buffer = Buffer.from(svgStr);
    await sharp(buffer)
      .resize(item.size, item.size)
      .png()
      .toFile(path.join(publicDir, item.name));
    console.log(`Generated public/${item.name}`);
  }

  // 3. Generate favicon.ico (32x32 PNG renamed or packaged)
  const icoSvg = createPaperPlaneSvg({ width: 32, height: 32, isMaskable: false });
  await sharp(Buffer.from(icoSvg))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('Generated public/favicon.ico');

  console.log('All favicon and app icon assets generated successfully!');
}

generateAssets().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
