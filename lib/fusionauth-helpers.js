const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

function loadRepoEnv(repoRoot) {
  const envPath = path.join(repoRoot, '.env');
  dotenv.config({ path: envPath, override: true });

  if (!process.env.FUSIONAUTH_API_KEY && process.env.API_KEY) {
    process.env.FUSIONAUTH_API_KEY = process.env.API_KEY;
  }

  if (!process.env.FUSIONAUTH_HOST && process.env.FUSIONAUTH_URL) {
    process.env.FUSIONAUTH_HOST = process.env.FUSIONAUTH_URL;
  }
}

function resolveEmailsDir(baseDir = process.cwd()) {
  if (process.env.EMAILS_DIR) {
    return path.resolve(process.env.EMAILS_DIR);
  }

  return path.resolve(baseDir, 'email-templates', 'emails');
}

function applyIveOneBranding(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  return text
    .replace(/\[FusionAuth Default\]/g, '[IVE One]')
    .replace(/FusionAuth Admin/g, 'IVE One')
    .replace(/http:\/\/example\.com\b/g, '${tenant.issuer}')
    .replace(/http:\/\/localhost:9011\b/g, '${tenant.issuer}');
}

function stripBrandTemplateSpecificLogic(html) {
  if (!html || typeof html !== 'string') {
    return html;
  }

  return html
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('[#assign url =')) return false;
      if (trimmed.startsWith('[#list state')) return false;
      return true;
    })
    .join('\n');
}

function buildIveOneWrappedHtml({ wrapperHtml, contentHtml }) {
  if (!wrapperHtml || typeof wrapperHtml !== 'string') {
    return contentHtml;
  }

  if (!contentHtml || typeof contentHtml !== 'string') {
    return wrapperHtml;
  }

  const startMarker = '<!-- BODY -->';
  const endMarker = '<!-- FOOTER -->';
  const startIndex = wrapperHtml.indexOf(startMarker);
  const endIndex = wrapperHtml.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return wrapperHtml;
  }

  const before = wrapperHtml.slice(0, startIndex + startMarker.length);
  const after = wrapperHtml.slice(endIndex);

  const bodyBlock = `

        <tr>
          <td style="padding:40px;">
            <div style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#0e0566;">
${contentHtml}
            </div>
          </td>
        </tr>

`;

  return before + bodyBlock + after;
}

function runFusionAuthCli(args, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['fusionauth', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    let out = '';
    let err = '';

    child.stdout.on('data', (d) => {
      out += String(d);
    });

    child.stderr.on('data', (d) => {
      err += String(d);
    });

    child.on('close', (code) => {
      resolve({ code, out, err });
    });
  });
}

module.exports = {
  applyIveOneBranding,
  buildIveOneWrappedHtml,
  loadRepoEnv,
  resolveEmailsDir,
  runFusionAuthCli,
  stripBrandTemplateSpecificLogic,
};
