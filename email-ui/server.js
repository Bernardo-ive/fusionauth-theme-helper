/* eslint-disable no-console */

const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const crypto = require('crypto');

const express = require('express');
require('dotenv').config();

// Support legacy variable names used by older scripts.
if (!process.env.FUSIONAUTH_API_KEY && process.env.API_KEY) {
  process.env.FUSIONAUTH_API_KEY = process.env.API_KEY;
}
if (!process.env.FUSIONAUTH_HOST && process.env.FUSIONAUTH_URL) {
  process.env.FUSIONAUTH_HOST = process.env.FUSIONAUTH_URL;
}

const FUSIONAUTH_API_KEY = process.env.FUSIONAUTH_API_KEY;
const FUSIONAUTH_HOST = (process.env.FUSIONAUTH_HOST || 'http://localhost:9011').replace(/\/$/, '');

const EMAILS_DIR = process.env.EMAILS_DIR
  ? path.resolve(process.env.EMAILS_DIR)
  : path.resolve(process.cwd(), 'email-templates', 'emails');

const PORT = Number(process.env.EMAIL_UI_PORT || 4545);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fileToString(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function writeString(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value ?? '', 'utf8');
}

async function templateDir(id) {
  if (!UUID_RE.test(id)) {
    const err = new Error('Invalid template id');
    err.statusCode = 400;
    throw err;
  }
  return path.join(EMAILS_DIR, id);
}

async function listTemplates() {
  await fs.mkdir(EMAILS_DIR, { recursive: true });
  const entries = await fs.readdir(EMAILS_DIR, { withFileTypes: true });

  const dirs = entries
    .filter((e) => e.isDirectory() && UUID_RE.test(e.name))
    .map((e) => e.name);

  const templates = [];
  for (const id of dirs) {
    const dir = path.join(EMAILS_DIR, id);
    const name = (await fileToString(path.join(dir, 'name.txt'))).trim();
    const subject = (await fileToString(path.join(dir, 'subject.txt'))).trim();
    templates.push({ id, name, subject });
  }

  templates.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  return templates;
}

async function getTemplate(id) {
  const dir = await templateDir(id);
  return {
    id,
    name: await fileToString(path.join(dir, 'name.txt')),
    subject: await fileToString(path.join(dir, 'subject.txt')),
    fromName: await fileToString(path.join(dir, 'from_name.txt')),
    fromEmail: await fileToString(path.join(dir, 'from_email.txt')),
    bodyHtml: await fileToString(path.join(dir, 'body.html')),
    bodyText: await fileToString(path.join(dir, 'body.txt')),
  };
}

async function saveTemplate(id, patch) {
  const dir = await templateDir(id);

  if (typeof patch.name === 'string') {
    await writeString(path.join(dir, 'name.txt'), patch.name);
  }
  if (typeof patch.subject === 'string') {
    await writeString(path.join(dir, 'subject.txt'), patch.subject);
  }
  if (typeof patch.fromName === 'string') {
    await writeString(path.join(dir, 'from_name.txt'), patch.fromName);
  }
  if (typeof patch.fromEmail === 'string') {
    await writeString(path.join(dir, 'from_email.txt'), patch.fromEmail);
  }
  if (typeof patch.bodyHtml === 'string') {
    await writeString(path.join(dir, 'body.html'), patch.bodyHtml);
  }
  if (typeof patch.bodyText === 'string') {
    await writeString(path.join(dir, 'body.txt'), patch.bodyText);
  }

  return getTemplate(id);
}

function applyBranding(text, mode) {
  if (!text || typeof text !== 'string') return text;
  if (mode !== 'iveone') return text;

  return text
    .replace(/\[FusionAuth Default\]/g, '[IVE One]')
    .replace(/FusionAuth Admin/g, 'IVE One')
    .replace(/http:\/\/example\.com\b/g, '${tenant.issuer}')
    .replace(/http:\/\/localhost:9011\b/g, '${tenant.issuer}');
}

