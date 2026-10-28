import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']
  });

  const page = await browser.newPage({
    viewport: { width: 462, height: 1024 }
  });

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // Wait a moment for Three.js render
  await page.waitForTimeout(1500);

  const outDir = path.resolve('projects/sword-divine/renders');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Stop autoRotate for fixed capture
  await page.evaluate(() => {
    // Hide UI overlays for clean render capture
    const header = document.getElementById('ui-header');
    const controls = document.getElementById('camera-controls');
    const refToggle = document.getElementById('ref-toggle');
    if (header) header.style.display = 'none';
    if (controls) controls.style.display = 'none';
    if (refToggle) refToggle.style.display = 'none';

    // Disable auto rotate if available via window
    window.__STOP_ROTATE__ = true;
  });

  // Capture 1: Front Reference Alignment View
  console.log('Capturing front view...');
  await page.click('button[data-view="front"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '01_front.png') });

  // Capture 2: Guard & Gem Close-up
  console.log('Capturing guard view...');
  await page.click('button[data-view="guard"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '02_guard_gem.png') });

  // Capture 3: Blade Close-up
  console.log('Capturing blade view...');
  await page.click('button[data-view="blade"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '03_blade_filigree.png') });

  // Capture 4: Pommel Close-up
  console.log('Capturing pommel view...');
  await page.click('button[data-view="pommel"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '04_pommel.png') });

  // Capture 5: Perspective 3D Orbit View
  console.log('Capturing perspective view...');
  await page.click('button[data-view="persp"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '05_perspective.png') });

  // Capture 6: Profile / Side View
  console.log('Capturing profile view...');
  await page.click('button[data-view="profile"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '06_profile.png') });

  await browser.close();
  console.log('All renders saved to projects/sword-divine/renders/');
}

run().catch(console.error);
