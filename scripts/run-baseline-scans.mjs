import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const targets = [
  'https://www.nytimes.com',
  'https://www.cnn.com',
  'https://www.amazon.com',
  'https://www.walmart.com',
  'https://www.reddit.com',
];

const outDir = resolve('artifacts', 'baseline');
await mkdir(outDir, { recursive: true });

const port = process.env.CC_PORT || '3007';

for (const url of targets) {
  const res = await fetch(`http://localhost:${port}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const json = await res.json();
  const host = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '_');
  await writeFile(resolve(outDir, `${host}.json`), JSON.stringify(json, null, 2));
  console.log(host, res.status);
}