async function duplicateTemplate(id, { mode } = {}) {
  const src = await templateDir(id);
  const dstId = crypto.randomUUID();
  const dst = await templateDir(dstId);

  await fs.cp(src, dst, { recursive: true });

  // Optional branding pass.
  const t = await getTemplate(dstId);
  await saveTemplate(dstId, {
    name: applyBranding(t.name, mode),
    subject: applyBranding(t.subject, mode),
    fromName: applyBranding(t.fromName, mode),
    fromEmail: applyBranding(t.fromEmail, mode),
    bodyHtml: applyBranding(t.bodyHtml, mode),
    bodyText: applyBranding(t.bodyText, mode),
  });

  return dstId;
}

async function fusionAuthPreviewEmailTemplate(template, locale) {
  if (!FUSIONAUTH_API_KEY) {
    const err = new Error('Missing FUSIONAUTH_API_KEY');
    err.statusCode = 500;
    throw err;
  }

  const url = `${FUSIONAUTH_HOST}/api/email/template/preview`;
  const payload = {
    emailTemplate: {
      name: (template.name || '').trim() || 'Preview',
      defaultSubject: (template.subject || '').trim() || 'Preview',
      defaultFromName: (template.fromName || '').trim() || 'IVE One',
      fromEmail: (template.fromEmail || '').trim() || 'noreply@example.com',
      defaultHtmlTemplate: template.bodyHtml || '',
      defaultTextTemplate: template.bodyText || '',
    },
    locale: locale || null,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: FUSIONAUTH_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`FusionAuth preview failed: ${res.status}`);
    err.statusCode = res.status;
    err.details = json;
    throw err;
  }

  return json;
}

function runFusionAuthCli(args) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['fusionauth', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += String(d)));
    child.stderr.on('data', (d) => (err += String(d)));

    child.on('close', (code) => {
      resolve({ code, out, err });
    });
  });
}

const app = express();
app.use(express.json({ limit: '5mb' }));

app.use('/', express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    emailsDir: EMAILS_DIR,
    fusionAuthHost: FUSIONAUTH_HOST,
    hasApiKey: Boolean(FUSIONAUTH_API_KEY),
  });
});

app.get('/api/templates', async (req, res, next) => {
  try {
    res.json({ templates: await listTemplates() });
  } catch (e) {
    next(e);
  }
});

app.get('/api/templates/:id', async (req, res, next) => {
  try {
    res.json({ template: await getTemplate(req.params.id) });
  } catch (e) {
    next(e);
  }
});

app.put('/api/templates/:id', async (req, res, next) => {
  try {
    const saved = await saveTemplate(req.params.id, req.body || {});
    res.json({ template: saved });
  } catch (e) {
    next(e);
  }
});

app.post('/api/templates/:id/duplicate', async (req, res, next) => {
  try {
    const newId = await duplicateTemplate(req.params.id, req.body || {});
    res.json({ id: newId });
  } catch (e) {
    next(e);
  }
});

app.post('/api/templates/:id/preview', async (req, res, next) => {
  try {
    const template = await getTemplate(req.params.id);
    const locale = req.body ? req.body.locale : null;
    const result = await fusionAuthPreviewEmailTemplate(template, locale);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

app.post('/api/templates/:id/upload', async (req, res, next) => {
  try {
    const id = req.params.id;
    const overwrite = Boolean(req.body && req.body.overwrite);
    const args = ['email:upload', '-i', EMAILS_DIR];
    if (overwrite) args.push('--overwrite');
    args.push(id);

    const result = await runFusionAuthCli(args);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// Basic error handler
app.use((err, req, res, next) => {
  const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
  res.status(status).json({
    error: err.message || 'Server error',
    details: err.details,
  });
});

app.listen(PORT, () => {
  console.log(`Email UI running on http://localhost:${PORT}`);
  console.log(`EMAILS_DIR: ${EMAILS_DIR}`);
});
