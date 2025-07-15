let sessionId = null;
let selectedAnswer = null;

function getQuiz() {
  const topic = document.getElementById("topic").value.trim();
  const numQuestions = 10; // Set to 10 by default

  if (!topic) {
    alert("Please select a topic!");
    return;
  }

  document.getElementById("loading").style.display = "block";
  document.getElementById("questionArea").style.display = "none";
  document.getElementById("result").innerText = "";

  fetch("/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: topic,
      num_questions: parseInt(numQuestions, 10)
    })
  })
    .then(res => {
      if (!res.ok) throw new Error("Server error");
      return res.json();
    })
    .then(data => {
      sessionId = data.session_id;
      selectedAnswer = null;

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
        radio.onclick = () => selectedAnswer = key;

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
      console.error(err);
      alert("Could not load quiz question.");
    })
    .finally(() => {
      document.getElementById("loading").style.display = "none";
    });
}

function submitAnswer() {
  if (!selectedAnswer) {
    alert("Please select an answer!");
    return;
  }

  document.getElementById("loading").style.display = "block";
  document.getElementById("result").innerText = "";

  fetch("/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      answer: selectedAnswer
    })
  })
    .then(res => {
      if (!res.ok) throw new Error("Server error");
      return res.json();
    })
    .then(data => {
      if (data.result === "correct") {
        document.getElementById("result").innerHTML = `<span class="text-success">✅ Correct!</span> ${data.explanation}`;
      } else {
        document.getElementById("result").innerHTML =
          `<span class="text-danger">❌ Incorrect.</span> Correct Answer: <strong>${data.correct_answer}</strong>. ${data.explanation}`;
      }
      document.getElementById("questionArea").style.display = "none";
    })
    .catch(err => {
      console.error(err);
      alert("Could not submit answer.");
    })
    .finally(() => {
      document.getElementById("loading").style.display = "none";
    });
}
