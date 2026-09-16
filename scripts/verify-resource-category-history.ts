import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Resources.tsx', 'utf8');

const required = [
  "import { useSearchParams } from 'react-router-dom';",
  'const [searchParams, setSearchParams] = useSearchParams();',
  "const categoryParam = searchParams.get('category');",
  "const category = categories.includes(categoryParam || '') ? categoryParam! : 'All';",
  'const setResourceCategory = (nextCategory: string) =>',
  "if (nextCategory === 'All') next.delete('category');",
  "else next.set('category', nextCategory);",
  'onClick={() => setResourceCategory(item)}',
  "next.delete('category');",
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Missing Resource category history marker: ${marker}`);
  }
}

if (source.includes("const [category, setCategory] = useState('All')")) {
  throw new Error('Resource category must not regress to local-only state');
}

if (!source.includes("const [searchText, setSearchText] = useState('')")) {
  throw new Error('Free-text Resource search should remain local and avoid per-keystroke history entries');
}

console.log('Resource category URL/history navigation: PASS');
