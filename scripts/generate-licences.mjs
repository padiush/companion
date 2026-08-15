/**
 * Collects the licence of every package that ships inside the app, so the
 * attribution screen is derived from the dependency tree rather than
 * maintained by hand — a hand-written list is wrong the first time a
 * dependency changes.
 *
 * Shipping a binary through an app store is distribution by any reading, and
 * MIT, ISC and BSD all require their notice to travel with the copies they are
 * in. CC BY terms require attribution outright.
 *
 * Production dependencies are walked. In an Expo project that still catches
 * some of the build toolchain, because Expo ships its bundler as a regular
 * dependency — attributing more than strictly ships is the safe direction to
 * err, and far cheaper than deciding wrongly which way.
 *
 * The output is committed so a release never depends on this having been run,
 * and refreshed by `npm run licences`.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'src/licences.json';

const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i;

function productionPackagePaths() {
  const raw = execFileSync('npm', ['ls', '--omit=dev', '--all', '--parseable'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return raw.split('\n').filter((p) => p.includes('node_modules'));
}

function licenceText(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }

  const texts = entries
    .filter((e) => LICENSE_FILE.test(e))
    .sort()
    .map((f) => {
      try {
        return readFileSync(join(dir, f), 'utf8').trim();
      } catch {
        return '';
      }
    })
    .filter(Boolean);

  return texts.length ? texts.join('\n\n') : null;
}

function spdx(manifest) {
  const { license, licenses } = manifest;
  if (typeof license === 'string') return license;
  if (license?.type) return license.type;
  if (Array.isArray(licenses)) return licenses.map((l) => l.type ?? l).join(' OR ');
  return 'UNKNOWN';
}

const packages = [];

for (const dir of productionPackagePaths()) {
  const manifestPath = join(dir, 'package.json');
  if (!existsSync(manifestPath)) continue;

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    continue;
  }
  if (!manifest.name) continue;

  packages.push({
    name: manifest.name,
    version: manifest.version ?? '',
    license: spdx(manifest),
    text: licenceText(dir),
  });
}

packages.sort((a, b) => a.name.localeCompare(b.name));

// Most of these are the same MIT text differing only in a copyright line, so
// grouping identical texts turns hundreds of entries into a readable handful —
// and keeps the file small enough to bundle into the app.
const groups = new Map();

for (const pkg of packages) {
  const key = pkg.text
    ? createHash('sha256').update(pkg.text).digest('hex')
    : `no-text:${pkg.license}`;

  if (!groups.has(key)) {
    groups.set(key, { licenses: new Set(), text: pkg.text, packages: [] });
  }
  const group = groups.get(key);
  // Packages sharing an identical notice can still declare different terms,
  // so a group is labelled with every identifier it contains rather than
  // whichever package happened to sort first.
  group.licenses.add(pkg.license);
  group.packages.push({ name: pkg.name, version: pkg.version });
}

const output = {
  packageCount: packages.length,
  missingText: packages.filter((p) => !p.text).map((p) => p.name),
  groups: [...groups.values()]
    .map((g) => ({ ...g, licenses: [...g.licenses].sort() }))
    .sort(
      (a, b) =>
        b.packages.length - a.packages.length || a.licenses[0].localeCompare(b.licenses[0]),
    ),
};

// Compact: this is generated, never reviewed by eye, and every byte of it is
// bundled into the app that a researcher installs over field connectivity.
writeFileSync(OUT, `${JSON.stringify(output)}\n`);

console.log(
  `licences: ${packages.length} packages, ${output.groups.length} distinct texts -> ${OUT}`,
);
