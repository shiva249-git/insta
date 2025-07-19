document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startQuizBtn");
  if (startBtn) {
    startBtn.addEventListener("click", getQuiz);
  }

  const submitBtn = document.getElementById("submitAnswerBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitAnswer);
  }
});

let quizData = [];
let currentQuestionIndex = 0;
let score = 0;
window.sessionId = null;

// Read CSRF token from meta tag (adjust if different)
const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
const csrfToken = csrfTokenMeta ? csrfTokenMeta.getAttribute('content') : null;

function getQuiz() {
  const topicElem = document.getElementById("topic");
  const topic = topicElem ? topicElem.value.trim() : "";
  const numQuestionsField = document.getElementById("numQuestions");
  let numQuestions = numQuestionsField ? numQuestionsField.value.trim() : "5";

  if (!topic) {
    alert("Please select a topic.");
    return;
  }

  if (!numQuestions || isNaN(numQuestions) || numQuestions < 1) {
    numQuestions = "5";
  }

  showLoading(true);
  resetQuizUI();

  fetch("/quiz/fetch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {})
    },
    body: JSON.stringify({
      topic: topic,
      num_questions: parseInt(numQuestions, 10)
    })
  })
  .then(res => res.json())
  .then(data => {
    showLoading(false);

    if (data.error) {
      alert(data.error);
      return;
    }

    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      alert("No questions received.");
      return;
    }

    quizData = data.questions;
    currentQuestionIndex = 0;
    score = 0;
    window.sessionId = data.session_id;

    renderQuestion();
  })
  .catch(err => {
    showLoading(false);
    console.error("Fetch quiz error:", err);
    alert("Error fetching quiz questions.");
  });
}

function renderQuestion() {
  if (currentQuestionIndex >= quizData.length) {
    showFinalScore();
    return;
  }

  const questionObj = quizData[currentQuestionIndex];
  if (!questionObj) {
    alert("Question data missing.");
    return;
  }

  document.getElementById("questionText").innerText = questionObj.question || "";

  const optionsDiv = document.getElementById("options");
  optionsDiv.innerHTML = "";

  // Assuming options is an object with keys "A", "B", "C", "D"
  const options = questionObj.options;
  if (!options || typeof options !== "object") {
    alert("Question options are invalid.");
    return;
  }

  Object.entries(options).forEach(([key, value]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "form-check";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.className = "form-check-input";
    radio.name = "answer";
    radio.value = key;
    radio.id = `option_${key}`;

    const label = document.createElement("label");
    label.className = "form-check-label";
    label.setAttribute("for", `option_${key}`);
    label.innerText = `${key}) ${value}`;

    wrapper.appendChild(radio);
    wrapper.appendChild(label);
    optionsDiv.appendChild(wrapper);
  });

  document.getElementById("questionArea").style.display = "block";
  document.getElementById("result").innerHTML = "";
  document.getElementById("finalScore").innerHTML = "";
}

function submitAnswer() {
  const selected = document.querySelector('input[name="answer"]:checked');
  if (!selected) {
    alert("Please select an answer!");
    return;
  }

  const answer = selected.value;
  showLoading(true);

  fetch("/answer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {})
    },
    body: JSON.stringify({
      answer: answer,
      session_id: window.sessionId,
      question_id: quizData[currentQuestionIndex].id
    })
  })
  .then(res => res.json())
  .then(data => {
    showLoading(false);

    if (data.error) {
      alert(data.error);
      return;
    }

    if (data.result === "correct") {
      score++;
      document.getElementById("result").innerHTML =
        `<span style="color:green; font-weight:bold;">✅ Correct!</span><br>${data.explanation || ""}`;
    } else {
      document.getElementById("result").innerHTML =
        `<span style="color:red; font-weight:bold;">❌ Incorrect.</span><br>Correct Answer: <strong>${data.correct_answer}</strong><br>${data.explanation || ""}`;
    }

    // Wait 1.5 seconds before next question
    setTimeout(() => {
      currentQuestionIndex++;
      if (currentQuestionIndex < quizData.length) {
        renderQuestion();
      } else {
        showFinalScore();
      }
    }, 1500);
  })
  .catch(err => {
    showLoading(false);
    console.error("Submit answer error:", err);
    alert("Error submitting answer.");
  });
}

function showFinalScore() {
  document.getElementById("questionArea").style.display = "none";
  document.getElementById("result").innerHTML = "";
  document.getElementById("finalScore").innerHTML = `<h3>Your score: ${score} / ${quizData.length}</h3>`;
}

function showLoading(show) {
  const loader = document.getElementById("loading");
  if (loader) {
    loader.style.display = show ? "block" : "none";
  }
}

function resetQuizUI() {
  document.getElementById("questionArea").style.display = "none";
  document.getElementById("result").innerHTML = "";
  document.getElementById("finalScore").innerHTML = "";
}
