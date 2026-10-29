# TaskFlow - Smart Task & Productivity App

A simple, responsive web app to manage daily tasks and track productivity. Built with plain HTML, CSS and JavaScript (no frameworks, no build step).

## Features
- Add, edit, delete (with confirmation), complete and reopen tasks
- Title, optional description, priority (Low/Medium/High), category (Work/Personal/Study/Health), due date
- Input validation with clear error messages
- Dashboard: total, completed, pending, overdue, completion % and a progress bar (updates automatically)
- Search (title/description), filters (status, priority, category), sorting (due date, priority, recently created), clear filters, empty states
- Focus Timer (25 minutes): start, pause, resume, reset, link a session to a task, completion message
- Data saved in browser localStorage
- Responsive layout for desktop, tablet and mobile

## Run on your laptop
1. Put `index.html`, `style.css`, `script.js` in one folder.
2. Double-click `index.html`. It opens in your browser. No installation needed.

## Deploy (free)
**Netlify Drop (fastest):** go to https://app.netlify.com/drop and drag the folder onto the page. You get a live URL.

**GitHub Pages:** create a GitHub repository, upload the files, then Settings > Pages > Deploy from branch `main` / root. The URL is shown after a minute.

## How the calculations work
- Total = number of tasks
- Completed = tasks marked done
- Pending = Total - Completed
- Overdue = tasks that are NOT completed and whose due date is before today (completed tasks are never overdue)
- Completion % = Completed / Total x 100, rounded (0% when there are no tasks)

## How data is saved
All tasks are stored as JSON in `localStorage` under the key `taskflow.tasks.v1`. On load, the app validates the data and ignores anything corrupted.

## Known limitations
- localStorage is per browser and per device. Tasks do NOT sync to other devices or browsers, and clearing browser data deletes them.
- To sync across devices you would add a backend with a database (for example Node + PostgreSQL or Firebase/Supabase) and user login (authentication), so each user's tasks are stored on a server and loaded after signing in.
- The timer keeps running only while the tab is open.

## Key decisions (and why)
- **Plain HTML/CSS/JS instead of React:** the goal is to show I understand the basics. No build tools means fewer things to break, and I can explain every line.
- **localStorage for saving:** the simplest reliable option for version 1. The trade-off is that data is not shared across devices.
- **One `tasks` array as the single source of truth:** every change updates this array, saves it, then redraws the dashboard and list. This keeps the numbers and the list always consistent.
- **Overdue = not completed AND due date before today:** compared as local-date text (YYYY-MM-DD) to avoid time-zone bugs.
- **Pending includes overdue tasks:** pending means "not completed", and overdue is the subset of pending that is late.
- **Safe text:** user text is escaped before it is shown, so odd characters like `<` cannot break the page.
- **Extra feature: Focus Timer.** Problem solved: a to-do list tells you what to do but not how to start. A 25-minute focus session (Pomodoro technique) helps with procrastination. It is linked to a task, and each finished session is counted on that task. The timer uses an end time instead of "subtract 1 each second", and clears any old timer before starting, so it stays accurate and never runs twice.

## Review discussion: short honest answers
1. **What I decided first:** plain HTML/CSS/JS, localStorage, one page, and Focus Timer as the extra feature.
2. **Priorities:** core task operations, correct dashboard maths, persistence, then search/filters, then responsive design, then the timer.
3. **Edge cases:** empty or too-short title, missing due date, corrupted saved data, completed tasks never overdue, no tasks (0% not NaN), no matching filters (empty state), repeated Start clicks on the timer, special characters in text.
4. **AI suggestions I changed:** write your own here, for example: "I simplified the project from React to plain JavaScript" and anything else you actually changed or rejected.
5. **Tasks missing on another device:** localStorage belongs to one browser on one device, so this is expected. To fix it I would add a backend with a database and login, save tasks on the server linked to the user's account, and load them after sign-in.
6. **One more day:** a backend + login for syncing, then automated tests, then due-date reminders.
7. **How saving works:** every change calls `saveTasks()` which stores the array as JSON in localStorage; on page load `loadTasks()` reads it back and ignores invalid data.
8. **Live change example (confirm before delete):** already implemented in `deleteTask()` using `confirm()`. To change the wording or use a custom pop-up, only that function needs editing.

## Manual test checklist
Note: these have not been run in a browser yet. Only a JavaScript syntax check was done. Please run through this list yourself before submitting.
- [ ] Add a task; edit it; mark done; reopen; delete (confirm appears)
- [ ] Submit empty title / no date: error messages appear
- [ ] Add a task with a past due date: shows Overdue; mark done: no longer overdue
- [ ] Dashboard numbers match the list; percentage correct
- [ ] Search + filters + sort work together; Clear filters resets; empty state shows
- [ ] Refresh the page: tasks are still there
- [ ] Timer: start, pause, resume, reset; clicking Start repeatedly never speeds it up
- [ ] Resize to phone width: layout stacks, nothing breaks
