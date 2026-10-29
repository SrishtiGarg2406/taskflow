/* =====================================================
   TaskFlow - all the app logic lives in this one file.
   Sections:
   1. Settings and state
   2. Saving / loading (localStorage)
   3. Helpers (dates, safe text)
   4. Dashboard
   5. Task list (filter, search, sort, render)
   6. Form (add / edit with validation)
   7. Focus timer
   8. Start-up
   ===================================================== */

/* ---------- 1. Settings and state ---------- */
const STORAGE_KEY = "taskflow.tasks.v1";
const FOCUS_SECONDS = 25 * 60;
const PRIORITIES = ["Low", "Medium", "High"];
const CATEGORIES = ["Work", "Personal", "Study", "Health"];
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 }; // smaller = more important

let tasks = loadTasks();   // the single source of truth for all tasks
let editingId = null;      // id of the task being edited (null = adding new)

const timer = {
  state: "idle",           // idle | running | paused | done
  remaining: FOCUS_SECONDS,
  endTime: 0,
  intervalId: null
};

/* Shortcut for document.getElementById */
const $ = (id) => document.getElementById(id);

/* ---------- 2. Saving / loading ---------- */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    // Keep only valid tasks and repair missing fields
    return data
      .filter((t) => t && typeof t.id === "string" && typeof t.title === "string" && t.title.trim() !== "")
      .map((t) => ({
        id: t.id,
        title: t.title.trim(),
        description: typeof t.description === "string" ? t.description : "",
        priority: PRIORITIES.includes(t.priority) ? t.priority : "Medium",
        category: CATEGORIES.includes(t.category) ? t.category : "Personal",
        due: /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : "",
        completed: t.completed === true,
        createdAt: Number(t.createdAt) || Date.now(),
        focusSessions: Number(t.focusSessions) || 0
      }));
  } catch (error) {
    // Corrupted data or storage blocked: start with an empty list instead of crashing
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    showToast("Could not save. Browser storage may be full or blocked.", true);
  }
}

/* ---------- 3. Helpers ---------- */
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Today as YYYY-MM-DD in the user's LOCAL time (not UTC) */
function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

/* A task is overdue only if it is NOT completed and its due date is before today */
function isOverdue(task) {
  return !task.completed && task.due !== "" && task.due < todayString();
}

function formatDate(dateString) {
  if (!dateString) return "No date";
  const d = new Date(dateString + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/* Stops user text from being treated as HTML (prevents broken layouts / XSS) */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let toastTimeout = null;
function showToast(message, isError = false) {
  const toast = $("toast");
  toast.textContent = message;
  toast.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.className = "toast"; }, 2500);
}

/* ---------- 4. Dashboard ---------- */
function updateDashboard() {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;                       // everything not completed
  const overdue = tasks.filter(isOverdue).length;          // pending AND past due
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  $("statTotal").textContent = total;
  $("statCompleted").textContent = completed;
  $("statPending").textContent = pending;
  $("statOverdue").textContent = overdue;
  $("statPercent").textContent = percent + "%";
  $("progressFill").style.width = percent + "%";
  $("progressTrack").setAttribute("aria-valuenow", percent);

  let text;
  if (total === 0) text = "Add a task to get started.";
  else if (percent === 100) text = "Amazing! All tasks are completed. 🎉";
  else text = completed + " of " + total + " tasks completed.";
  $("progressText").textContent = text;
}

