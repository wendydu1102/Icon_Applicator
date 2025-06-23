// This file remains unchanged from the previous version.
const timerDisplay = document.getElementById('timer-display');
const minutesInput = document.getElementById('minutes');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');

let countdownInterval;      // Stores the interval ID for the timer
let timeInSeconds;          // Current time remaining in seconds
let isPaused = false;       // Flag to check if timer is paused
let initialDuration = parseInt(minutesInput.value) * 60; // Initial duration set by user, in seconds

// Function to update the timer display (MM:SS format) and document title
function updateDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const displayString = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

    timerDisplay.textContent = displayString;
    document.title = `${displayString} - Focus Timer`;

    if (seconds === 0 && !countdownInterval) { // Ensure title updates only once when time is up
        document.title = "Time's Up! - Focus Timer";
    }
}

// Function to start or resume the timer
function startTimer() {
    // If timer is already running and not paused, do nothing
    if (countdownInterval && !isPaused) {
        return;
    }

    if (!isPaused) { // If it's a fresh start or after a reset
        initialDuration = parseInt(minutesInput.value) * 60;
        if (isNaN(initialDuration) || initialDuration <= 0) {
            alert("Please enter a valid number of minutes.");
            resetTimer(); // Reset to a valid state
            return;
        }
        timeInSeconds = initialDuration;
    }

    isPaused = false;
    startBtn.textContent = "Start"; // Ensure button text is "Start"

    clearInterval(countdownInterval); // Clear any existing timer before starting a new one

    updateDisplay(timeInSeconds); // Update display immediately

    countdownInterval = setInterval(() => {
        timeInSeconds--;
        if (timeInSeconds < 0) {
            clearInterval(countdownInterval);
            countdownInterval = null; // Reset interval ID
            isPaused = false; // Ensure it's not considered paused
            startBtn.textContent = "Start";
            updateDisplay(0); // Show 00:00
            alert("Time's up! Take a break.");
            // To play a sound, you could uncomment the next line and have an 'alert.mp3' file
            // try { new Audio('alert.mp3').play(); } catch (e) { console.warn("Could not play alert sound:", e); }
            return;
        }
        updateDisplay(timeInSeconds);
    }, 1000);
}

// Function to pause the timer
function pauseTimer() {
    if (countdownInterval && !isPaused) { // Only pause if timer is running and not already paused
        clearInterval(countdownInterval);
        isPaused = true;
        startBtn.textContent = "Resume"; // Change Start button to Resume
    }
}

// Function to reset the timer
function resetTimer() {
    clearInterval(countdownInterval);
    countdownInterval = null;
    isPaused = false;
    startBtn.textContent = "Start";

    let newMinutes = parseInt(minutesInput.value);
    if (isNaN(newMinutes) || newMinutes <= 0) {
        minutesInput.value = 25; // Default to 25 if input is invalid
        newMinutes = 25;
    }
    initialDuration = newMinutes * 60;
    timeInSeconds = initialDuration;

    updateDisplay(timeInSeconds);
    document.title = "Focus Timer"; // Reset document title
}

// Event Listeners for buttons
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// Update timer display if minutes are changed while timer is not actively running
minutesInput.addEventListener('input', () => {
    if (!countdownInterval || isPaused) {
        let newMinutes = parseInt(minutesInput.value);
        if (!isNaN(newMinutes) && newMinutes > 0) {
            initialDuration = newMinutes * 60;
            timeInSeconds = initialDuration;
            updateDisplay(timeInSeconds);
            if (isPaused) { // If paused, keep the "Resume" text
                startBtn.textContent = "Resume";
            } else {
                startBtn.textContent = "Start";
            }
        } else if (minutesInput.value === "") { // Handle empty input
            // Could show a placeholder or default, for now, just ensures display updates
            updateDisplay(0);
        }
    }
});

// Initial display setup on page load
window.onload = () => {
    timeInSeconds = initialDuration;
    updateDisplay(timeInSeconds);
};