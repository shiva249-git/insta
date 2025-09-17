document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-quiz-btn");
  if (!startBtn) {
    console.warn("⚠️ Start button not found");
    return;
  }

  startBtn.addEventListener("click", async () => {
    const topic = document.getElementById("topic").value;
    const level = document.getElementById("level").value;
    const numQuestions = document.getElementById("num_questions").value;
    const csrfTokenInput = document.querySelector('input[name="csrf_token"]');
    const csrfToken = csrfTokenInput ? csrfTokenInput.value : "";

    if (!topic || !level || !numQuestions) {
      alert("Please fill all fields");
      return;
    }

    try {
      const response = await fetch("/quiz/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken
        },
        body: JSON.stringify({ topic, level, num_questions: numQuestions })
      });

      const data = await response.json();

      if (response.ok && data.questions && data.session_id) {
        renderQuiz(data.questions, data.session_id, topic, level, csrfToken);
      } else {
        alert(data.error || "Failed to fetch quiz");
      }

    } catch (err) {
      console.error("Fetch error:", err);
      alert("Error starting quiz");
    }
  });
});

// --- Render Quiz ---
function renderQuiz(questions, sessionId, topic, level, csrfToken) {
  const container = document.querySelector(".quiz-card");
  container.innerHTML = `
    <h3 class="mt-3 text-center">Quiz on ${topic} (${level})</h3>
    <form id="quiz-form">
      ${questions.map((q, idx) => `
        <div class="mb-4">
          <p><strong>Q${idx + 1}:</strong> ${q.question}</p>
          ${Object.entries(q.options).map(([key, val]) => `
            <div class="form-check">
              <input class="form-check-input" type="radio"
                     name="${q.id}" id="${q.id}_${key}" value="${key}" required>
              <label class="form-check-label" for="${q.id}_${key}">
                ${key}) ${val}
              </label>
            </div>
          `).join("")}
        </div>
        <hr>
      `).join("")}
      <div class="d-grid">
        <button type="submit" class="btn btn-success btn-lg">Submit Answers</button>
      </div>
    </form>
  `;

  document.getElementById("quiz-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const answers = {};
    formData.forEach((val, key) => answers[key] = val);

    try {
      const response = await fetch(`/quiz/submit/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
        body: JSON.stringify({ answers })
      });

      const result = await response.json();
      if (result.error) { alert("Error: " + result.error); return; }
      showResults(result);

    } catch (err) {
      console.error("❌ Submit error:", err);
      alert("Something went wrong while submitting the quiz.");
    }
  });
}

// --- Show Results ---
function showResults(result) {
  const container = document.querySelector(".quiz-card");
  container.innerHTML = `
    <h3 class="text-center">Quiz Results</h3>
    <p class="text-center">Score: ${result.score}/${result.total}</p>
    <hr>
    ${result.details.map((d, idx) => `
      <div class="mb-3">
        <p><strong>Q${idx + 1}:</strong> ${d.question}</p>
        <p>Your Answer: ${d.user_answer || "Not Answered"} | Correct Answer: ${d.correct_answer}</p>
        <p><em>Explanation:</em> ${d.explanation}</p>
      </div>
      <hr>
    `).join("")}
    <div class="d-grid mt-3">
      <button onclick="window.location.reload()" class="btn btn-primary btn-lg">Try Again</button>
    </div>
  `;
}
