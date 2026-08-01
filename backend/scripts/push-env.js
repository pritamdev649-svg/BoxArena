import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const envPath = path.resolve('/Users/rajesh/Documents/BoxArena/backend/.env');
const fileContent = fs.readFileSync(envPath, 'utf8');

const lines = fileContent.split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex === -1) continue;
  const key = trimmed.substring(0, equalsIndex).trim();
  let value = trimmed.substring(equalsIndex + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.substring(1, value.length - 1);
  }

  if (!key) continue;

  console.log(`Setting env var: ${key}...`);
  try {
    execSync(`vercel env add ${key} production,preview --yes --force`, {
      input: value,
      cwd: '/Users/rajesh/Documents/BoxArena/backend',
      stdio: ['pipe', 'inherit', 'inherit']
    });
  } catch (err) {
    console.error(`Failed to set ${key}:`, err.message);
  }
}
