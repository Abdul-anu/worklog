/* ============================================
   WORKPULSE — Application Logic
   ============================================ */

class WorkPulseApp {
    constructor() {
        this.data = this.loadData();
        this.timerInterval = null;
        this.clockInterval = null;
        this.currentWeekOffset = 0;
        this.currentFilter = 'all';

        this.init();
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    init() {
        this.startClock();
        this.updateGreeting();
        this.setupNavigation();
        this.setupSidebar();
        this.restoreCheckinState();
        this.renderDashboard();
        this.renderTimeTracking();
        this.renderTasks();
        this.renderWeeklyPlan();
        this.renderHistory();
        this.renderAnalytics();

        // Update date text
        const now = new Date();
        document.getElementById('dateText').textContent = now.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // ==========================================
    // DATA MANAGEMENT
    // ==========================================

    loadData() {
        const saved = localStorage.getItem('workpulse_data');
        if (saved) return JSON.parse(saved);

        return {
            checkins: {},       // { "2024-01-15": { checkin: "09:00", checkout: "17:00", activities: [] } }
            tasks: [],          // [{ id, title, description, priority, category, status, date, createdAt }]
            weeklyPlans: {},    // { "2024-01-15": [{ text, done }] }
            currentActivity: '',
            userName: 'Employee'
        };
    }

    saveData() {
        localStorage.setItem('workpulse_data', JSON.stringify(this.data));
    }

    getTodayKey() {
        return new Date().toISOString().split('T')[0];
    }

    getTodayRecord() {
        const key = this.getTodayKey();
        if (!this.data.checkins[key]) {
            this.data.checkins[key] = { checkin: null, checkout: null, activities: [] };
        }
        return this.data.checkins[key];
    }

    // ==========================================
    // CLOCK & GREETING
    // ==========================================

    startClock() {
        const updateClock = () => {
            const now = new Date();
            document.getElementById('clockTime').textContent = now.toLocaleTimeString('en-US', {
                hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        };
        updateClock();
        this.clockInterval = setInterval(updateClock, 1000);
    }

    updateGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good Evening';
        if (hour < 12) greeting = 'Good Morning';
        else if (hour < 17) greeting = 'Good Afternoon';
        document.getElementById('greetingText').textContent = `${greeting} 👋`;
    }

    // ==========================================
    // NAVIGATION
    // ==========================================

    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                if (page) this.navigateTo(page);
            });
        });
    }

    navigateTo(page) {
        // Update nav links
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');

        // Update pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) {
            pageEl.classList.add('active');
            // Re-render on navigation
            if (page === 'tasks') this.renderTasks();
            if (page === 'weekly') this.renderWeeklyPlan();
            if (page === 'timetrack') this.renderTimeTracking();
            if (page === 'history') this.renderHistory();
            if (page === 'analytics') this.renderAnalytics();
            if (page === 'dashboard') this.renderDashboard();
        }

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('mobile-open');
    }

    // ==========================================
    // SIDEBAR
    // ==========================================

    setupSidebar() {
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        });
    }

    // ==========================================
    // CHECK-IN / CHECK-OUT
    // ==========================================

    checkIn() {
        const record = this.getTodayRecord();
        if (record.checkin && !record.checkout) {
            this.showToast('You are already checked in!', 'warning');
            return;
        }

        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

        record.checkin = time;
        record.checkout = null;
        record.checkinTimestamp = now.getTime();
        record.activities.push({ time, type: 'checkin', text: 'Checked in' });

        this.saveData();
        this.startTimer();
        this.updateCheckinUI();
        this.renderDashboard();
        this.showToast('Checked in successfully! ✅', 'success');
    }

    checkOut() {
        const record = this.getTodayRecord();
        if (!record.checkin) {
            this.showToast('You haven\'t checked in yet!', 'warning');
            return;
        }
        if (record.checkout) {
            this.showToast('You already checked out today!', 'warning');
            return;
        }

        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

        record.checkout = time;
        record.checkoutTimestamp = now.getTime();
        record.activities.push({ time, type: 'checkout', text: 'Checked out' });

        this.saveData();
        this.stopTimer();
        this.updateCheckinUI();
        this.renderDashboard();
        this.showToast('Checked out successfully! 👋', 'success');
    }

    restoreCheckinState() {
        const record = this.getTodayRecord();
        if (record.checkin && !record.checkout) {
            this.startTimer();
        }
        this.updateCheckinUI();
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        const updateTimer = () => {
            const record = this.getTodayRecord();
            if (!record.checkinTimestamp) return;

            const elapsed = Date.now() - record.checkinTimestamp;
            const hours = Math.floor(elapsed / 3600000);
            const mins = Math.floor((elapsed % 3600000) / 60000);
            const secs = Math.floor((elapsed % 60000) / 1000);

            document.getElementById('timerValue').textContent =
                `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            // Update ring (complete circle = 8 hours)
            const progress = Math.min(elapsed / (8 * 3600000), 1);
            const circumference = 2 * Math.PI * 90;
            const offset = circumference * (1 - progress);
            const progressEl = document.getElementById('timerProgress');
            if (progressEl) progressEl.style.strokeDashoffset = offset;

            // Update stat
            document.getElementById('statHours').textContent = `${hours}h ${mins}m`;
        };

        updateTimer();
        this.timerInterval = setInterval(updateTimer, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateCheckinUI() {
        const record = this.getTodayRecord();
        const btnCheckin = document.getElementById('btnCheckin');
        const btnCheckout = document.getElementById('btnCheckout');
        const badge = document.getElementById('checkinStatusBadge');

        // Update stat cards
        document.getElementById('statCheckin').textContent = record.checkin || '--:--';
        document.getElementById('statCheckout').textContent = record.checkout || '--:--';

        if (record.checkin && !record.checkout) {
            // Currently checked in
            btnCheckin.disabled = true;
            btnCheckout.disabled = false;
            badge.innerHTML = '<div class="status-indicator online"></div><span>Checked In</span>';
        } else if (record.checkin && record.checkout) {
            // Already checked out
            btnCheckin.disabled = true;
            btnCheckout.disabled = true;
            badge.innerHTML = '<div class="status-indicator offline"></div><span>Day Complete</span>';

            // Calculate hours worked
            if (record.checkinTimestamp && record.checkoutTimestamp) {
                const elapsed = record.checkoutTimestamp - record.checkinTimestamp;
                const hours = Math.floor(elapsed / 3600000);
                const mins = Math.floor((elapsed % 3600000) / 60000);
                document.getElementById('statHours').textContent = `${hours}h ${mins}m`;
                document.getElementById('timerValue').textContent =
                    `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
            }
        } else {
            // Not checked in
            btnCheckin.disabled = false;
            btnCheckout.disabled = true;
            badge.innerHTML = '<div class="status-indicator offline"></div><span>Not Checked In</span>';
        }
    }

    saveCurrentActivity() {
        const input = document.getElementById('currentActivity');
        const text = input.value.trim();
        if (!text) return;

        const record = this.getTodayRecord();
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        record.activities.push({ time, type: 'activity', text });
        this.data.currentActivity = text;
        this.saveData();
        input.value = '';
        this.renderDashboard();
        this.showToast('Activity logged!', 'info');
    }

    // ==========================================
    // TASKS
    // ==========================================

    addTask() {
        const title = document.getElementById('taskTitle').value.trim();
        if (!title) {
            this.showToast('Please enter a task title', 'warning');
            return;
        }

        const task = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            title,
            description: document.getElementById('taskDescription').value.trim(),
            priority: document.getElementById('taskPriority').value,
            category: document.getElementById('taskCategory').value,
            status: 'pending',
            date: this.getTodayKey(),
            createdAt: new Date().toISOString()
        };

        this.data.tasks.push(task);
        this.saveData();

        // Clear form
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';

        // Log activity
        const record = this.getTodayRecord();
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        record.activities.push({ time, type: 'task', text: `Added task: ${title}` });
        this.saveData();

        this.renderTasks();
        this.renderDashboard();
        this.showToast('Task added successfully!', 'success');
    }

    addQuickTask() {
        const input = document.getElementById('quickTaskInput');
        const title = input.value.trim();
        if (!title) return;

        const task = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            title,
            description: '',
            priority: 'medium',
            category: 'other',
            status: 'pending',
            date: this.getTodayKey(),
            createdAt: new Date().toISOString()
        };

        this.data.tasks.push(task);
        this.saveData();
        input.value = '';
        this.renderDashboard();
        this.renderTasks();
        this.showToast('Task added!', 'success');
    }

    toggleTask(id) {
        const task = this.data.tasks.find(t => t.id === id);
        if (!task) return;

        if (task.status === 'completed') {
            task.status = 'pending';
        } else {
            task.status = 'completed';
            task.completedAt = new Date().toISOString();

            const record = this.getTodayRecord();
            const now = new Date();
            const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            record.activities.push({ time, type: 'task', text: `Completed: ${task.title}` });
        }

        this.saveData();
        this.renderTasks();
        this.renderDashboard();
    }

    cycleTaskStatus(id) {
        const task = this.data.tasks.find(t => t.id === id);
        if (!task) return;

        const order = ['pending', 'in-progress', 'completed'];
        const idx = order.indexOf(task.status);
        task.status = order[(idx + 1) % order.length];
        if (task.status === 'completed') task.completedAt = new Date().toISOString();

        this.saveData();
        this.renderTasks();
        this.renderDashboard();
    }

    deleteTask(id) {
        this.data.tasks = this.data.tasks.filter(t => t.id !== id);
        this.saveData();
        this.renderTasks();
        this.renderDashboard();
        this.showToast('Task deleted', 'info');
    }

    filterTasks(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        this.renderTasks();
    }

    // ==========================================
    // WEEKLY PLAN
    // ==========================================

    getWeekDates(offset = 0) {
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(now.getDate() - now.getDay() + 1 + (offset * 7));

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            days.push(d);
        }
        return days;
    }

    changeWeek(dir) {
        this.currentWeekOffset += dir;
        this.renderWeeklyPlan();
    }

    addWeeklyTask(dateKey) {
        const input = document.getElementById(`weekly-input-${dateKey}`);
        const text = input.value.trim();
        if (!text) return;

        if (!this.data.weeklyPlans[dateKey]) this.data.weeklyPlans[dateKey] = [];
        this.data.weeklyPlans[dateKey].push({ text, done: false });
        this.saveData();
        input.value = '';
        this.renderWeeklyPlan();
    }

    toggleWeeklyTask(dateKey, index) {
        if (this.data.weeklyPlans[dateKey] && this.data.weeklyPlans[dateKey][index]) {
            this.data.weeklyPlans[dateKey][index].done = !this.data.weeklyPlans[dateKey][index].done;
            this.saveData();
            this.renderWeeklyPlan();
        }
    }

    removeWeeklyTask(dateKey, index) {
        if (this.data.weeklyPlans[dateKey]) {
            this.data.weeklyPlans[dateKey].splice(index, 1);
            this.saveData();
            this.renderWeeklyPlan();
        }
    }

    // ==========================================
    // RENDERING
    // ==========================================

    renderDashboard() {
        const today = this.getTodayKey();
        const todayTasks = this.data.tasks.filter(t => t.date === today);
        const completed = todayTasks.filter(t => t.status === 'completed').length;

        document.getElementById('statTasks').textContent = `${completed} / ${todayTasks.length}`;

        // Render dashboard task list
        const container = document.getElementById('dashboardTaskList');
        if (todayTasks.length === 0) {
            container.innerHTML = `<div class="empty-state small">
                <i class="ri-checkbox-circle-line"></i>
                <p>No tasks for today yet</p>
            </div>`;
        } else {
            container.innerHTML = todayTasks.slice(0, 5).map(task => `
                <div class="task-item ${task.status === 'completed' ? 'completed' : ''}">
                    <div class="task-checkbox ${task.status === 'completed' ? 'checked' : ''}"
                         onclick="app.toggleTask('${task.id}')">
                        ${task.status === 'completed' ? '<i class="ri-check-line"></i>' : ''}
                    </div>
                    <div class="task-info">
                        <div class="task-title">${this.escapeHtml(task.title)}</div>
                        <div class="task-meta">
                            <span class="task-badge ${task.priority}">${task.priority}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Render timeline
        this.renderTimeline();
    }

    renderTimeline() {
        const record = this.getTodayRecord();
        const container = document.getElementById('activityTimeline');

        if (record.activities.length === 0) {
            container.innerHTML = `<div class="empty-state small">
                <i class="ri-history-line"></i>
                <p>No activity recorded today. Check in to start!</p>
            </div>`;
            return;
        }

        container.innerHTML = record.activities.map(act => `
            <div class="timeline-item ${act.type}">
                <span class="timeline-time">${act.time}</span>
                <div class="timeline-content">${this.escapeHtml(act.text)}</div>
            </div>
        `).join('');
    }

    renderTasks() {
        const today = this.getTodayKey();
        let tasks = this.data.tasks.filter(t => t.date === today);

        if (this.currentFilter !== 'all') {
            tasks = tasks.filter(t => t.status === this.currentFilter);
        }

        const allTodayTasks = this.data.tasks.filter(t => t.date === today);
        const completedCount = allTodayTasks.filter(t => t.status === 'completed').length;

        document.getElementById('completedCount').textContent = completedCount;
        document.getElementById('totalTaskCount').textContent = allTodayTasks.length;

        const percent = allTodayTasks.length > 0 ? Math.round((completedCount / allTodayTasks.length) * 100) : 0;
        document.getElementById('progressPercent').textContent = `${percent}%`;
        document.getElementById('taskProgressFill').style.width = `${percent}%`;

        const container = document.getElementById('tasksContainer');

        if (tasks.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <i class="ri-task-line"></i>
                <h3>${this.currentFilter !== 'all' ? 'No ' + this.currentFilter + ' tasks' : 'No tasks yet'}</h3>
                <p>${this.currentFilter !== 'all' ? 'Try a different filter' : 'Add your first task above to get started'}</p>
            </div>`;
            return;
        }

        // Sort: pending first, then in-progress, then completed. High priority first within each.
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const statusOrder = { 'in-progress': 0, pending: 1, completed: 2 };
        tasks.sort((a, b) => {
            if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        container.innerHTML = tasks.map(task => `
            <div class="task-item ${task.status === 'completed' ? 'completed' : ''}">
                <div class="task-checkbox ${task.status === 'completed' ? 'checked' : ''}"
                     onclick="app.toggleTask('${task.id}')">
                    ${task.status === 'completed' ? '<i class="ri-check-line"></i>' : ''}
                </div>
                <div class="task-info">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    <div class="task-meta">
                        <span class="task-badge ${task.priority}">${task.priority}</span>
                        <span class="task-category">${this.getCategoryEmoji(task.category)} ${task.category}</span>
                        ${task.description ? `<span>— ${this.escapeHtml(task.description)}</span>` : ''}
                    </div>
                </div>
                <span class="task-status-badge ${task.status}">${task.status.replace('-', ' ')}</span>
                <div class="task-actions">
                    <button class="task-action-btn progress-btn" onclick="app.cycleTaskStatus('${task.id}')" title="Cycle status">
                        <i class="ri-loop-left-line"></i>
                    </button>
                    <button class="task-action-btn" onclick="app.deleteTask('${task.id}')" title="Delete">
                        <i class="ri-delete-bin-6-line"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderTimeTracking() {
        const weekDates = this.getWeekDates(0);
        const today = this.getTodayKey();
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        const tbody = document.getElementById('attendanceTableBody');
        let totalMinutes = 0;
        let daysPresent = 0;

        tbody.innerHTML = weekDates.map((date, i) => {
            const key = date.toISOString().split('T')[0];
            const record = this.data.checkins[key] || {};
            const isToday = key === today;

            let duration = '--';
            let minutes = 0;
            if (record.checkinTimestamp && record.checkoutTimestamp) {
                minutes = Math.round((record.checkoutTimestamp - record.checkinTimestamp) / 60000);
                const h = Math.floor(minutes / 60);
                const m = minutes % 60;
                duration = `${h}h ${m}m`;
                totalMinutes += minutes;
                daysPresent++;
            } else if (record.checkinTimestamp && !record.checkoutTimestamp && isToday) {
                minutes = Math.round((Date.now() - record.checkinTimestamp) / 60000);
                const h = Math.floor(minutes / 60);
                const m = minutes % 60;
                duration = `${h}h ${m}m (ongoing)`;
                totalMinutes += minutes;
                daysPresent++;
            }

            let status = '<span class="table-status absent">—</span>';
            if (isToday) status = '<span class="table-status today">Today</span>';
            else if (record.checkin) status = '<span class="table-status present">Present</span>';

            return `<tr>
                <td><strong>${dayNames[i]}</strong></td>
                <td>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                <td>${record.checkin || '--:--'}</td>
                <td>${record.checkout || '--:--'}</td>
                <td>${duration}</td>
                <td>${status}</td>
            </tr>`;
        }).join('');

        // Weekly chart
        const chartContainer = document.getElementById('weeklyHoursChart');
        const maxH = 10;
        chartContainer.innerHTML = weekDates.map((date, i) => {
            const key = date.toISOString().split('T')[0];
            const record = this.data.checkins[key] || {};
            let hours = 0;
            if (record.checkinTimestamp && record.checkoutTimestamp) {
                hours = (record.checkoutTimestamp - record.checkinTimestamp) / 3600000;
            } else if (record.checkinTimestamp && !record.checkoutTimestamp && key === today) {
                hours = (Date.now() - record.checkinTimestamp) / 3600000;
            }
            const pct = Math.min((hours / maxH) * 100, 100);
            return `<div class="chart-bar-wrapper">
                <span class="chart-bar-value">${hours.toFixed(1)}h</span>
                <div class="chart-bar" style="height: ${Math.max(pct, 2)}%"></div>
                <span class="chart-bar-label">${dayNames[i].substr(0, 3)}</span>
            </div>`;
        }).join('');

        // Summary
        const totalH = Math.floor(totalMinutes / 60);
        const totalM = totalMinutes % 60;
        document.getElementById('totalWeekHours').textContent = `${totalH}h ${totalM}m`;
        document.getElementById('avgDayHours').textContent = daysPresent > 0
            ? `${(totalMinutes / daysPresent / 60).toFixed(1)}h` : '0h';
        document.getElementById('daysPresent').textContent = daysPresent;
    }

    renderWeeklyPlan() {
        const weekDates = this.getWeekDates(this.currentWeekOffset);
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const today = this.getTodayKey();

        // Update header
        const start = weekDates[0];
        const end = weekDates[6];
        document.getElementById('weekRangeText').textContent =
            `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

        const grid = document.getElementById('weeklyGrid');
        grid.innerHTML = weekDates.map((date, i) => {
            const key = date.toISOString().split('T')[0];
            const isToday = key === today;
            const tasks = this.data.weeklyPlans[key] || [];

            return `<div class="day-card ${isToday ? 'today' : ''}">
                <div class="day-card-header">
                    <span class="day-name">${dayNames[i]} ${isToday ? '(Today)' : ''}</span>
                    <span class="day-date">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                <div class="day-card-body">
                    <div class="day-task-input">
                        <input type="text" class="input-modern" id="weekly-input-${key}"
                            placeholder="Add plan item..."
                            onkeypress="if(event.key==='Enter')app.addWeeklyTask('${key}')">
                        <button class="btn btn-xs btn-primary" onclick="app.addWeeklyTask('${key}')">
                            <i class="ri-add-line"></i>
                        </button>
                    </div>
                    <div class="day-tasks">
                        ${tasks.map((t, idx) => `
                            <div class="day-task-item ${t.done ? 'done' : ''}">
                                <div class="task-checkbox ${t.done ? 'checked' : ''}"
                                    onclick="app.toggleWeeklyTask('${key}', ${idx})">
                                    ${t.done ? '<i class="ri-check-line"></i>' : ''}
                                </div>
                                <span class="task-text">${this.escapeHtml(t.text)}</span>
                                <button class="remove-btn" onclick="app.removeWeeklyTask('${key}', ${idx})">
                                    <i class="ri-close-line"></i>
                                </button>
                            </div>
                        `).join('')}
                        ${tasks.length === 0 ? '<p style="font-size:0.78rem;color:var(--text-muted);padding:4px 0;">No plans yet</p>' : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    renderHistory() {
        const container = document.getElementById('historyList');
        const keys = Object.keys(this.data.checkins).sort().reverse();

        if (keys.length === 0) {
            container.innerHTML = `<div class="empty-state small">
                <i class="ri-history-line"></i>
                <p>History will appear as you use the app</p>
            </div>`;
            return;
        }

        container.innerHTML = keys.map(key => {
            const record = this.data.checkins[key];
            const dateObj = new Date(key + 'T00:00:00');
            const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            let duration = '--';
            if (record.checkinTimestamp && record.checkoutTimestamp) {
                const mins = Math.round((record.checkoutTimestamp - record.checkinTimestamp) / 60000);
                duration = `${Math.floor(mins / 60)}h ${mins % 60}m`;
            }

            const dayTasks = this.data.tasks.filter(t => t.date === key);
            const completedTasks = dayTasks.filter(t => t.status === 'completed').length;

            return `<div class="history-item">
                <div class="history-date">
                    <i class="ri-calendar-line"></i> ${dateStr}
                </div>
                <div class="history-details">
                    <div class="history-detail">
                        <i class="ri-login-box-line"></i> In: ${record.checkin || '--:--'}
                    </div>
                    <div class="history-detail">
                        <i class="ri-logout-box-line"></i> Out: ${record.checkout || '--:--'}
                    </div>
                    <div class="history-detail">
                        <i class="ri-timer-line"></i> Duration: ${duration}
                    </div>
                    <div class="history-detail">
                        <i class="ri-checkbox-circle-line"></i> Tasks: ${completedTasks}/${dayTasks.length}
                    </div>
                </div>
                ${record.activities.length > 0 ? `
                    <div class="history-tasks-summary">
                        ${record.activities.map(a => `<span>${a.time} — ${this.escapeHtml(a.text)}</span>`).join(' · ')}
                    </div>
                ` : ''}
            </div>`;
        }).join('');
    }

    renderAnalytics() {
        const allDays = Object.keys(this.data.checkins);
        const allTasks = this.data.tasks;
        const completedTasks = allTasks.filter(t => t.status === 'completed');

        document.getElementById('analyticsDays').textContent = allDays.length;
        document.getElementById('analyticsTasks').textContent = completedTasks.length;

        // Avg check-in time
        const checkinTimes = allDays
            .map(k => this.data.checkins[k].checkin)
            .filter(Boolean)
            .map(t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; });

        if (checkinTimes.length > 0) {
            const avg = Math.round(checkinTimes.reduce((a, b) => a + b, 0) / checkinTimes.length);
            const avgH = Math.floor(avg / 60);
            const avgM = avg % 60;
            document.getElementById('analyticsAvgIn').textContent =
                `${String(avgH).padStart(2, '0')}:${String(avgM).padStart(2, '0')}`;
        }

        // Streak
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            if (this.data.checkins[key]?.checkin) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }
        document.getElementById('analyticsStreak').textContent = `${streak} day${streak !== 1 ? 's' : ''}`;

        // Task distribution donut
        const categories = {};
        allTasks.forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + 1;
        });

        const colors = {
            development: '#6366f1',
            design: '#ec4899',
            meeting: '#f59e0b',
            research: '#10b981',
            other: '#64748b'
        };

        const total = allTasks.length || 1;
        const distContainer = document.getElementById('taskDistribution');

        if (allTasks.length === 0) {
            distContainer.innerHTML = `<div class="empty-state small">
                <i class="ri-pie-chart-2-line"></i>
                <p>Add tasks to see distribution</p>
            </div>`;
        } else {
            let cumulativePercent = 0;
            const segments = Object.entries(categories).map(([cat, count]) => {
                const percent = (count / total) * 100;
                const start = cumulativePercent;
                cumulativePercent += percent;
                return { cat, count, percent, start, color: colors[cat] || '#64748b' };
            });

            const gradientParts = segments.map(s =>
                `${s.color} ${s.start}% ${s.start + s.percent}%`
            ).join(', ');

            distContainer.innerHTML = `
                <div style="width:160px;height:160px;border-radius:50%;background:conic-gradient(${gradientParts});position:relative;">
                    <div style="width:100px;height:100px;border-radius:50%;background:var(--bg-card);position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;flex-direction:column;">
                        <span style="font-size:1.4rem;font-weight:900;">${allTasks.length}</span>
                        <span style="font-size:0.65rem;color:var(--text-muted);">Tasks</span>
                    </div>
                </div>
                <div class="donut-legend">
                    ${segments.map(s => `
                        <div class="legend-item">
                            <div class="legend-dot" style="background:${s.color}"></div>
                            <span>${this.getCategoryEmoji(s.cat)} ${s.cat} (${s.count})</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Productivity score
        let punctuality = 0;
        if (checkinTimes.length > 0) {
            const onTime = checkinTimes.filter(t => t <= 9 * 60 + 15).length; // Before 9:15
            punctuality = Math.round((onTime / checkinTimes.length) * 100);
        }

        const taskCompletion = allTasks.length > 0
            ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

        const consistency = allDays.length > 0 ? Math.min(Math.round((streak / 5) * 100), 100) : 0;

        const overallScore = Math.round((punctuality + taskCompletion + consistency) / 3);

        document.getElementById('scoreNumber').textContent = overallScore;
        document.getElementById('punctualityFill').style.width = `${punctuality}%`;
        document.getElementById('taskCompFill').style.width = `${taskCompletion}%`;
        document.getElementById('consistencyFill').style.width = `${consistency}%`;

        // Score ring
        const circumference = 2 * Math.PI * 85;
        const offset = circumference * (1 - overallScore / 100);
        document.getElementById('scoreFill').style.strokeDashoffset = offset;
    }

    // ==========================================
    // EXPORT
    // ==========================================

    exportHistory() {
        const lines = ['Date,Check-in,Check-out,Duration,Tasks Completed,Total Tasks'];
        const keys = Object.keys(this.data.checkins).sort();

        keys.forEach(key => {
            const record = this.data.checkins[key];
            let duration = '';
            if (record.checkinTimestamp && record.checkoutTimestamp) {
                const mins = Math.round((record.checkoutTimestamp - record.checkinTimestamp) / 60000);
                duration = `${Math.floor(mins / 60)}h ${mins % 60}m`;
            }
            const dayTasks = this.data.tasks.filter(t => t.date === key);
            const completed = dayTasks.filter(t => t.status === 'completed').length;
            lines.push(`${key},${record.checkin || ''},${record.checkout || ''},${duration},${completed},${dayTasks.length}`);
        });

        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workpulse-history-${this.getTodayKey()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('History exported as CSV!', 'success');
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    getCategoryEmoji(cat) {
        const emojis = {
            development: '💻',
            design: '🎨',
            meeting: '📅',
            research: '🔍',
            other: '📌'
        };
        return emojis[cat] || '📌';
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const icons = {
            success: 'ri-checkbox-circle-fill',
            error: 'ri-error-warning-fill',
            warning: 'ri-alert-fill',
            info: 'ri-information-fill'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="${icons[type]}"></i><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
    }
}

// Initialize
const app = new WorkPulseApp();