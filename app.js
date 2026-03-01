const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const PREFS_KEY = 'boulderingPreferences';

const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'Project'];
const STYLES = ['slab', 'vertical', 'overhang'];

const form = document.getElementById('entry-form');
const formError = document.getElementById('form-error');
const entriesBody = document.getElementById('entries-body');
const statsContainer = document.getElementById('stats');
const saveEntryButton = document.getElementById('save-entry');
const clearAllButton = document.getElementById('clear-all');

const filterGrade = document.getElementById('filter-grade');
const filterSent = document.getElementById('filter-sent');
const searchProblem = document.getElementById('search-problem');
const sortBy = document.getElementById('sort-by');

const signInButton = document.getElementById('sign-in');
const signOutButton = document.getElementById('sign-out');
const authEmailInput = document.getElementById('auth-email');
const signedOutView = document.getElementById('signed-out-view');
const signedInView = document.getElementById('signed-in-view');
const authUserEmail = document.getElementById('auth-user-email');
const syncStatus = document.getElementById('sync-status');

const exportJsonButton = document.getElementById('export-json');
const exportCsvButton = document.getElementById('export-csv');

const isSupabaseConfigured =
  SUPABASE_URL !== 'https://YOUR_PROJECT.supabase.co' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

const supabase = isSupabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let entries = [];
let currentUser = null;
let editingId = null;

initializeApp();

async function initializeApp() {
  loadPreferences();
  attachEventListeners();

  if (!supabase) {
    setSyncStatus('error', 'Error: add your Supabase URL and anon key in app.js.');
    setSignedOutUi();
    render();
    setDataActionsEnabled(false);
    return;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    setSyncStatus('error', `Error: ${error.message}`);
  }

  if (session?.user) {
    currentUser = session.user;
    setSignedInUi(currentUser.email);
    await refreshEntries();
  } else {
    setSignedOutUi();
    setSyncStatus('signed-out', 'Signed out');
    render();
    setDataActionsEnabled(false);
  }

  supabase.auth.onAuthStateChange(async (_event, sessionState) => {
    currentUser = sessionState?.user ?? null;

    if (currentUser) {
      setSignedInUi(currentUser.email);
      await refreshEntries();
      return;
    }

    entries = [];
    editingId = null;
    setSignedOutUi();
    setSyncStatus('signed-out', 'Signed out');
    setDataActionsEnabled(false);
    render();
  });
}

function attachEventListeners() {
  form.addEventListener('submit', handleSubmit);
  [filterGrade, filterSent, searchProblem, sortBy].forEach((control) => {
    control.addEventListener('input', render);
  });

  clearAllButton.addEventListener('click', clearAllEntries);
  signInButton.addEventListener('click', signInWithMagicLink);
  signOutButton.addEventListener('click', signOut);
  exportJsonButton.addEventListener('click', exportJson);
  exportCsvButton.addEventListener('click', exportCsv);
}

async function handleSubmit(event) {
  event.preventDefault();
  formError.textContent = '';

  if (!currentUser || !supabase) {
    formError.textContent = 'Please sign in to save climbs.';
    return;
  }

  const entry = readFormValues();
  if (!entry) {
    return;
  }

  setSyncStatus('syncing', 'Syncing...');
  const { error } = await supabase.from('climbs').insert(entry);

  if (error) {
    setSyncStatus('error', `Error: ${error.message}`);
    formError.textContent = 'Unable to save your climb. Try again.';
    return;
  }

  setLastGymPreference(entry.gym);
  form.reset();
  document.getElementById('attempts').value = 1;
  await refreshEntries();
}

async function clearAllEntries() {
  if (!entries.length || !currentUser || !supabase) {
    return;
  }

  const confirmed = window.confirm('Are you sure you want to delete all saved entries?');
  if (!confirmed) {
    return;
  }

  setSyncStatus('syncing', 'Syncing...');
  const { error } = await supabase.from('climbs').delete().eq('user_id', currentUser.id);

  if (error) {
    setSyncStatus('error', `Error: ${error.message}`);
    return;
  }

  entries = [];
  editingId = null;
  render();
  setSyncStatus('synced', 'Synced');
}

