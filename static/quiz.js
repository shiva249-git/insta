// ------------------- Quiz State -------------------
const quizState = {
  data: [],
  index: 0,
  score: 0,
  sessionId: null,
  timer: null,
  timePerQuestion: 30
};

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("startQuizBtn")?.addEventListener("click", getQuiz);
  document.getElementById("submitAnswerBtn")?.addEventListener("click", submitAnswer);
  setupKeyboardShortcuts();
});

// ------------------- Fetch Quiz -------------------
async function getQuiz() {
  const topic = document.getElementById("topic")?.value.trim();
  let numQuestions = parseInt(document.getElementById("numQuestions")?.value.trim() || "5", 10);

  if (!topic) {
    alert("Please select a topic.");
    return;
  }
  if (isNaN(numQuestions) || numQuestions < 1) numQuestions = 5;

  showLoading(true);
  resetQuizUI();

  try {
    const res = await fetch("/quiz/fetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {})
      },
      body: JSON.stringify({ topic, num_questions: numQuestions })
    });

    const data = await res.json();
    showLoading(false);

    if (data.error) {
      alert(data.error);
      return;
    }
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      alert("No questions received.");
      return;
    }

    quizState.data = data.questions;
    quizState.index = 0;
    quizState.score = 0;
    quizState.sessionId = data.session_id;

    renderQuestion();
  } catch (err) {
    showLoading(false);
    alert("Error fetching quiz questions.");
    console.error(err);
  }
}

// ------------------- Render Question -------------------
function renderQuestion() {
  clearInterval(quizState.timer);

  if (quizState.index >= quizState.data.length) {
    showFinalScore();
    return;
  }

  const question = quizState.data[quizState.index];
  if (!question) {
    alert("Invalid question.");
    return;
  }

  document.getElementById("questionText").innerText = question.question;
  const optionsDiv = document.getElementById("options");
  optionsDiv.innerHTML = "";

  Object.entries(question.options).forEach(([key, value]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "form-check option-wrapper";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.className = "form-check-input";
    radio.name = "answer";
    radio.value = key;
    radio.id = `option_${key}`;
    radio.setAttribute("aria-label", `${key} ${value}`);
    radio.disabled = false;

    const label = document.createElement("label");
    label.className = "form-check-label";
    label.setAttribute("for", `option_${key}`);
    label.innerText = `${key}) ${value}`;

    wrapper.appendChild(radio);
    wrapper.appendChild(label);
    optionsDiv.appendChild(wrapper);
  });

  // Highlight selected option on change
  document.querySelectorAll('.form-check-input').forEach(input => {
    input.addEventListener('change', () => {
      document.querySelectorAll('.option-wrapper').forEach(opt => opt.classList.remove("selected"));
      input.parentElement.classList.add("selected");
    });
  });

  document.getElementById("questionArea").style.display = "block";
  document.getElementById("result").innerHTML = "";
  document.getElementById("finalScore").innerHTML = "";
  updateProgress();
  startTimer(quizState.timePerQuestion);
}

// ------------------- Submit Answer -------------------
async function submitAnswer() {
  clearInterval(quizState.timer);

  const selected = document.querySelector('input[name="answer"]:checked');
  if (!selected) {
    alert("Please select an answer!");
    return;
  }

  disableOptions();

  const answer = selected.value;
  showLoading(true);

  try {
    const res = await fetch("/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {})
      },
      body: JSON.stringify({
        answer,
        session_id: quizState.sessionId,
        question_id: quizState.data[quizState.index].id
      })
    });

    const data = await res.json();
    showLoading(false);

    if (data.error) {
      alert(data.error);
      return;
    }

    if (data.result === "correct") {
      quizState.score++;
      document.getElementById("result").innerHTML = `<span style="color:green; font-weight:bold;">✅ Correct!</span><br>${data.explanation || ""}`;
    } else {
      document.getElementById("result").innerHTML = `<span style="color:red; font-weight:bold;">❌ Incorrect.</span><br>Correct Answer: <strong>${data.correct_answer}</strong><br>${data.explanation || ""}`;
    }

    setTimeout(() => {
      quizState.index++;
      renderQuestion();
    }, 1500);
  } catch (err) {
    showLoading(false);
    alert("Error submitting answer.");
    console.error(err);
  }
}

// ------------------- Disable Options after Submit -------------------
function disableOptions() {
  const allOptions = document.querySelectorAll('input[name="answer"]');
  allOptions.forEach(input => input.disabled = true);
}

// ------------------- Utilities -------------------
function resetQuizUI() {
  document.getElementById("questionArea").style.display = "none";
  document.getElementById("result").innerHTML = "";
  document.getElementById("finalScore").innerHTML = "";
  const progress = document.getElementById("progressBar");
  if (progress) progress.value = 0;
  clearInterval(quizState.timer);
  document.getElementById("questionTimer").innerText = "";
}

function showFinalScore() {
  document.getElementById("questionArea").style.display = "none";
  document.getElementById("result").innerHTML = "";
  document.getElementById("finalScore").innerHTML =
    `<h3>Your score: ${quizState.score} / ${quizState.data.length}</h3>
    <button onclick="getQuiz()" class="btn btn-primary mt-3">Retry Quiz</button>`;
}

function showLoading(show) {
  const loader = document.getElementById("loading");
  if (loader) loader.style.display = show ? "block" : "none";
}

function updateProgress() {
  const progress = document.getElementById("progressBar");
  if (progress) {
    progress.max = quizState.data.length;
    progress.value = quizState.index + 1;
  }
}

function startTimer(seconds) {
  const timerDisplay = document.getElementById("questionTimer");
  timerDisplay.innerText = `${seconds}s`;
  quizState.timer = setInterval(() => {
    seconds--;
    timerDisplay.innerText = `${seconds}s`;
    if (seconds <= 0) {
      clearInterval(quizState.timer);
      submitAnswer();
    }
  }, 1000);
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    const key = e.key.toUpperCase();
    if (["A", "B", "C", "D"].includes(key)) {
      const option = document.getElementById(`option_${key}`);
      if (option && !option.disabled) option.checked = true;
    } else if (e.key === "Enter") {
      submitAnswer();
    }
  });
}




















