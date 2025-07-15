document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("quizForm");
  const topicSelect = document.getElementById("topic");
  const numQuestionsInput = document.getElementById("numQuestions");
  const loadingDiv = document.getElementById("loading");
  const questionArea = document.getElementById("questionArea");
  const questionText = document.getElementById("questionText");
  const optionsDiv = document.getElementById("options");
  const resultDiv = document.getElementById("result");
  const submitAnswerBtn = document.getElementById("submitAnswerBtn");

  let selectedAnswer = null;
  let sessionId = null;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    getQuiz();
  });

  submitAnswerBtn.addEventListener("click", () => {
    submitAnswer();
  });

  function getQuiz() {
    const topic = topicSelect.value.trim();
    let numQuestions = numQuestionsInput.value.trim();
    if (!numQuestions) {
      numQuestions = 10;
    }

    if (!topic) {
      topicSelect.classList.add("is-invalid");
      return;
    } else {
      topicSelect.classList.remove("is-invalid");
    }

    // Show loading
    loadingDiv.style.display = "block";
    questionArea.style.display = "none";
    resultDiv.innerHTML = "";

    fetch("/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        num_questions: Number(numQuestions)
      })
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch quiz question.");
        }
        return response.json();
      })
      .then((data) => {
        // Store session ID for answer submission
        sessionId = data.session_id;

        questionText.textContent = data.question;

        // Clear options
        optionsDiv.innerHTML = "";

        for (const [key, value] of Object.entries(data.options)) {
          const wrapper = document.createElement("div");
          wrapper.className = "form-check";

          const radio = document.createElement("input");
          radio.type = "radio";
          radio.className = "form-check-input";
          radio.name = "answer";
          radio.id = `option_${key}`;
          radio.value = key;
          radio.addEventListener("click", () => {
            selectedAnswer = key;
          });

          const label = document.createElement("label");
          label.className = "form-check-label";
          label.htmlFor = `option_${key}`;
          label.innerText = `${key}) ${value}`;

          wrapper.appendChild(radio);
          wrapper.appendChild(label);
          optionsDiv.appendChild(wrapper);
        }

        questionArea.style.display = "block";
      })
      .catch((error) => {
        console.error(error);
        alert("An error occurred while fetching the quiz.");
      })
      .finally(() => {
        loadingDiv.style.display = "none";
      });
  }

  function submitAnswer() {
    if (!selectedAnswer) {
      alert("Please select an answer before submitting.");
      return;
    }

    loadingDiv.style.display = "block";
    resultDiv.innerHTML = "";

    fetch("/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        answer: selectedAnswer
      })
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to submit answer.");
        }
        return response.json();
      })
      .then((data) => {
        if (data.result === "correct") {
          resultDiv.innerHTML = `<span class="text-success">✅ Correct!</span> ${data.explanation}`;
        } else {
          resultDiv.innerHTML = `<span class="text-danger">❌ Incorrect.</span> Correct Answer: <strong>${data.correct_answer}</strong>. ${data.explanation}`;
        }

        questionArea.style.display = "none";
      })
      .catch((error) => {
        console.error(error);
        alert("An error occurred while submitting your answer.");
      })
      .finally(() => {
        loadingDiv.style.display = "none";
      });
  }
});