async function signInWithMagicLink() {
  if (!supabase) {
    setSyncStatus('error', 'Error: Supabase config missing.');
    return;
  }

  const email = authEmailInput.value.trim();
  if (!email) {
    window.alert('Enter your email first.');
    return;
  }

  setSyncStatus('syncing', 'Signing in...');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href,
    },
  });

  if (error) {
    setSyncStatus('error', `Error: ${error.message}`);
    return;
  }

  setSyncStatus('syncing', 'Check your email for the sign-in link.');
}

async function signOut() {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    setSyncStatus('error', `Error: ${error.message}`);
    return;
  }

  entries = [];
  editingId = null;
  render();
}

async function refreshEntries() {
  if (!currentUser || !supabase) {
    entries = [];
    render();
    return;
  }

  setDataActionsEnabled(false);
  setSyncStatus('syncing', 'Syncing...');

  const { data, error } = await supabase
    .from('climbs')
    .select('id, date, gym, problem, grade, attempts, sent, style, notes')
    .order('date', { ascending: false });

  if (error) {
    entries = [];
    render();
    setSyncStatus('error', `Error: ${error.message}`);
    return;
  }

  entries = data ?? [];
  render();
  setDataActionsEnabled(true);
  setSyncStatus('synced', 'Synced');
}

function readFormValues() {
  const date = document.getElementById('date').value;
  const gym = document.getElementById('gym').value.trim();
  const problem = document.getElementById('problem').value.trim();
  const attemptsValue = Number(document.getElementById('attempts').value);

  if (!date || !problem) {
    formError.textContent = 'Date and Problem name are required.';
    return null;
  }

  if (!Number.isInteger(attemptsValue) || attemptsValue < 1) {
    formError.textContent = 'Attempts must be a whole number of 1 or more.';
    return null;
  }

  return {
    user_id: currentUser.id,
    date,
    gym,
    problem,
    grade: document.getElementById('grade').value,
    attempts: attemptsValue,
    sent: document.getElementById('sent').checked,
    style: document.getElementById('style').value,
    notes: document.getElementById('notes').value.trim(),
  };
}

function render() {
  const filtered = getFilteredAndSortedEntries();
  renderTable(filtered);
  renderStats();
}

function getFilteredAndSortedEntries() {
  let result = [...entries];

  if (filterGrade.value !== 'All') {
    result = result.filter((entry) => entry.grade === filterGrade.value);
  }

  if (filterSent.checked) {
    result = result.filter((entry) => entry.sent);
  }

  const search = searchProblem.value.trim().toLowerCase();
  if (search) {
    result = result.filter((entry) => entry.problem.toLowerCase().includes(search));
  }

  const sortValue = sortBy.value;
  result.sort((a, b) => {
    if (sortValue === 'oldest') {
      return new Date(a.date) - new Date(b.date);
    }

    if (sortValue === 'highest-grade') {
      return gradeRank(b.grade) - gradeRank(a.grade);
    }

    if (sortValue === 'most-attempts') {
      return b.attempts - a.attempts;
    }

    return new Date(b.date) - new Date(a.date);
  });

  return result;
}

function renderTable(displayEntries) {
  if (!displayEntries.length) {
    entriesBody.innerHTML = '<tr><td colspan="10" class="empty">No entries match your filters yet.</td></tr>';
    return;
  }

  entriesBody.innerHTML = displayEntries
    .map((entry) => {
      if (editingId === entry.id) {
        return renderEditRow(entry);
      }

      return `
        <tr>
          <td>${escapeHtml(entry.date)}</td>
          <td>${escapeHtml(entry.gym)}</td>
          <td>${escapeHtml(entry.problem)}</td>
          <td>${escapeHtml(entry.grade)}</td>
          <td>${entry.attempts}</td>
          <td>${entry.sent ? 'Yes' : 'No'}</td>
          <td>${escapeHtml(entry.style)}</td>
          <td>${escapeHtml(entry.notes)}</td>
          <td><button type="button" data-edit="${entry.id}">Edit</button></td>
          <td><button type="button" class="danger" data-delete="${entry.id}">Delete</button></td>
        </tr>
      `;
    })
    .join('');

  attachTableActions();
}

