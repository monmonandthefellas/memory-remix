import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const distDir = resolve(rootDir, 'dist');

if (!existsSync(distDir)) {
  throw new Error('dist directory was not created by vite build');
}

// Static files now live in public/* and are copied by Vite automatically.

// Keep only legacy Webflow runtime file from source js/.
const webflowSource = resolve(rootDir, 'js', 'webflow.js');
if (existsSync(webflowSource)) {
  const jsDistDir = resolve(distDir, 'js');
  mkdirSync(jsDistDir, { recursive: true });
  copyFileSync(webflowSource, resolve(jsDistDir, 'webflow.js'));
}

const optionalFiles = ['404.html'];
for (const file of optionalFiles) {
  const source = resolve(rootDir, file);
  const destination = resolve(distDir, file);

  if (existsSync(source)) {
    copyFileSync(source, destination);
  }
}

const sourceIndexPath = resolve(rootDir, 'index.html');
const targetIndexPath = resolve(distDir, 'index.html');

let indexHtml = readFileSync(sourceIndexPath, 'utf8');

// Ensure all relative assets resolve from root on rewritten routes (/admin, /admin-login, /dashboard)
if (!indexHtml.includes('<base href="/">')) {
  indexHtml = indexHtml.replace('<head>', '<head>\n  <base href="/">');
}

// Vite stylesheet
indexHtml = indexHtml.replace(/href="dist\/assets\/style\.css"/g, 'href="/assets/style.css"');

// App bundle entry (support both legacy and current source patterns)
indexHtml = indexHtml.replace(
  /<script\s+type="module"\s+src="\.\/src\/main\.jsx"><\/script>/g,
  '<script type="module" src="/bundle.js"></script>'
);
indexHtml = indexHtml.replace(
  /<script\s+type="module"\s+src="\.\/dist\/bundle\.js"><\/script>/g,
  '<script type="module" src="/bundle.js"></script>'
);

writeFileSync(targetIndexPath, indexHtml, 'utf8');

console.log('[build-vercel] Prepared dist/index.html and copied legacy webflow runtime');
