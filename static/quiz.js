document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startQuizBtn");
  if (startBtn) {
    startBtn.addEventListener("click", getQuiz);
  }
});

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

  console.log("Requesting quiz for:", topic, "Questions:", numQuestions);

  document.getElementById("loading").style.display = "block";
  document.getElementById("questionArea").style.display = "none";
  document.getElementById("result").innerText = "";

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

      document.getElementById("questionText").innerText = data.question;

      const optionsDiv = document.getElementById("options");
      optionsDiv.innerHTML = "";

      for (const [key, value] of Object.entries(data.options)) {
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
    })
    .catch(err => {
      document.getElementById("loading").style.display = "none";
      console.error(err);
      alert("Error fetching quiz question.");
    });
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
      session_id: window.sessionId
    })
  })
    .then(response => response.json())
    .then(data => {
      document.getElementById("loading").style.display = "none";

      if (data.result === "correct") {
        document.getElementById("result").innerHTML =
          `<span class="text-success">✅ Correct!</span> ${data.explanation}`;
      } else {
        document.getElementById("result").innerHTML =
          `<span class="text-danger">❌ Incorrect.</span> The correct answer is <strong>${data.correct_answer}</strong>. ${data.explanation}`;
      }

      document.getElementById("questionArea").style.display = "none";
    })
    .catch(err => {
      document.getElementById("loading").style.display = "none";
      console.error(err);
      alert("Error submitting answer.");
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startQuizBtn");
  if (startBtn) {
    startBtn.addEventListener("click", getQuiz);
  }
});