function renderEditRow(entry) {
  return `
    <tr>
      <td><input class="cell-edit" type="date" data-field="date" value="${escapeHtml(entry.date)}" /></td>
      <td><input class="cell-edit" type="text" data-field="gym" value="${escapeHtml(entry.gym)}" /></td>
      <td><input class="cell-edit" type="text" data-field="problem" value="${escapeHtml(entry.problem)}" /></td>
      <td>
        <select class="cell-edit" data-field="grade">
          ${GRADES.map((grade) => `<option value="${grade}" ${grade === entry.grade ? 'selected' : ''}>${grade}</option>`).join('')}
        </select>
      </td>
      <td><input class="cell-edit" type="number" min="1" data-field="attempts" value="${entry.attempts}" /></td>
      <td><input type="checkbox" data-field="sent" ${entry.sent ? 'checked' : ''} /></td>
      <td>
        <select class="cell-edit" data-field="style">
          ${STYLES.map((style) => `<option value="${style}" ${style === entry.style ? 'selected' : ''}>${style}</option>`).join('')}
        </select>
      </td>
      <td><input class="cell-edit" type="text" data-field="notes" value="${escapeHtml(entry.notes)}" /></td>
      <td><button type="button" data-save="${entry.id}">Save</button></td>
      <td><button type="button" class="secondary" data-cancel="${entry.id}">Cancel</button></td>
    </tr>
  `;
}

function attachTableActions() {
  entriesBody.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      editingId = button.dataset.edit;
      render();
    });
  });

  entriesBody.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.delete;
      await deleteEntry(id);
    });
  });

  entriesBody.querySelectorAll('[data-cancel]').forEach((button) => {
    button.addEventListener('click', () => {
      editingId = null;
      render();
    });
  });

  entriesBody.querySelectorAll('[data-save]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('tr');
      const id = button.dataset.save;
      await saveEditedEntry(id, row);
    });
  });
}

async function deleteEntry(id) {
  if (!supabase || !currentUser) {
    return;
  }

  setSyncStatus('syncing', 'Syncing...');
  const { error } = await supabase.from('climbs').delete().eq('id', id);

  if (error) {
    setSyncStatus('error', `Error: ${error.message}`);
    return;
  }

  if (editingId === id) {
    editingId = null;
  }

  await refreshEntries();
}

async function saveEditedEntry(id, row) {
  if (!supabase || !currentUser) {
    return;
  }

  const updated = {
    date: row.querySelector('[data-field="date"]').value,
    gym: row.querySelector('[data-field="gym"]').value.trim(),
    problem: row.querySelector('[data-field="problem"]').value.trim(),
    grade: row.querySelector('[data-field="grade"]').value,
    attempts: Number(row.querySelector('[data-field="attempts"]').value),
    sent: row.querySelector('[data-field="sent"]').checked,
    style: row.querySelector('[data-field="style"]').value,
    notes: row.querySelector('[data-field="notes"]').value.trim(),
  };

  if (!updated.date || !updated.problem || !Number.isInteger(updated.attempts) || updated.attempts < 1) {
    window.alert('Please provide valid Date, Problem, and Attempts (minimum 1).');
    return;
  }

  setSyncStatus('syncing', 'Syncing...');
  const { error } = await supabase.from('climbs').update(updated).eq('id', id);

  if (error) {
    setSyncStatus('error', `Error: ${error.message}`);
    return;
  }

  editingId = null;
  setLastGymPreference(updated.gym);
  await refreshEntries();
}

