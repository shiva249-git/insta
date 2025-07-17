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

function getQuiz() {
  const topic = document.getElementById("topic").value.trim();
  const numQuestionsField = document.getElementById("numQuestions");
  let numQuestions = numQuestionsField ? numQuestionsField.value.trim() : "10";

  if (!topic) {
    alert("Please select a topic.");
    return;
  }

  if (!numQuestions) {
    numQuestions = "10";
  }

  document.getElementById("loading").style.display = "block";
  document.getElementById("questionArea").style.display = "none";
  document.getElementById("result").innerText = "";
  document.getElementById("finalScore").innerText = "";

  fetch("/quiz/fetch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      topic: topic,
      num_questions: parseInt(numQuestions, 10)
    })
  })
    .then(response => response.json())
    .then(data => {
      document.getElementById("loading").style.display = "none";

      if (data.error) {
        alert(data.error);
        return;
      }

      quizData = data.questions; // expecting an array of questions
      currentQuestionIndex = 0;
      score = 0;
      window.sessionId = data.session_id;

      renderQuestion();
    })
    .catch(err => {
      document.getElementById("loading").style.display = "none";
      console.error(err);
      alert("Error fetching quiz.");
    });
}

function renderQuestion() {
  if (currentQuestionIndex >= quizData.length) {
    showFinalScore();
    return;
  }

 const question = quizData[currentQuestionIndex];

  if (!question) return;

  document.getElementById("questionText").innerText = question.question;

  const optionsDiv = document.getElementById("options");
  optionsDiv.innerHTML = "";

  for (const [key, value] of Object.entries(question.options)) {
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
  }

  document.getElementById("questionArea").style.display = "block";
  document.getElementById("result").innerHTML = "";
}

function submitAnswer() {
  const selected = document.querySelector('input[name="answer"]:checked');
  if (!selected) {
    alert("Please select an answer!");
    return;
  }

  const answer = selected.value;

  document.getElementById("loading").style.display = "block";

  fetch("/answer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      answer: answer,
      session_id: window.sessionId,
      question_id: quizData[currentQuestionIndex].id  // You should provide ID from backend
    })
  })
    .then(response => response.json())
    .then(data => {
      document.getElementById("loading").style.display = "none";

      if (data.result === "correct") {
        score += 1;
        document.getElementById("result").innerHTML =
          `<span class="text-success">✅ Correct!</span> ${data.explanation || ''}`;
      } else {
        document.getElementById("result").innerHTML =
          `<span class="text-danger">❌ Incorrect.</span> Correct: <strong>${data.correct_answer}</strong>. ${data.explanation || ''}`;
      }

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
      document.getElementById("loading").style.display = "none";
      console.error(err);
      alert("Error submitting answer.");
    });
}

function showFinalScore() {
  document.getElementById("questionArea").style.display = "none";
  document.getElementById("finalScore").innerHTML =
    `<h4>You scored ${score} out of ${quizData.length}</h4>`;
}
