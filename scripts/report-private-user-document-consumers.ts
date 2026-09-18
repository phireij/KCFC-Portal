import fs from 'node:fs';
import path from 'node:path';

const srcRoot = path.resolve('src');
const extensions = new Set(['.ts', '.tsx']);
const files: string[] = [];

const walk = (directory: string) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (extensions.has(path.extname(entry.name))) files.push(fullPath);
  }
};
walk(srcRoot);

const patterns = [
  /doc\s*\(\s*db\s*,\s*['"`]users['"`]\s*,/g,
  /doc\s*\(\s*db\s*,\s*`users\//g,
  /collection\s*\(\s*db\s*,\s*['"`]users['"`]\s*\)/g,
];

const consumers: Array<{ file: string; lines: number[] }> = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);
  const matched = new Set<number>();
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) matched.add(index + 1);
    }
  });
  if (matched.size > 0) {
    consumers.push({
      file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
      lines: [...matched],
    });
  }
}

consumers.sort((a, b) => a.file.localeCompare(b.file));
console.log('Private user browser-access consumer report:');
for (const consumer of consumers) {
  console.log(`- ${consumer.file}: lines ${consumer.lines.join(', ')}`);
}
console.log(`Private user browser-access consumer count: ${consumers.length}`);