function renderStats() {
  const totalEntries = entries.length;
  const totalSends = entries.filter((entry) => entry.sent).length;
  const sendRate = totalEntries === 0 ? 0 : (totalSends / totalEntries) * 100;
  const highestGrade = findHighestGradeSent(entries);
  const sendsByGrade = countSendsByGrade(entries);

  const gradeLines = Object.entries(sendsByGrade)
    .map(([grade, count]) => `${grade}: ${count}`)
    .join(' • ');

  statsContainer.innerHTML = `
    <article class="stat-card">
      <p class="stat-title">Total Entries</p>
      <p class="stat-value">${totalEntries}</p>
    </article>
    <article class="stat-card">
      <p class="stat-title">Total Sends</p>
      <p class="stat-value">${totalSends}</p>
    </article>
    <article class="stat-card">
      <p class="stat-title">Send Rate</p>
      <p class="stat-value">${sendRate.toFixed(1)}%</p>
    </article>
    <article class="stat-card">
      <p class="stat-title">Highest Grade Sent</p>
      <p class="stat-value">${highestGrade}</p>
    </article>
    <article class="stat-card full-width">
      <p class="stat-title">Sends by Grade (V0–V10)</p>
      <p class="stat-value">${gradeLines}</p>
    </article>
  `;
}

function findHighestGradeSent(list) {
  const sentGrades = list
    .filter((entry) => entry.sent && entry.grade !== 'Project')
    .map((entry) => entry.grade);

  if (!sentGrades.length) {
    return 'N/A';
  }

  sentGrades.sort((a, b) => gradeRank(b) - gradeRank(a));
  return sentGrades[0];
}

function countSendsByGrade(list) {
  const counts = {};
  GRADES.filter((grade) => grade !== 'Project').forEach((grade) => {
    counts[grade] = 0;
  });

  list.forEach((entry) => {
    if (entry.sent && entry.grade !== 'Project') {
      counts[entry.grade] += 1;
    }
  });

  return counts;
}

function gradeRank(grade) {
  if (grade === 'Project') {
    return 11;
  }

  const numeric = Number(grade.replace('V', ''));
  return Number.isNaN(numeric) ? -1 : numeric;
}

function setSignedInUi(email) {
  signedOutView.classList.add('hidden');
  signedInView.classList.remove('hidden');
  authUserEmail.textContent = email || 'Unknown email';
}

function setSignedOutUi() {
  signedOutView.classList.remove('hidden');
  signedInView.classList.add('hidden');
  authUserEmail.textContent = '';
}

function setSyncStatus(status, message) {
  syncStatus.textContent = message;
  syncStatus.dataset.status = status;
}

function setDataActionsEnabled(enabled) {
  form.querySelectorAll('input, select, textarea, button').forEach((el) => {
    if (el.id !== 'sign-in' && el.id !== 'sign-out') {
      el.disabled = !enabled;
    }
  });

  filterGrade.disabled = !enabled;
  filterSent.disabled = !enabled;
  searchProblem.disabled = !enabled;
  sortBy.disabled = !enabled;
  saveEntryButton.disabled = !enabled;
  clearAllButton.disabled = !enabled;
  exportJsonButton.disabled = !enabled;
  exportCsvButton.disabled = !enabled;
}

function exportJson() {
  downloadFile('bouldering-climbs.json', JSON.stringify(entries, null, 2), 'application/json');
}

function exportCsv() {
  const headers = ['id', 'date', 'gym', 'problem', 'grade', 'attempts', 'sent', 'style', 'notes'];
  const rows = entries.map((entry) =>
    [
      entry.id,
      entry.date,
      entry.gym,
      entry.problem,
      entry.grade,
      entry.attempts,
      entry.sent,
      entry.style,
      entry.notes,
    ]
      .map(csvEscape)
      .join(','),
  );

  const csv = [headers.join(','), ...rows].join('\n');
  downloadFile('bouldering-climbs.csv', csv, 'text/csv;charset=utf-8;');
}

function csvEscape(value) {
  const stringValue = String(value ?? '');
  const escaped = stringValue.replaceAll('"', '""');
  return `"${escaped}"`;
}

function downloadFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function loadPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (typeof parsed.lastGym === 'string') {
      document.getElementById('gym').value = parsed.lastGym;
    }
  } catch {
    // Ignore malformed preference values.
  }
}

function setLastGymPreference(gym) {
  if (!gym) {
    return;
  }

  localStorage.setItem(PREFS_KEY, JSON.stringify({ lastGym: gym }));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
