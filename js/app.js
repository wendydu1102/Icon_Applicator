document.addEventListener('DOMContentLoaded', () => {
    // --- Global State & Config ---
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let rewards = JSON.parse(localStorage.getItem('rewards')) || { waterDrops: 0, sunlightPoints: 0 };
    let gardenItems = JSON.parse(localStorage.getItem('gardenItems')) || [];
    let calendarEvents = JSON.parse(localStorage.getItem('calendarEvents')) || {};

    let currentPomodoroTask = null; // Stores the full task object
    let selectedTaskId = null; // Stores just the ID of the task selected for Pomodoro

    const POMODORO_TIMES = { // in minutes
        pomodoro: 25,
        shortBreak: 5,
        longBreak: 15,
    };
    let currentTimerMode = 'pomodoro'; // 'pomodoro', 'shortBreak', 'longBreak'
    let timerInterval;
    let timeLeft; // in seconds
    let isTimerRunning = false;
    let pomodoroSessionsCompleted = 0; // For long break logic

    // --- DOM Elements ---
    const todoForm = document.getElementById('todo-form');
    const taskInput = document.getElementById('task-input');
    const taskTimeInput = document.getElementById('task-time-input');
    const todoListUL = document.getElementById('todo-list'); // Renamed to avoid conflict

    const pomodoroTaskNameDisplay = document.getElementById('pomodoro-task-name'); // Renamed
    const pomodoroTimeDisplay = document.getElementById('pomodoro-time-display');
    const pomodoroStartButton = document.getElementById('pomodoro-start');
    const pomodoroPauseButton = document.getElementById('pomodoro-pause');
    const pomodoroResetButton = document.getElementById('pomodoro-reset');
    const pomodoroModeSelector = document.getElementById('pomodoro-mode-selector');

    const gardenArea = document.getElementById('garden-area');
    const waterDropsDisplay = document.getElementById('water-drops');
    const sunlightPointsDisplay = document.getElementById('sunlight-points');
    const gardenShopButtons = document.querySelectorAll('#garden-shop .shop-item');

    const monthYearDisplay = document.getElementById('month-year');
    const calendarDatesContainer = document.getElementById('calendar-dates');
    const prevMonthButton = document.getElementById('prev-month');
    const nextMonthButton = document.getElementById('next-month');

    const eventModal = document.getElementById('event-modal');
    const modalDateDisplay = document.getElementById('modal-date');
    const eventTextInput = document.getElementById('event-text');
    const saveEventButton = document.getElementById('save-event');
    const eventListDisplay = document.getElementById('event-list');
    const closeModalButton = eventModal.querySelector('.close-button');
    let currentCalendarSelectedDate = null; // Renamed to avoid conflict

    const rewardsLogUL = document.getElementById('rewards-log'); // Renamed

    // --- Utility Functions ---
    function playNotificationSound() {
        // You'll need an actual audio file, e.g., assets/notification.mp3
        // const audio = new Audio('assets/notification.mp3'); 
        // audio.play().catch(e => console.warn("Audio play failed. User interaction might be needed or file missing.", e));
        console.log("Notification: Timer finished!"); // Placeholder if audio isn't set up
    }

    // --- To-Do List Logic ---
    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    function renderTasks() {
        todoListUL.innerHTML = '';
        if (tasks.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.textContent = "No tasks yet. Add a 'sprout' to get started!";
            emptyLi.style.textAlign = "center";
            emptyLi.style.color = "#777";
            emptyLi.style.cursor = "default";
            todoListUL.appendChild(emptyLi);
            return;
        }
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.dataset.id = task.id;
            li.className = task.completed ? 'completed' : '';
            if (task.id === selectedTaskId) {
                li.classList.add('selected-task');
            }

            const taskTextSpan = document.createElement('span');
            taskTextSpan.textContent = `${task.text} (${task.timeAllocated} min)`;
            taskTextSpan.className = 'task-text';
            // Click on task text/area to select for Pomodoro
            li.addEventListener('click', (e) => {
                if (e.target.closest('.task-actions')) return; // Don't select if clicking on action buttons
                selectTaskForPomodoro(task.id);
            });


            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'task-actions';

            const completeButton = document.createElement('button');
            completeButton.innerHTML = task.completed ? '<i class="fas fa-undo"></i>' : '<i class="fas fa-check"></i>';
            completeButton.title = task.completed ? "Mark as not done" : "Mark as done";
            completeButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent li click event
                toggleTaskComplete(task.id);
            });

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = "Delete task";
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent li click event
                deleteTask(task.id);
            });

            actionsDiv.appendChild(completeButton);
            actionsDiv.appendChild(deleteButton);

            li.appendChild(taskTextSpan);
            li.appendChild(actionsDiv);
            todoListUL.appendChild(li);
        });
    }

    todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = taskInput.value.trim();
        const timeAllocated = parseInt(taskTimeInput.value);
        if (text && timeAllocated > 0) {
            tasks.push({ id: Date.now().toString(), text, timeAllocated, completed: false });
            taskInput.value = '';
            taskTimeInput.value = '';
            saveTasks();
            renderTasks();
            addRewardLogMessage(`New task sprout added: "${text}"!`, 'fas fa-leaf');
        } else {
            alert("Please enter a valid task description and time (greater than 0).");
        }
    });

    function toggleTaskComplete(id) {
        const taskIndex = tasks.findIndex(task => task.id === id);
        if (taskIndex > -1) {
            const task = tasks[taskIndex];
            const previouslyCompleted = task.completed;
            task.completed = !task.completed;

            if (task.completed && !previouslyCompleted) {
                grantRewardPoints(task.timeAllocated >= 30 ? "sunlight" : "water", task.timeAllocated >= 30 ? 2 : 1);
                addRewardLogMessage(`Task "${task.text}" completed! Well done!`, 'fas fa-check-circle');
                growGardenOnEvent("taskComplete");
                if (selectedTaskId === id) { // If completed task was the current pomodoro task
                    pomodoroTaskNameDisplay.textContent = "Task completed! Select another or take a break.";
                    currentPomodoroTask = null; // No longer actively pomodoro-ing this task
                    // selectedTaskId remains to show it was the last one, but timer should reflect this change
                    resetPomodoroTimer(); // Reset timer to default if current task is completed
                }
            } else if (!task.completed && previouslyCompleted) {
                addRewardLogMessage(`Task "${task.text}" marked as active again.`, 'fas fa-undo');
            }
            saveTasks();
            renderTasks();
            updateRewardsDisplay();
        }
    }

    function deleteTask(id) {
        const taskToDelete = tasks.find(task => task.id === id);
        if (confirm(`Are you sure you want to delete task: "${taskToDelete.text}"?`)) {
            tasks = tasks.filter(task => task.id !== id);
            if (selectedTaskId === id) {
                resetPomodoroTimer(); // Reset timer as the selected task is gone
                pomodoroTaskNameDisplay.textContent = "Select a task to begin";
                currentPomodoroTask = null;
                selectedTaskId = null;
            }
            saveTasks();
            renderTasks();
            addRewardLogMessage(`Task "${taskToDelete.text}" removed.`, 'fas fa-times-circle');
        }
    }

    function selectTaskForPomodoro(id) {
        const task = tasks.find(t => t.id === id);
        if (task && !task.completed) {
            currentPomodoroTask = task;
            selectedTaskId = id;
            pomodoroTaskNameDisplay.textContent = `Focus: ${task.text}`;
            setTimerModeAndDuration('pomodoro', task.timeAllocated * 60);
            renderTasks(); // Re-render to show selection highlight
        } else if (task && task.completed) {
            alert("This task is already completed. Choose an active task or unmark it.");
            if (selectedTaskId === id) { // If trying to re-select an already completed task
                pomodoroTaskNameDisplay.textContent = "Select an active task";
                currentPomodoroTask = null;
                // selectedTaskId can remain if you want to visually keep it highlighted but timer won't run for it.
                // Or set selectedTaskId = null if you want to clear selection fully.
                resetPomodoroTimer(); // Reset to default Pomodoro time
            }
        }
    }

    // --- Pomodoro Timer Logic ---
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const displayString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        pomodoroTimeDisplay.textContent = displayString;
        document.title = `${displayString} - Serene Study Garden`;
    }

    function setTimerModeAndDuration(mode, durationSeconds) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        currentTimerMode = mode;
        timeLeft = durationSeconds;
        updateTimerDisplay();

        pomodoroStartButton.classList.remove('hidden');
        pomodoroPauseButton.classList.add('hidden');

        document.querySelectorAll('#pomodoro-mode-selector button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === mode) btn.classList.add('active');
        });

        if (mode === 'pomodoro') {
            if (currentPomodoroTask && !currentPomodoroTask.completed) {
                pomodoroTaskNameDisplay.textContent = `Focus: ${currentPomodoroTask.text}`;
            } else {
                pomodoroTaskNameDisplay.textContent = "Select a task to begin";
            }
        } else if (mode === 'shortBreak') {
            pomodoroTaskNameDisplay.textContent = "Short Break";
        } else if (mode === 'longBreak') {
            pomodoroTaskNameDisplay.textContent = "Long Break";
        }
    }

    function startTimer() {
        if (currentTimerMode === 'pomodoro' && (!currentPomodoroTask || currentPomodoroTask.completed)) {
            alert("Please select an active task from your To-Do list to start a Pomodoro session.");
            return;
        }
        if (timeLeft <= 0) { // If timer was at 0, reset based on current mode
            let durationToSet;
            if (currentTimerMode === 'pomodoro' && currentPomodoroTask) {
                durationToSet = currentPomodoroTask.timeAllocated * 60;
            } else {
                durationToSet = POMODORO_TIMES[currentTimerMode] * 60;
            }
            setTimerModeAndDuration(currentTimerMode, durationToSet);
        }

        isTimerRunning = true;
        pomodoroStartButton.classList.add('hidden');
        pomodoroPauseButton.classList.remove('hidden');

        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft < 0) { // Changed to < 0 to ensure 00:00 is displayed
                clearInterval(timerInterval);
                isTimerRunning = false;
                pomodoroStartButton.classList.remove('hidden');
                pomodoroPauseButton.classList.add('hidden');
                document.title = "Time's up! - Serene Study Garden";
                playNotificationSound();

                if (currentTimerMode === 'pomodoro') {
                    pomodoroSessionsCompleted++;
                    addRewardLogMessage(`Pomodoro session for "${currentPomodoroTask.text}" complete!`, 'fas fa-hourglass-end');
                    grantRewardPoints("sunlight", currentPomodoroTask.timeAllocated >= 25 ? 3 : 2); // More points for longer focus
                    growGardenOnEvent("pomodoroComplete");
                    if (pomodoroSessionsCompleted % 4 === 0) { // Every 4 Pomodoros, suggest a long break
                        setTimerModeAndDuration('longBreak', POMODORO_TIMES.longBreak * 60);
                        addRewardLogMessage("Time for a Long Break!", 'fas fa-coffee');
                    } else {
                        setTimerModeAndDuration('shortBreak', POMODORO_TIMES.shortBreak * 60);
                        addRewardLogMessage("Time for a Short Break!", 'fas fa-mug-hot');
                    }
                } else if (currentTimerMode === 'shortBreak' || currentTimerMode === 'longBreak') {
                    addRewardLogMessage(`Break finished! Ready to focus again?`, 'fas fa-brain');
                    const nextPomodoroTime = (currentPomodoroTask && !currentPomodoroTask.completed) ? currentPomodoroTask.timeAllocated * 60 : POMODORO_TIMES.pomodoro * 60;
                    const nextMode = 'pomodoro';
                    setTimerModeAndDuration(nextMode, nextPomodoroTime);
                    if (!currentPomodoroTask || currentPomodoroTask.completed) {
                        pomodoroTaskNameDisplay.textContent = "Select a task to begin";
                    }
                }
                updateRewardsDisplay();
            }
        }, 1000);
    }

    function pauseTimer() {
        clearInterval(timerInterval);
        isTimerRunning = false;
        pomodoroStartButton.classList.remove('hidden');
        pomodoroPauseButton.classList.add('hidden');
    }

    function resetPomodoroTimer() {
        let durationToSet;
        if (currentTimerMode === 'pomodoro' && currentPomodoroTask && !currentPomodoroTask.completed) {
            durationToSet = currentPomodoroTask.timeAllocated * 60;
        } else if (currentTimerMode === 'pomodoro' && (!currentPomodoroTask || (currentPomodoroTask && currentPomodoroTask.completed))) {
            durationToSet = POMODORO_TIMES.pomodoro * 60; // Default if no active task
            if (!currentPomodoroTask || (currentPomodoroTask && currentPomodoroTask.completed)) {
                pomodoroTaskNameDisplay.textContent = "Select a task to begin";
            }
        }
        else {
            durationToSet = POMODORO_TIMES[currentTimerMode] * 60;
        }
        setTimerModeAndDuration(currentTimerMode, durationToSet);
        document.title = "Serene Study Garden";
    }

    pomodoroStartButton.addEventListener('click', startTimer);
    pomodoroPauseButton.addEventListener('click', pauseTimer);
    pomodoroResetButton.addEventListener('click', resetPomodoroTimer);

    pomodoroModeSelector.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const mode = e.target.dataset.mode;
            if (mode) {
                let duration;
                if (mode === 'pomodoro') {
                    duration = (currentPomodoroTask && !currentPomodoroTask.completed) ? currentPomodoroTask.timeAllocated * 60 : POMODORO_TIMES.pomodoro * 60;
                } else {
                    duration = POMODORO_TIMES[mode] * 60;
                }
                setTimerModeAndDuration(mode, duration);
            }
        }
    });

    // --- Reward System & Focus Garden Logic ---
    function saveRewards() {
        localStorage.setItem('rewards', JSON.stringify(rewards));
    }
    function saveGardenItems() {
        localStorage.setItem('gardenItems', JSON.stringify(gardenItems));
    }

    function updateRewardsDisplay() {
        waterDropsDisplay.textContent = rewards.waterDrops;
        sunlightPointsDisplay.textContent = rewards.sunlightPoints;
    }

    function grantRewardPoints(type, amount) {
        if (type === "water") {
            rewards.waterDrops += amount;
            addRewardLogMessage(`+${amount} Water Drop(s) <i class="fas fa-tint" style="color:#89CFF0;"></i> collected!`, 'fas fa-tint');
        } else if (type === "sunlight") {
            rewards.sunlightPoints += amount;
            addRewardLogMessage(`+${amount} Sunlight Point(s) <i class="fas fa-sun" style="color:#FFB703;"></i> collected!`, 'fas fa-sun');
        }
        saveRewards();
        updateRewardsDisplay();
    }

    function addRewardLogMessage(message, iconClass = 'fas fa-gift') {
        const li = document.createElement('li');
        li.innerHTML = `<i class="${iconClass}"></i> ${message}`;
        rewardsLogUL.prepend(li); // Add to top
        if (rewardsLogUL.children.length > 7) { // Keep log concise
            rewardsLogUL.removeChild(rewardsLogUL.lastChild);
        }
    }

    function renderGarden() {
        gardenArea.innerHTML = ''; // Clear previous items
        if (gardenItems.length === 0) {
            const p = document.createElement('p');
            p.textContent = "Your garden is flourishing with potential. Plant something!";
            gardenArea.appendChild(p);
            return;
        }
        gardenItems.forEach(item => {
            const plantDiv = document.createElement('div');
            plantDiv.classList.add('plant');
            plantDiv.style.fontSize = item.size || '2.5em';
            plantDiv.textContent = item.icon || (item.type === 'sapling' ? '🌱' : '🌸');
            plantDiv.title = `A lovely ${item.type}`;
            gardenArea.appendChild(plantDiv);
        });
    }

    function growGardenOnEvent(eventType) { // eventType: "taskComplete", "pomodoroComplete"
        // Simple visual feedback: maybe add a temporary "sparkle" or "growth" animation in future
        if (eventType === "taskComplete") {
            addRewardLogMessage("Your garden thrives with each completed task!", 'fas fa-leaf');
        } else if (eventType === "pomodoroComplete") {
            addRewardLogMessage("Focused energy helps your garden grow strong!", 'fas fa-seedling');
        }
        // Actual planting happens via shop
    }

    gardenShopButtons.forEach(button => {
        button.addEventListener('click', () => {
            const itemType = button.dataset.item;
            const cost = parseInt(button.dataset.cost);
            const currencyType = button.dataset.type; // 'water' or 'sun'

            let canAfford = false;
            if (currencyType === 'water' && rewards.waterDrops >= cost) {
                rewards.waterDrops -= cost;
                canAfford = true;
            } else if (currencyType === 'sun' && rewards.sunlightPoints >= cost) {
                rewards.sunlightPoints -= cost;
                canAfford = true;
            }

            if (canAfford) {
                let newItem;
                if (itemType === 'sapling') {
                    newItem = { id: Date.now().toString(), type: 'sapling', icon: '🌱', plantedAt: Date.now() };
                } else if (itemType === 'flower') {
                    newItem = { id: Date.now().toString(), type: 'flower', icon: '🌸', plantedAt: Date.now() };
                }
                // Add more item types here, e.g., 'tree' 🌳, 'mushroom' 🍄, 'bush' 🌿

                if (newItem) {
                    gardenItems.push(newItem);
                    saveGardenItems();
                    renderGarden();
                    updateRewardsDisplay(); // Reflect spent currency
                    saveRewards(); // Save updated currency
                    addRewardLogMessage(`You planted a ${itemType}! The garden looks lovelier.`, 'fas fa-plus-circle');
                }
            } else {
                alert(`Not enough ${currencyType === 'water' ? 'Water Drops' : 'Sunlight Points'} to buy ${itemType}. Keep focusing!`);
            }
        });
    });

    // --- Calendar Logic ---
    let calendarCurrentDate = new Date(); // Renamed to avoid conflict

    function saveCalendarEvents() {
        localStorage.setItem('calendarEvents', JSON.stringify(calendarEvents));
    }

    function renderCalendar() {
        calendarDatesContainer.innerHTML = '';
        const year = calendarCurrentDate.getFullYear();
        const month = calendarCurrentDate.getMonth();

        monthYearDisplay.textContent = `${calendarCurrentDate.toLocaleString('default', { month: 'long' })} ${year}`;

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();


        // Previous month's trailing days
        for (let i = firstDayOfMonth; i > 0; i--) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('other-month');
            dayDiv.textContent = daysInPrevMonth - i + 1;
            calendarDatesContainer.appendChild(dayDiv);
        }

        // Current month's days
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.textContent = day;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dayDiv.dataset.date = dateStr;

            const today = new Date();
            if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayDiv.classList.add('today');
            }
            if (calendarEvents[dateStr] && calendarEvents[dateStr].length > 0) {
                dayDiv.classList.add('has-event');
            }

            dayDiv.addEventListener('click', () => openEventModal(dateStr));
            calendarDatesContainer.appendChild(dayDiv);
        }

        // Next month's leading days
        const totalCells = firstDayOfMonth + daysInMonth;
        const remainingCells = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remainingCells; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('other-month');
            dayDiv.textContent = i;
            calendarDatesContainer.appendChild(dayDiv);
        }
    }

    prevMonthButton.addEventListener('click', () => {
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthButton.addEventListener('click', () => {
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
        renderCalendar();
    });

    function openEventModal(dateStr) {
        currentCalendarSelectedDate = dateStr;
        const [year, month, day] = dateStr.split('-');
        const dateObj = new Date(year, parseInt(month) - 1, day); // Month is 0-indexed for Date constructor
        modalDateDisplay.textContent = `Goals for ${dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
        eventTextInput.value = '';
        renderEventListForModal();
        eventModal.style.display = 'flex';
        eventTextInput.focus();
    }

    closeModalButton.addEventListener('click', () => {
        eventModal.style.display = 'none';
        currentCalendarSelectedDate = null;
    });

    window.addEventListener('click', (event) => { // Close modal if clicked outside content
        if (event.target == eventModal) {
            eventModal.style.display = 'none';
            currentCalendarSelectedDate = null;
        }
    });

    saveEventButton.addEventListener('click', () => {
        const eventText = eventTextInput.value.trim();
        if (eventText && currentCalendarSelectedDate) {
            if (!calendarEvents[currentCalendarSelectedDate]) {
                calendarEvents[currentCalendarSelectedDate] = [];
            }
            calendarEvents[currentCalendarSelectedDate].push({ id: Date.now().toString(), text: eventText, completed: false });
            saveCalendarEvents();
            renderEventListForModal();
            eventTextInput.value = '';
            renderCalendar(); // Re-render calendar to show event marker (has-event class)
            addRewardLogMessage(`Long-term goal set for ${currentCalendarSelectedDate}.`, 'far fa-calendar-check');
        }
    });

    function renderEventListForModal() {
        eventListDisplay.innerHTML = '';
        if (currentCalendarSelectedDate && calendarEvents[currentCalendarSelectedDate]) {
            calendarEvents[currentCalendarSelectedDate].forEach((event, index) => {
                const li = document.createElement('li');

                const eventTextSpan = document.createElement('span');
                eventTextSpan.textContent = event.text;
                if (event.completed) eventTextSpan.style.textDecoration = 'line-through';

                // Basic complete/delete for calendar events
                const completeBtn = document.createElement('button');
                completeBtn.innerHTML = event.completed ? '<i class="fas fa-undo"></i>' : '<i class="fas fa-check"></i>';
                completeBtn.title = event.completed ? "Mark Incomplete" : "Mark Complete";
                completeBtn.style.cssText = "background:none; border:none; cursor:pointer; margin-left:10px; color: green;";
                completeBtn.onclick = () => {
                    event.completed = !event.completed;
                    saveCalendarEvents();
                    renderEventListForModal();
                };

                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.title = "Delete Goal";
                deleteBtn.classList.add('delete-event'); // From CSS
                deleteBtn.onclick = () => {
                    calendarEvents[currentCalendarSelectedDate].splice(index, 1);
                    if (calendarEvents[currentCalendarSelectedDate].length === 0) {
                        delete calendarEvents[currentCalendarSelectedDate];
                    }
                    saveCalendarEvents();
                    renderEventListForModal();
                    renderCalendar();
                };
                li.appendChild(eventTextSpan);
                li.appendChild(completeBtn);
                li.appendChild(deleteBtn);
                eventListDisplay.appendChild(li);
            });
        }
        if (eventListDisplay.children.length === 0) {
            eventListDisplay.innerHTML = '<li>No goals for this day yet.</li>';
        }
    }

    // --- Initial Setup ---
    function initializeApp() {
        renderTasks();
        updateRewardsDisplay();
        renderGarden();
        renderCalendar();

        // Set initial Pomodoro timer
        const firstActiveTask = tasks.find(t => !t.completed);
        if (firstActiveTask) {
            selectTaskForPomodoro(firstActiveTask.id); // This will call setTimerModeAndDuration
        } else {
            setTimerModeAndDuration('pomodoro', POMODORO_TIMES.pomodoro * 60);
        }
        addRewardLogMessage("Welcome to your Serene Study Garden! Let's get productive.", 'fas fa-tree');
    }

    initializeApp();
});