#!/usr/bin/env python3
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path('projects/sword-divine/renders')
OUT_DIR.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox']
    )
    page = browser.new_page(viewport={'width': 462, 'height': 1024})
    
    print('Navigating to http://localhost:5173/ ...')
    page.goto('http://localhost:5173/', wait_until='networkidle')
    page.wait_for_function('() => window.__READY__ === true', timeout=10000)
    page.wait_for_timeout(1000)

    # Clean UI and stop rotate
    page.evaluate('''() => {
        const header = document.getElementById('ui-header');
        const controls = document.getElementById('camera-controls');
        const refToggle = document.getElementById('ref-toggle');
        const refOverlay = document.getElementById('ref-overlay');
        const lilGui = document.querySelector('.lil-gui');
        if (header) header.style.display = 'none';
        if (controls) controls.style.display = 'none';
        if (refToggle) refToggle.style.display = 'none';
        if (refOverlay) refOverlay.style.display = 'none';
        if (lilGui) lilGui.style.display = 'none';
        window.__STOP_ROTATE__ = true;
    }''')
    page.wait_for_timeout(500)

    # 1. Front View (Upright)
    print('Capturing 01_front_upright.png...')
    page.evaluate("window.__SET_CAMERA__('front')")
    page.evaluate("window.__SWORD__.root.rotation.z = 0.0")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT_DIR / '01_front_upright.png'))

    # 2. Front View (Tilted +13.74 deg matching reference art)
    print('Capturing 01_front_tilted_ref.png...')
    page.evaluate("window.__PARAMS__.sparkles = false; if (window.__SWORD__) window.__SWORD__.root.parent.children.forEach(c => { if (c.type === 'Points') c.visible = false; });")
    page.evaluate("window.__SWORD__.root.rotation.z = 0.24")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT_DIR / '01_front_tilted_ref.png'))
    # Reset rotation and sparkles
    page.evaluate("window.__SWORD__.root.rotation.z = 0.0")
    page.evaluate("window.__PARAMS__.sparkles = true; if (window.__SWORD__) window.__SWORD__.root.parent.children.forEach(c => { if (c.type === 'Points') c.visible = true; });")

    # 3. Guard & Gem View
    print('Capturing 02_guard_gem.png...')
    page.evaluate("window.__SET_CAMERA__('guard')")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT_DIR / '02_guard_gem.png'))

    # 4. Blade & Filigree View
    print('Capturing 03_blade_filigree.png...')
    page.evaluate("window.__SET_CAMERA__('blade')")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT_DIR / '03_blade_filigree.png'))

    # 5. Pommel View
    print('Capturing 04_pommel.png...')
    page.evaluate("window.__SET_CAMERA__('pommel')")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT_DIR / '04_pommel.png'))

    # 6. Perspective View
    print('Capturing 05_perspective.png...')
    page.evaluate("window.__SET_CAMERA__('persp')")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT_DIR / '05_perspective.png'))

    # 7. Profile View
    print('Capturing 06_profile.png...')
    page.evaluate("window.__SET_CAMERA__('profile')")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT_DIR / '06_profile.png'))

    browser.close()
    print('All screenshots captured successfully!')
