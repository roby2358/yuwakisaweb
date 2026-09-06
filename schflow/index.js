// schflow — Schwab OAuth authorization-code helper.
// Client-side only: nothing on this page talks to any server.

const AUTHORIZE_ENDPOINT = 'https://api.schwabapi.com/v1/oauth/authorize';
const LITTLEBRAIN_RETURN = 'http://localhost:8767/schwab/oauth-return';
const CLIENT_ID = 'EuTHVxRHEwAyAyE57b5dDe2eeBl2yWYCCsmrHZoDMQKGGKRM';
const REDIRECT_URI = 'https://yuwakisa.com/schflow';
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const STATE_GROUPS = 4;
const STATE_GROUP_LEN = 3;
const STORAGE_CLIENT_ID = 'schflow.clientId';
const STORAGE_STATE = 'schflow.state';
const STORAGE_REDIRECT = 'schflow.redirectUri';

const el = (id) => document.getElementById(id);

// ---------- state string ----------

function randomBase62(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => BASE62[b % BASE62.length]).join('');
}

function generateState() {
  return Array.from({ length: STATE_GROUPS }, () => randomBase62(STATE_GROUP_LEN)).join('-');
}

// ---------- storage ----------

function stored(key) {
  try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
}

function store(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable; nothing to do */ }
}

// ---------- authorize url ----------

function authorizeUrl(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: state,
  });
  return AUTHORIZE_ENDPOINT + '?' + params.toString();
}

// ---------- clipboard ----------

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const scratch = document.createElement('textarea');
    scratch.value = text;
    document.body.appendChild(scratch);
    scratch.select();
    const ok = document.execCommand('copy');
    scratch.remove();
    ok ? resolve() : reject(new Error('copy command failed'));
  });
}

function setStatus(node, text, cls) {
  node.textContent = text;
  node.className = 'status ' + cls;
}

// ---------- state comparison ----------

const STATE_VERDICTS = {
  unknown: { mark: '?', text: 'No sent state in this browser to compare against; eyeball it.' },
  ok:      { mark: '\u2713', text: 'State matches.' },
  bad:     { mark: '\u2715', text: 'State does NOT match what was sent.' },
};

function compareState(sent, got) {
  if (!sent) return 'unknown';
  return sent === got ? 'ok' : 'bad';
}

function showStateVerdict(kind) {
  const verdict = STATE_VERDICTS[kind];
  const mark = el('stateMark');
  mark.textContent = verdict.mark;
  mark.className = 'state-mark ' + kind;
  setStatus(el('stateVerdict'), verdict.text, kind);
}

// ---------- panels ----------

function showError(query) {
  el('errorMessage').textContent = query.get('error');
  el('errorDescription').textContent = query.get('error_description') || '';
  el('errorPanel').classList.remove('hidden');
}

function wireLittlebrainLink(code, verdict) {
  const link = el('littlebrainLink');
  const note = el('littlebrainNote');
  if (verdict === 'bad') {
    link.classList.add('disabled');
    link.href = '#';
    note.textContent = 'Handoff disabled: state mismatch.';
    return;
  }
  link.href = LITTLEBRAIN_RETURN + '?code=' + encodeURIComponent(code);
  note.textContent = 'Sends only the code to ' + LITTLEBRAIN_RETURN + ' on this machine.';
}

function showCode(query) {
  const code = query.get('code');
  const returned = query.get('state') || '';
  const generated = stored(STORAGE_STATE);
  const verdict = compareState(generated, returned);

  el('codeBlock').textContent = code;
  el('stateSent').textContent = generated || '(none stored in this browser)';
  el('stateGot').textContent = returned || '(none)';
  showStateVerdict(verdict);
  wireLittlebrainLink(code, verdict);

  const copyStatus = el('copyStatus');
  el('copyButton').addEventListener('click', () => {
    copyText(code)
      .then(() => setStatus(copyStatus, 'Copied.', 'ok'))
      .catch(() => setStatus(copyStatus, 'Copy failed; select the code and copy manually.', 'bad'));
  });

  el('codePanel').classList.remove('hidden');
  el('copyButton').focus();
}

function renderResult(query) {
  if (query.has('error')) return showError(query);
  if (query.has('code')) return showCode(query);
}

// ---------- start form ----------

function wireStartForm() {
  const clientInput = el('clientId');
  const redirectInput = el('redirectUri');
  const stateInput = el('stateInput');
  const link = el('authorizeLink');
  const urlPreview = el('authUrl');

  clientInput.value = stored(STORAGE_CLIENT_ID) || CLIENT_ID;
  redirectInput.value = stored(STORAGE_REDIRECT) || REDIRECT_URI;
  stateInput.value = stored(STORAGE_STATE) || generateState();

  function refresh() {
    const clientId = clientInput.value.trim();
    const redirectUri = redirectInput.value.trim();
    const state = stateInput.value.trim();
    store(STORAGE_CLIENT_ID, clientId);
    store(STORAGE_REDIRECT, redirectUri);
    store(STORAGE_STATE, state);
    if (!clientId || !redirectUri) {
      link.classList.add('disabled');
      link.href = '#';
      urlPreview.textContent = '';
      return;
    }
    const url = authorizeUrl(clientId, redirectUri, state);
    link.classList.remove('disabled');
    link.href = url;
    urlPreview.textContent = url;
  }

  clientInput.addEventListener('input', refresh);
  redirectInput.addEventListener('input', refresh);
  stateInput.addEventListener('input', refresh);
  el('regenButton').addEventListener('click', () => {
    stateInput.value = generateState();
    refresh();
  });
  refresh();
}

// ---------- boot ----------

renderResult(new URLSearchParams(location.search));
wireStartForm();