/* ---------- 5. Task list ---------- */
function getVisibleTasks() {
  const search = $("search").value.trim().toLowerCase();
  const status = $("filterStatus").value;
  const priority = $("filterPriority").value;
  const category = $("filterCategory").value;
  const sortBy = $("sortBy").value;

  let list = tasks.filter((t) => {
    // search in title or description
    if (search && !(t.title.toLowerCase().includes(search) || t.description.toLowerCase().includes(search))) return false;
    // status
    if (status === "completed" && !t.completed) return false;
    if (status === "pending" && t.completed) return false;
    if (status === "overdue" && !isOverdue(t)) return false;
    // priority and category
    if (priority !== "all" && t.priority !== priority) return false;
    if (category !== "all" && t.category !== category) return false;
    return true;
  });

  list = list.slice(); // copy so sorting never changes the saved order
  if (sortBy === "due") {
    list.sort((a, b) => (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99"));
  } else if (sortBy === "priority") {
    list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  } else {
    list.sort((a, b) => b.createdAt - a.createdAt);
  }
  return list;
}

function renderTasks() {
  const list = getVisibleTasks();
  const ul = $("taskList");
  const empty = $("emptyState");

  ul.innerHTML = list.map(taskHtml).join("");

  if (list.length === 0) {
    empty.hidden = false;
    if (tasks.length === 0) {
      empty.innerHTML = "<strong>No tasks yet</strong>Use the form to add your first task.";
    } else {
      empty.innerHTML = "<strong>No tasks match your filters</strong>Try changing the search or click \"Clear filters\".";
    }
  } else {
    empty.hidden = true;
  }
}

function taskHtml(t) {
  const overdue = isOverdue(t);
  const statusBadge = t.completed
    ? '<span class="badge completed">Completed</span>'
    : overdue ? '<span class="badge overdue">Overdue</span>' : "";
  const focusBadge = t.focusSessions > 0
    ? '<span class="badge">🍅 ' + t.focusSessions + " focus session" + (t.focusSessions > 1 ? "s" : "") + "</span>"
    : "";
  const desc = t.description ? '<p class="task-desc">' + escapeHtml(t.description) + "</p>" : "";

  return (
    '<li class="task p-' + t.priority + (t.completed ? " done" : "") + '">' +
      '<div class="task-top"><div>' +
        '<div class="task-title">' + escapeHtml(t.title) + "</div>" + desc +
      "</div></div>" +
      '<div class="badges">' +
        '<span class="badge ' + t.priority + '">' + t.priority + "</span>" +
        '<span class="badge">' + t.category + "</span>" +
        '<span class="badge date">📅 ' + formatDate(t.due) + "</span>" +
        statusBadge + focusBadge +
      "</div>" +
      '<div class="task-actions">' +
        '<button class="btn btn-small" data-action="toggle" data-id="' + t.id + '">' +
          (t.completed ? "Reopen" : "Mark done") + "</button>" +
        '<button class="btn btn-small" data-action="edit" data-id="' + t.id + '">Edit</button>' +
        '<button class="btn btn-small btn-danger" data-action="delete" data-id="' + t.id + '">Delete</button>' +
      "</div>" +
    "</li>"
  );
}

/* One click listener for all task buttons ("event delegation") */
$("taskList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "toggle") toggleTask(id);
  if (action === "edit") startEdit(id);
  if (action === "delete") deleteTask(id);
});

function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  refresh();
  showToast(task.completed ? "Task completed ✅" : "Task reopened");
}

function deleteTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  const sure = confirm('Delete "' + task.title + '"? This cannot be undone.');
  if (!sure) return;

  tasks = tasks.filter((t) => t.id !== id);
  if (editingId === id) resetForm();
  saveTasks();
  refresh();
  showToast("Task deleted");
}

/* Filter controls: any change re-draws the list */
["search", "filterStatus", "filterPriority", "filterCategory", "sortBy"].forEach((id) => {
  $(id).addEventListener("input", renderTasks);
});

$("clearFilters").addEventListener("click", () => {
  $("search").value = "";
  $("filterStatus").value = "all";
  $("filterPriority").value = "all";
  $("filterCategory").value = "all";
  $("sortBy").value = "due";
  renderTasks();
});

/* ---------- 6. Form (add / edit) ---------- */
function validateForm() {
  const title = $("title").value.trim();
  const due = $("due").value;
  let valid = true;

  $("titleError").textContent = "";
  $("dueError").textContent = "";

  if (title === "") {
    $("titleError").textContent = "Please enter a task title.";
    valid = false;
  } else if (title.length < 3) {
    $("titleError").textContent = "Title must be at least 3 characters.";
    valid = false;
  }

  if (due === "") {
    $("dueError").textContent = "Please choose a due date.";
    valid = false;
  }
  return valid;
}

$("taskForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateForm()) return;

  const data = {
    title: $("title").value.trim(),
    description: $("description").value.trim(),
    priority: $("priority").value,
    category: $("category").value,
    due: $("due").value
  };

  if (editingId) {
    const task = tasks.find((t) => t.id === editingId);
    if (task) Object.assign(task, data);
    showToast("Task updated");
  } else {
    tasks.push({ id: newId(), completed: false, createdAt: Date.now(), focusSessions: 0, ...data });
    showToast("Task added");
  }

  saveTasks();
  resetForm();
  refresh();
});

