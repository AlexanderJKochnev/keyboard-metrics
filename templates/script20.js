const BASE_URL = "http://localhost:8000";
let promptText = "";
let inputText = "";
let modalVisible = false;
let currentUser = null;
let inputEnabled = false;

// === Флаг для однократного подключения событий ===
let modalInitialized = false;

// === Сбор данных о клавишах ===
window.keyPresses = {};

// Игнорируемые клавиши
const ignoredKeys = new Set([
    "Shift", "Control", "Alt", "Meta", "CapsLock",
    "Tab", "Escape", "Enter", "Backspace", "Delete"
]);

function handleKeyDown(e) {
    if (!inputEnabled || !e.isTrusted || ignoredKeys.has(e.key)) return;
    window.keyPresses[e.code] = { key: e.key, pressed_time: performance.now() };
}

function handleKeyUp(e) {
    if (!inputEnabled || !e.isTrusted || ignoredKeys.has(e.key)) return;

    const entry = window.keyPresses[e.code];
    if (!entry) return;

    entry.released_time = performance.now();
    entry.duration = entry.released_time - entry.pressed_time;

    inputText += entry.key;
    const outputDiv = document.getElementById("output");
    if (outputDiv) {
        outputDiv.textContent = inputText;
    }

    fetch(`${BASE_URL}/add_metric`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
    });

    delete window.keyPresses[e.code];
}

// === ESC — показываем модальное окно ===
function setupEventListeners() {
    if (modalInitialized) return;
    modalInitialized = true;

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            showModal();
        }
    });

    document.getElementById("stop-test-btn")?.addEventListener("click", () => {
        showModal();
    });
}

// === Отображение модального окна завершения теста ===
function showModal() {
    if (modalVisible) return;
    modalVisible = true;

    // Показываем overlay и modal
    document.getElementById("overlay").classList.remove("hidden");
    document.getElementById("modal").classList.remove("hidden");

    // Гарантируем отображение поверх всего
    document.getElementById("overlay").style.display = "block";
    document.getElementById("modal").style.display = "block";
}

function hideModal() {
    modalVisible = false;

    document.getElementById("overlay").classList.add("hidden");
    document.getElementById("modal").classList.add("hidden");

    // Делаем их невидимыми
    document.getElementById("overlay").style.display = "none";
    document.getElementById("modal").style.display = "none";
}

async function endTest() {
    hideModal();

    const response = await fetch(`${BASE_URL}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            input_text: inputText,
            original_text: promptText,
            errors: countErrors(inputText, promptText),
            user_id: currentUser
        }),
    });

    const result = await response.json();
    alert(`Количество ошибок: ${result.errors}`);
}

function continueTest() {
    hideModal();
}

function countErrors(input, original) {
    const minLen = Math.min(input.length, original.length);
    let errors = 0;
    for (let i = 0; i < minLen; i++) {
        if (input[i] !== original[i]) errors++;
    }
    errors += Math.abs(input.length - original.length);
    return errors;
}

// === Авторизация ===
function showRegister() {
    document.getElementById("register-form").classList.remove("hidden");
    document.getElementById("login-form").classList.add("hidden");
}

async function login() {
    const login = document.getElementById("login").value.trim();
    const password = document.getElementById("password").value.trim();

    const res = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: login, password })
    });

    if (!res.ok) {
        alert("Ошибка входа");
        return;
    }

    const data = await res.json();
    currentUser = data.user_id;
    showMainContent();
}

async function register() {
    const username = document.getElementById("reg-login").value.trim();
    const password = document.getElementById("reg-password").value.trim();
    const age = parseInt(document.getElementById("reg-age").value.trim());
    const gender = document.getElementById("reg-gender").value;

    if (!username || !password) {
        alert("Введите логин и пароль");
        return;
    }

    const res = await fetch(`${BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, age, gender })
    });

    if (!res.ok) {
        alert("Ошибка регистрации");
        return;
    }

    const data = await res.json();
    currentUser = data.user_id;
    showMainContent();
}

// === Загрузка текста только после входа ===
async function loadPrompt() {
    try {
        const response = await fetch(`${BASE_URL}/get-text`);
        const data = await response.json();

        if (data && data.text) {
            promptText = data.text;
            document.getElementById("prompt").textContent = promptText;
        }
    } catch (err) {
        console.error("Ошибка загрузки текста:", err);
        alert("Не удалось загрузить текст");
    }
}

// === Включаем ввод только после входа ===
function enableInputTracking() {
    if (inputEnabled) return;
    inputEnabled = true;
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
}

function disableInputTracking() {
    inputEnabled = false;
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
}

// === Показ основного контента ===
async function showMainContent() {
    document.getElementById("main-content").classList.remove("hidden");
    document.getElementById("instructions").classList.remove("hidden");
    document.getElementById("auth-modal").classList.add("hidden");

    await loadPrompt();           // Загружаем текст
    enableInputTracking();       // Разрешаем ввод
    setupEventListeners();       // Назначаем Esc и кнопку остановки
}