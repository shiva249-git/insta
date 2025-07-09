let sessionId = null;
let selectedAnswer = null;

function getQuiz() {
  const topic = document.getElementById("topic").value.trim();
  if (!topic) {
    alert("Please enter a topic!");
    return;
  }

  document.getElementById("loading").style.display = "block";
  document.getElementById("questionArea").style.display = "none";
  document.getElementById("result").innerText = "";

  fetch("/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic })
  })
    .then(res => {
      if (!res.ok) throw new Error("Server error");
      return res.json();
    })
    .then(data => {
      sessionId = data.session_id;

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
        document.getElementById("result").innerText = `✅ Correct! ${data.explanation}`;
      } else {
        document.getElementById("result").innerText =
          `❌ Incorrect. Correct Answer: ${data.correct_answer}. ${data.explanation}`;
      }
    })
    .catch(err => {
      console.error(err);
      alert("Could not submit answer.");
    })
    .finally(() => {
      document.getElementById("loading").style.display = "none";
    });
}
