let config = {};
let editingTaskId = null;

const statusMsg = document.getElementById("status-message");
const taskForm = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descInput = document.getElementById("task-description");
const submitBtn = document.getElementById("task-submit");
const taskList = document.getElementById("task-list");

function showMessage(text, isError = false) {
  statusMsg.textContent = text;
  statusMsg.className = isError ? "status-err" : "status-ok";
  setTimeout(() => {
    statusMsg.textContent = "";
    statusMsg.className = "";
  }, 4000);
}

async function apiRequest(endpoint, options = {}) {
  const url = `${config.supabaseUrl}/rest/v1${endpoint}`;
  const headers = {
    "apikey": config.supabasePublishableKey,
    "Authorization": `Bearer ${config.supabasePublishableKey}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error (${response.status}): ${errorBody || response.statusText}`);
  }
  return response.status !== 204 ? response.json() : null;
}

async function loadTasks() {
  try {
    const tasks = await apiRequest(`/${config.tableName}?select=*&order=id.desc`);
    renderTasks(tasks);
  } catch (err) {
    showMessage(`Failed to load tasks: ${err.message}`, true);
  }
}

function renderTasks(tasks) {
  taskList.innerHTML = "";
  tasks.forEach(task => {
    const item = document.createElement("div");
    item.className = `task-item ${task.completed ? "is-completed" : ""}`;
    item.dataset.id = task.id;

    item.innerHTML = `
      <div class="task-title"><strong>${escapeHtml(task.title)}</strong></div>
      <div class="task-description">${escapeHtml(task.description || "")}</div>
      <div class="task-status">Status: ${task.completed ? "Completed" : "Incomplete"}</div>
      <div class="task-actions">
        <button class="toggle-task">${task.completed ? "Mark Incomplete" : "Mark Complete"}</button>
        <button class="edit-task">Edit</button>
        <button class="delete-task">Delete</button>
      </div>
    `;

    item.querySelector(".toggle-task").addEventListener("click", () => toggleTask(task));
    item.querySelector(".edit-task").addEventListener("click", () => startEditTask(task));
    item.querySelector(".delete-task").addEventListener("click", () => deleteTask(task.id));

    taskList.appendChild(item);
  });
}

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const description = descInput.value.trim();

  if (!title) return;

  try {
    if (editingTaskId) {
      await apiRequest(`/${config.tableName}?id=eq.${editingTaskId}`, {
        method: "PATCH",
        body: JSON.stringify({ title, description })
      });
      showMessage("Task updated successfully.");
      resetForm();
    } else {
      await apiRequest(`/${config.tableName}`, {
        method: "POST",
        body: JSON.stringify({ title, description, completed: false })
      });
      showMessage("Task added successfully.");
      taskForm.reset();
    }
    await loadTasks();
  } catch (err) {
    showMessage(`Action failed: ${err.message}`, true);
  }
});

async function toggleTask(task) {
  try {
    await apiRequest(`/${config.tableName}?id=eq.${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: !task.completed })
    });
    showMessage("Task status updated.");
    await loadTasks();
  } catch (err) {
    showMessage(`Failed to toggle task: ${err.message}`, true);
  }
}

function startEditTask(task) {
  editingTaskId = task.id;
  titleInput.value = task.title;
  descInput.value = task.description || "";
  submitBtn.textContent = "Save Changes";
  window.scrollTo({ top: taskForm.offsetTop - 20, behavior: "smooth" });
}

function resetForm() {
  editingTaskId = null;
  taskForm.reset();
  submitBtn.textContent = "Add Task";
}

async function deleteTask(id) {
  if (!confirm("Are you sure you want to delete this task?")) return;
  try {
    await apiRequest(`/${config.tableName}?id=eq.${id}`, {
      method: "DELETE"
    });
    showMessage("Task deleted.");
    if (editingTaskId === id) resetForm();
    await loadTasks();
  } catch (err) {
    showMessage(`Failed to delete task: ${err.message}`, true);
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[tag] || tag));
}

(async function init() {
  try {
    const res = await fetch("config.json");
    if (!res.ok) throw new Error("Could not find config.json");
    config = await res.json();
    await loadTasks();
  } catch (err) {
    showMessage(`Initialization error: ${err.message}`, true);
  }
})();