function startEdit(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  editingId = id;
  $("title").value = task.title;
  $("description").value = task.description;
  $("priority").value = task.priority;
  $("category").value = task.category;
  $("due").value = task.due;
  $("formTitle").textContent = "Edit task";
  $("saveBtn").textContent = "Save changes";
  $("cancelBtn").hidden = false;
  $("titleError").textContent = "";
  $("dueError").textContent = "";
  $("title").focus();
  $("taskForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetForm() {
  editingId = null;
  $("taskForm").reset();
  $("formTitle").textContent = "Add a task";
  $("saveBtn").textContent = "Add task";
  $("cancelBtn").hidden = true;
  $("titleError").textContent = "";
  $("dueError").textContent = "";
}

$("cancelBtn").addEventListener("click", resetForm);

/* ---------- 7. Focus timer ---------- */
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function updateTimerDisplay() {
  $("timerDisplay").textContent = formatTime(timer.remaining);
  document.title = timer.state === "running"
    ? formatTime(timer.remaining) + " - TaskFlow"
    : "TaskFlow - Smart Task & Productivity App";
}

function updateTimerButtons() {
  const main = $("timerMain");
  if (timer.state === "running") main.textContent = "Pause";
  else if (timer.state === "paused") main.textContent = "Resume";
  else main.textContent = "Start";
}

/* Fill the "task to focus on" dropdown with pending tasks (keeps current choice) */
function updateTimerTaskList() {
  const select = $("timerTask");
  const previous = select.value;
  const pendingTasks = tasks.filter((t) => !t.completed);

  select.innerHTML =
    '<option value="">No specific task</option>' +
    pendingTasks.map((t) => '<option value="' + t.id + '">' + escapeHtml(t.title) + "</option>").join("");

  if (pendingTasks.some((t) => t.id === previous)) select.value = previous;
}

function startTimer() {
  // Safety: never allow two countdowns at the same time
  if (timer.intervalId !== null) clearInterval(timer.intervalId);

  if (timer.state === "done") timer.remaining = FOCUS_SECONDS;

  timer.endTime = Date.now() + timer.remaining * 1000;
  timer.state = "running";
  $("timerMessage").textContent = "";
  timer.intervalId = setInterval(tick, 250);
  updateTimerButtons();
  updateTimerDisplay();
}

function pauseTimer() {
  clearInterval(timer.intervalId);
  timer.intervalId = null;
  timer.remaining = Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
  timer.state = "paused";
  updateTimerButtons();
  updateTimerDisplay();
}

function resetTimer() {
  clearInterval(timer.intervalId);
  timer.intervalId = null;
  timer.state = "idle";
  timer.remaining = FOCUS_SECONDS;
  $("timerMessage").textContent = "";
  updateTimerButtons();
  updateTimerDisplay();
}

function tick() {
  // Using the end time (not "minus 1 each tick") keeps the timer accurate
  timer.remaining = Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
  updateTimerDisplay();
  if (timer.remaining <= 0) finishTimer();
}

function finishTimer() {
  clearInterval(timer.intervalId);
  timer.intervalId = null;
  timer.state = "done";
  timer.remaining = 0;

  const task = tasks.find((t) => t.id === $("timerTask").value);
  if (task) {
    task.focusSessions += 1;
    saveTasks();
    renderTasks();
    $("timerMessage").textContent = "🎉 Focus session complete for \"" + task.title + "\"! Take a short break.";
  } else {
    $("timerMessage").textContent = "🎉 Focus session complete! Take a short break.";
  }
  showToast("Focus session complete 🎉");
  updateTimerButtons();
  updateTimerDisplay();
}

$("timerMain").addEventListener("click", () => {
  if (timer.state === "running") pauseTimer();
  else startTimer();            // idle, paused (resume) or done
});
$("timerReset").addEventListener("click", resetTimer);

/* ---------- 8. Start-up ---------- */
/* Redraw everything that depends on the task list */
function refresh() {
  updateDashboard();
  renderTasks();
  updateTimerTaskList();
}

refresh();
updateTimerDisplay();
updateTimerButtons();

/* If the tab stays open past midnight, "overdue" status can change: re-check every minute */
setInterval(() => { updateDashboard(); renderTasks(); }, 60000);
