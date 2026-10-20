import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const destination = new URL('../.env', import.meta.url);
try {
  const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  await writeFile(
    destination,
    example.replace('replace-with-at-least-48-random-characters', randomBytes(48).toString('hex')),
    { flag: 'wx', mode: 0o600 },
  );
  console.log('Created backend/.env. Ready for normal local MongoDB on port 27017.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
