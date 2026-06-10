#!/usr/bin/env node

/*
  Duplicate FusionAuth email templates locally (using the FusionAuth CLI)
  and apply IVE One branding to the duplicated copies.

  This avoids modifying the original downloaded templates.

  Usage:
    node ./duplicate-brand-emails.js
    node ./duplicate-brand-emails.js --dry-run

  Env:
    EMAILS_DIR                (default: ./email-templates/emails)
    EMAIL_BRAND_TEMPLATE_ID   (default: 375773f7-911d-49e5-8ea8-e9f5eb723521)
    EMAIL_BRAND_MAP_PATH      (default: ./email-templates/emails-iveone-map.json)
*/

const path = require('path');
const fs = require('fs/promises');
const {
  applyIveOneBranding,
  buildIveOneWrappedHtml,
  loadRepoEnv,
  resolveEmailsDir,
  runFusionAuthCli,
  stripBrandTemplateSpecificLogic,
} = require('./lib/fusionauth-helpers');

loadRepoEnv(process.cwd());

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAILS_DIR = resolveEmailsDir(process.cwd());

const EMAIL_BRAND_TEMPLATE_ID =
  process.env.EMAIL_BRAND_TEMPLATE_ID || '375773f7-911d-49e5-8ea8-e9f5eb723521';

const EMAIL_BRAND_MAP_PATH = process.env.EMAIL_BRAND_MAP_PATH
  ? path.resolve(process.env.EMAIL_BRAND_MAP_PATH)
  : path.resolve(process.cwd(), 'email-templates', 'emails-iveone-map.json');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

async function readUtf8(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function writeUtf8(filePath, value) {
  if (DRY_RUN) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value ?? '', 'utf8');
}

function applyBranding(text) {
  return applyIveOneBranding(text);
}

function looksBranded(templateDir) {
  // Heuristic: already branded templates should not be duplicated again.
  // (There may already be IVE One templates created in this folder.)
  return Promise.all([
    readUtf8(path.join(templateDir, 'name.txt')),
    readUtf8(path.join(templateDir, 'body.html')),
  ]).then(([name, html]) => {
    const n = (name || '').toLowerCase();
    if (n.includes('[ive one]')) return true;
    if ((html || '').includes('<!-- HEADER -->') && (html || '').includes('IVE One')) return true;
    if ((html || '').includes('iveone-test.ivegroup.com.au')) return true;
    return false;
  });
}

function parseDuplicatedIdFromCliOutput(out) {
  // Example line:
  // Email template created in ./email-templates/emails/<uuid>/
  const m = out.match(/Email template created in .*?\/([0-9a-f\-]{36})\//i);
  if (!m) return null;
  return m[1];
}

async function brandTemplateOnDisk({ id, wrapperHtml }) {
  const dir = path.join(EMAILS_DIR, id);
  const namePath = path.join(dir, 'name.txt');
  const subjectPath = path.join(dir, 'subject.txt');
  const fromNamePath = path.join(dir, 'from_name.txt');
  const fromEmailPath = path.join(dir, 'from_email.txt');
  const htmlPath = path.join(dir, 'body.html');
  const textPath = path.join(dir, 'body.txt');

  const name = await readUtf8(namePath);
  const subject = await readUtf8(subjectPath);
  const fromName = await readUtf8(fromNamePath);
  const fromEmail = await readUtf8(fromEmailPath);
  const bodyHtmlRaw = await readUtf8(htmlPath);
  const bodyText = await readUtf8(textPath);

  const contentHtml = applyBranding(bodyHtmlRaw);
  const nextHtml = buildIveOneWrappedHtml({ wrapperHtml, contentHtml });

  await writeUtf8(namePath, applyBranding(name));
  await writeUtf8(subjectPath, applyBranding(subject));
  await writeUtf8(fromNamePath, applyBranding(fromName));
  await writeUtf8(fromEmailPath, applyBranding(fromEmail));
  await writeUtf8(textPath, applyBranding(bodyText));
  await writeUtf8(htmlPath, nextHtml);
}

async function main() {
  await fs.mkdir(EMAILS_DIR, { recursive: true });

  const wrapperDir = path.join(EMAILS_DIR, EMAIL_BRAND_TEMPLATE_ID);
  const wrapperRaw = await readUtf8(path.join(wrapperDir, 'body.html'));
  if (!wrapperRaw) {
    throw new Error(
      `Brand wrapper not found: ${path.join(wrapperDir, 'body.html')} (set EMAIL_BRAND_TEMPLATE_ID)`
    );
  }
  const wrapperHtml = stripBrandTemplateSpecificLogic(wrapperRaw);

  const entries = await fs.readdir(EMAILS_DIR, { withFileTypes: true });
  const sourceIds = entries
    .filter((e) => e.isDirectory() && UUID_RE.test(e.name))
    .map((e) => e.name)
    .filter((id) => id !== EMAIL_BRAND_TEMPLATE_ID);

  let existingMap = null;
  try {
    existingMap = JSON.parse(await readUtf8(EMAIL_BRAND_MAP_PATH));
  } catch {
    existingMap = null;
  }

  const map = {
    generatedAt: new Date().toISOString(),
    emailsDir: EMAILS_DIR,
    wrapperId: EMAIL_BRAND_TEMPLATE_ID,
    pairs: Object.assign({}, (existingMap && existingMap.pairs) || {}),
  };

  let duplicated = 0;
  let branded = 0;
  let skipped = 0;
  let alreadyDone = 0;

  for (const sourceId of sourceIds) {
    const dir = path.join(EMAILS_DIR, sourceId);
    if (await looksBranded(dir)) {
      skipped++;
      continue;
    }

    // If we've already created a branded duplicate for this source, don't create another one.
    if (!FORCE && map.pairs[sourceId] && UUID_RE.test(map.pairs[sourceId])) {
      const candidateDir = path.join(EMAILS_DIR, map.pairs[sourceId]);
      try {
        const st = await fs.stat(candidateDir);
        if (st.isDirectory()) {
          alreadyDone++;
          continue;
        }
      } catch {
        // fall through and recreate
      }
    }

    // Duplicate using the FusionAuth CLI so behavior matches its conventions.
    if (DRY_RUN) {
      // Fake an output id for reporting.
      map.pairs[sourceId] = null;
      duplicated++;
      branded++;
      continue;
    }

    const result = await runFusionAuthCli(['email:duplicate', '-o', EMAILS_DIR, sourceId]);
    if (result.code !== 0) {
      throw new Error(`email:duplicate failed for ${sourceId}\n${result.err || result.out}`);
    }

    const newId = parseDuplicatedIdFromCliOutput(result.out + '\n' + result.err);
    if (!newId) {
      throw new Error(`Could not parse duplicated id for ${sourceId}\n${result.out || result.err}`);
    }

    map.pairs[sourceId] = newId;
    duplicated++;

    await brandTemplateOnDisk({ id: newId, wrapperHtml });
    branded++;
  }

  await writeUtf8(EMAIL_BRAND_MAP_PATH, JSON.stringify(map, null, 2) + '\n');

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        force: FORCE,
        emailsDir: EMAILS_DIR,
        wrapperId: EMAIL_BRAND_TEMPLATE_ID,
        mapPath: EMAIL_BRAND_MAP_PATH,
        source: sourceIds.length,
        alreadyDone,
        duplicated,
        branded,
        skipped,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
