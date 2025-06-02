// templates/script.js

const BASE_URL = "http://localhost:8000";
let promptText = "";
let inputText = "";
let modalVisible = false;
let currentUser = null;

// === Получение текста ===
fetch(`${BASE_URL}/get-text`)
    .then(res => res.json())
    .then(data => {
        if (data && data.text) {
            promptText = data.text;
            document.getElementById("prompt").textContent = promptText;
        }
    })
    .catch(err => {
        console.error("Ошибка загрузки текста:", err);
        alert("Не удалось загрузить текст");
    });

// === Сбор метрик клавиш ===
window.keyPresses = {};

// Игнорируемые клавиши
const ignoredKeys = new Set([
    "Shift", "Control", "Alt", "Meta", "CapsLock",
    "Tab", "Escape", "Enter", "Backspace", "Delete"
]);

document.addEventListener("keydown", (e) => {
    if (!e.isTrusted || ignoredKeys.has(e.key)) return;
    window.keyPresses[e.code] = { key: e.key, pressed_time: performance.now() };
});

document.addEventListener("keyup", (e) => {
    if (!e.isTrusted || ignoredKeys.has(e.key)) return;

    const entry = window.keyPresses[e.code];
    if (!entry) return;

    entry.released_time = performance.now();
    entry.duration = entry.released_time - entry.pressed_time;

    inputText += entry.key;
    document.getElementById("output").textContent = inputText;

    fetch(`${BASE_URL}/add_metric`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
    });

    delete window.keyPresses[e.code];
});

// === ESC для завершения теста ===
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        showModal();
    }
});

function showModal() {
    if (modalVisible) return;
    modalVisible = true;
    document.getElementById("overlay").classList.remove("hidden");
    document.getElementById("modal").classList.remove("hidden");
}

function hideModal() {
    modalVisible = false;
    document.getElementById("overlay").classList.add("hidden");
    document.getElementById("modal").classList.add("hidden");
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

function showLogin() {
    document.getElementById("login-form").classList.remove("hidden");
    document.getElementById("register-form").classList.add("hidden");
}

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
    document.getElementById("auth-modal").classList.add("hidden");
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
    document.getElementById("auth-modal").classList.add("hidden");
}