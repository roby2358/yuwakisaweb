// schflow — Schwab OAuth authorization-code helper.
// Client-side only: nothing on this page talks to any server.

const AUTHORIZE_ENDPOINT = 'https://api.schwabapi.com/v1/oauth/authorize';
const LITTLEBRAIN_RETURN = 'http://localhost:8767/schwab/oauth-return';
const CLIENT_ID = '';
const REDIRECT_URI = 'https://yuwakisa.com/schflow/';
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

// The form below is only one way in. littlebrain starts its own sign-ins with
// its own state and checks that state itself, so a mismatch here is expected
// for those and doesn't block the handoff.
const STATE_VERDICTS = {
  unknown: { mark: '?', text: 'No sent state in this browser to compare against; eyeball it.' },
  ok:      { mark: '\u2713', text: 'State matches what this page sent.' },
  other:   { mark: '\u2260', text: 'Not the state this page sent. If littlebrain started this sign-in, it checks the state itself.' },
};

function compareState(sent, got) {
  if (!sent) return 'unknown';
  return sent === got ? 'ok' : 'other';
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

function littlebrainUrl(code, state) {
  const params = new URLSearchParams({ code: code, state: state });
  return LITTLEBRAIN_RETURN + '?' + params.toString();
}

function wireLittlebrainLink(code, state) {
  const link = el('littlebrainLink');
  link.href = littlebrainUrl(code, state);
  el('littlebrainNote').textContent =
    'Sends the code and state to ' + LITTLEBRAIN_RETURN + ' on this machine.';
  link.addEventListener('click', () => console.log('Going to ' + link.href));
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
  wireLittlebrainLink(code, returned);

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
