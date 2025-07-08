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
      let resultHtml;
      if (data.result === "correct") {
        resultHtml = `<span class="text-success">✅ Correct! ${data.explanation}</span>`;
      } else {

        resultHtml = `<span class="text-danger">❌ Wrong. Correct answer is ${data.correct_answer}. ${data.explanation}</span>`;
      }
      document.getElementById("result").innerHTML = resultHtml;

      // Clear selection for next quiz
      document.querySelectorAll('input[name="answer"]').forEach(radio => {
        radio.checked = false;
      });
      selectedAnswer = null;
    })
    .catch(err => {
      console.error(err);
      alert("Could not submit your answer.");
    })
    .finally(() => {
      document.getElementById("loading").style.display = "none";
    });
}

