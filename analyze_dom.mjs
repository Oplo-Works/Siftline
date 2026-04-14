import fs from 'fs';

// Check the context around the Perplexity prose div
const perplexityHtml = fs.readFileSync('dom_dump_safetynet_perplexity.html', 'utf8');

const proseIdx = perplexityHtml.indexOf('prose dark:prose-invert inline leading-relaxed');
if (proseIdx !== -1) {
  console.log('--- Perplexity prose div context ---');
  console.log(perplexityHtml.slice(Math.max(0, proseIdx - 500), proseIdx + 800).replace(/\s+/g,' '));
}

// Also check the min-w-0 flex-1 flex-col area (first Korean text)
const flexIdx = perplexityHtml.indexOf('flex min-w-0 flex-1 flex-col items-start gap-xs');
if (flexIdx !== -1) {
  console.log('\n--- Perplexity flex text container context ---');
  console.log(perplexityHtml.slice(Math.max(0, flexIdx - 400), flexIdx + 600).replace(/\s+/g,' '));
}
