const BASE_URL = "http://localhost:8000";
let promptText = "";
let inputText = "";
let modalVisible = false;
let currentUser = null;
let inputEnabled = false;

// === Маппинг EN → RU ===
const enToRuMap = {
    'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е',
    'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з',
    '[': 'х', ']': 'ъ',

    'a': 'ф', 's': 'ы', 'd': 'в', 'f': 'а', 'g': 'п',
    'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д', ';': 'ж',
    '\'': 'э', '`': 'ё',

    'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и',
    'n': 'т', 'm': 'ь', ',': 'б', '.': 'ю'
};

// === Игнорируемые клавиши ===
const ignoredKeys = new Set([
    "Shift", "Control", "Alt", "Meta", "CapsLock",
    "Tab", "Escape", "Enter", "Backspace", "Delete"
]);

// === Сбор данных о клавишах ===
window.keyPresses = {};

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

    // Транслитерация: если образец на русском, а ввод на EN
    let inputChar = entry.key;
    const correctedChar = transliterate(inputChar);

    inputText += correctedChar;

    // Обновляем вывод
    const outputDiv = document.getElementById("output");
    if (outputDiv) {
        outputDiv.textContent = inputText;
    }

    // Сохраняем метрику
    fetch(`${BASE_URL}/add_metric`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        ...entry,
        user_id: currentUser}),
    });

    delete window.keyPresses[e.code];
}

// === Функция транслитерации EN → RU ===
function transliterate(char) {
    const lowerChar = char.toLowerCase();
    return enToRuMap[lowerChar] || char;
}

// === ESC — показываем модальное окно ===
let eventListenersInitialized = false;

function setupEventListeners() {
    if (eventListenersInitialized) return;
    eventListenersInitialized = true;

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
    const result = endTest();
}

function hideModal() {
    modalVisible = false;

    document.getElementById("overlay").classList.add("hidden");
    document.getElementById("modal").classList.add("hidden");

    document.getElementById("overlay").style.display = "none";
    document.getElementById("modal").style.display = "none";
}

async function endTest() {
    const input = document.getElementById("output").textContent;
    const original = promptText;

    if (!input || !original || !currentUser) {
        alert("Ошибка: текст или пользователь не определены");
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/compare`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                input_text: input,
                original_text: original,
                user_id: currentUser
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error("Ошибка при сравнении текста");
        }


        // ===  ===
        const modal = document.getElementById("modal");
        const overlay = document.getElementById("overlay");
        // проверка видимости окон
        if (!modal || !overlay) {
            console.error("Модальные элементы не найдены");
            alert("Ошибка интерфейса: нет модального окна");
            return;
        }
        // Сбрасываем стили и классы
        modal.style.display = "block";
        overlay.style.display = "block";
        modal.classList.remove("hidden");
        overlay.classList.remove("hidden");

        modal.innerHTML = `
            <p>Количество ошибок: ${result.errors}</p>
            <p>Тест выполнен на ${result.completion}%</p>
            <button onclick="repeatTest()">Повторить тест</button>
            <button onclick="newTest()">Новый тест</button>
        `;

        // === Показываем модальное окно ===
        document.getElementById("overlay").classList.remove("hidden");
        document.getElementById("modal").classList.remove("hidden");

        // === Скрываем кнопку "Остановить печать" ===
        document.getElementById("stop-test-btn").classList.add("hidden");

    } catch (err) {
        console.error("Ошибка завершения теста:", err);
        alert("Не удалось получить результат");
    }
}

function continueTest() {
    hideModal();
}


// === Авторизация ===
function showRegister() {
    document.getElementById("register-form").classList.remove("hidden");
    document.getElementById("login-form").classList.add("hidden");
    document.querySelector("button[onclick='showRegister()']").style.display = "none";
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

// === Загрузка текста после входа ===
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
    document.getElementById("settings").classList.remove("hidden");
    document.getElementById("auth-modal").classList.add("hidden");

    await loadPrompt();           // Загружаем текст
    enableInputTracking();       // Разрешаем ввод
    setupEventListeners();       // Назначаем Esc и кнопку остановки
}

function repeatTest() {
    // Очищаем введённый текст
    inputText = "";
    document.getElementById("output").textContent = "";

    // Показываем кнопку "Остановить печать"
    const stopBtn = document.getElementById("stop-test-btn");
    if (stopBtn) {
        stopBtn.classList.remove("hidden");
    }

    // Скрываем блок с кнопками "Повторить" / "Новый тест"
    const afterButtons = document.getElementById("after-test-buttons");
    if (afterButtons) {
        afterButtons.classList.add("hidden");
    }

    // Обновляем интерфейс
    document.getElementById("modal").classList.add("hidden");
    document.getElementById("overlay").classList.add("hidden");

    modalVisible = false;
}

async function newTest() {
    // Очищаем введённый текст
    inputText = "";
    document.getElementById("output").textContent = "";

    // Скрываем старый результат
    document.getElementById("modal").classList.add("hidden");
    document.getElementById("overlay").classList.add("hidden");

    // Показываем кнопку "Остановить печать"
    const stopBtn = document.getElementById("stop-test-btn");
    if (stopBtn) {
        stopBtn.classList.remove("hidden");
    }

    // Скрываем блок с кнопками "Повторить" / "Новый тест"
    const afterButtons = document.getElementById("after-test-buttons");
    if (afterButtons) {
        afterButtons.classList.add("hidden");
    }

    // Загружаем новый текст
    await loadPrompt();

    modalVisible = false;
}