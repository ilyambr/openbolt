const fs = require('fs');
const path = require('path');

const BANNER = `// ==UserScript==
// @name         OpenBolt
// @version      2.0.0
// @description  Free and open-source Edgenuity companion: AutoAdvance, WebAudio Background Mode, Offline Answer Database, and AI Solver.
// @namespace    https://github.com/ilyambr/openbolt
// @author       ilyambr
// @license      MIT
// @match        *://*.edgenuity.com/*
// @include      *://*.edgenuity.com/*
// @include      *://*groq.com*/*
// @include      *://*cerebras.ai*/*
// @connect      gist.githubusercontent.com
// @connect      api.groq.com
// @connect      api.cerebras.ai
// @connect      openrouter.ai
// @connect      githubusercontent.com
// @connect      raw.githubusercontent.com
// @connect      *
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        window.close
// @grant        GM_xmlhttpRequest
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @grant        window.focus
// @run-at       document-idle
// ==/UserScript==
`;

const MODULE_ORDER = [
  'config.js',
  'logger.js',
  'network.js',
  'apikey_grabber.js',
  'dom.js',
  'background.js',
  'database.js',
  'features.js',
  'autoadvance.js',
  'solver.js',
  'ui.js',
  'main.js'
];

function build() {
  console.log("⚡ Building OpenBolt from src/ modules...");
  const srcDir = path.join(__dirname, 'src');
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const moduleContents = [];

  for (const modFile of MODULE_ORDER) {
    const fullPath = path.join(srcDir, modFile);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Module missing: ${modFile}`);
    }
    let code = fs.readFileSync(fullPath, 'utf8');

    
    code = code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
    code = code.replace(/import\s+['"][^'"]+['"];?/g, '');

    
    code = code.replace(/^\s*export\s+(default\s+)?/gm, '');

    moduleContents.push(`  // --- Module: ${modFile} ---\n` + code.trim());
  }

  const bundledBody = `(function () {\n  "use strict";\n\n${moduleContents.join('\n\n')}\n})();\n`;
  const finalOutput = BANNER + '\n' + bundledBody;

  const rootDest = path.join(__dirname, 'openbolt.user.js');
  const standaloneDest = path.join(__dirname, 'openbolt.standalone.user.js');
  const distDest = path.join(distDir, 'openbolt.user.js');

  fs.writeFileSync(rootDest, finalOutput, 'utf8');
  fs.writeFileSync(standaloneDest, finalOutput, 'utf8');
  fs.writeFileSync(distDest, finalOutput, 'utf8');

  console.log(`✓ Built successfully! (${(finalOutput.length / 1024).toFixed(1)} KB)`);
  console.log(`  -> ${rootDest}`);
  console.log(`  -> ${standaloneDest} (Easy copy-paste for Tampermonkey)`);
  console.log(`  -> ${distDest}`);
}

build();
