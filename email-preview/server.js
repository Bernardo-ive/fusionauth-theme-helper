/* eslint-disable no-console */

const path = require('path');
const express = require('express');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const PORT = Number(process.env.EMAIL_PREVIEW_PORT || 4560);

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function getAtPath(obj, dotPath) {
  const parts = dotPath.split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (!isPlainObject(cur) && !Array.isArray(cur)) return undefined;
    if (!(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function parseFreemarkerDefault(expr) {
  // Supports: user.firstName!'there'
  // Returns: { path: 'user.firstName', fallback: "there" }
  const m = expr.match(/^(.*?)!\s*(['"])([\s\S]*)\2\s*$/);
  if (!m) return { path: expr.trim(), fallback: undefined };
  return { path: m[1].trim(), fallback: m[3] };
}

function replaceInterpolations(input, context, { strict } = {}) {
  const unresolved = new Set();
  const warnings = [];
  if (!input || typeof input !== 'string') {
    return { output: input || '', unresolved: [], warnings };
  }

  const output = input.replace(/\$\{([^}]+)\}/g, (whole, raw) => {
    const expr = String(raw || '').trim();

    // Ignore complex constructs we don't implement.
    if (expr.includes('?') || expr.includes('(') || expr.includes(')') || expr.includes('[') || expr.includes(']')) {
      warnings.push(`Unsupported expression: ${expr}`);
      unresolved.add(expr);
      return strict ? '' : whole;
    }

    const { path: p, fallback } = parseFreemarkerDefault(expr);
    const v = getAtPath(context, p);
    if (v === undefined || v === null || v === '') {
      if (fallback !== undefined) return fallback;
      unresolved.add(p);
      return strict ? '' : whole;
    }
    if (typeof v === 'object') {
      unresolved.add(p);
      return strict ? '' : whole;
    }
    return String(v);
  });

  return { output, unresolved: Array.from(unresolved), warnings };
}

function basicTemplateLint(s) {
  const warnings = [];
  if (!s || typeof s !== 'string') return warnings;
  const open = (s.match(/\$\{/g) || []).length;
  const close = (s.match(/\}/g) || []).length;
  if (open > close) warnings.push('Possible unclosed ${...} placeholder');
  if (s.includes('[#')) warnings.push('Contains FreeMarker directives ([#...]); local preview does not execute them');
  return warnings;
}

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/', express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/render', (req, res) => {
  const html = typeof req.body?.html === 'string' ? req.body.html : '';
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const context = isPlainObject(req.body?.context) ? req.body.context : {};
  const strict = Boolean(req.body?.strict);

  const htmlLint = basicTemplateLint(html);
  const textLint = basicTemplateLint(text);

  const htmlR = replaceInterpolations(html, context, { strict });
  const textR = replaceInterpolations(text, context, { strict });

  const unresolved = Array.from(new Set([...htmlR.unresolved, ...textR.unresolved])).sort();
  const warnings = Array.from(new Set([...htmlLint, ...textLint, ...htmlR.warnings, ...textR.warnings]));

  res.json({
    html: htmlR.output,
    text: textR.output,
    unresolved,
    warnings,
  });
});

app.listen(PORT, () => {
  console.log(`email-preview running on http://localhost:${PORT}`);
});
