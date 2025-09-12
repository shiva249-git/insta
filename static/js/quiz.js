document.addEventListener("DOMContentLoaded", function () {
  const startBtn = document.getElementById("start-quiz-btn");

  if (startBtn) {
    startBtn.addEventListener("click", async function () {
      const topic = document.getElementById("topic").value;
      const level = document.getElementById("level").value;
      const numQuestions = document.getElementById("num_questions").value;

      if (!topic || !level || !numQuestions) {
        alert("Please select all fields before starting the quiz.");
        return;
      }

      try {
        const response = await fetch("/quiz/fetch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topic: topic,
            level: level,
            num_questions: numQuestions,
          }),
        });

        const data = await response.json();

        if (data.error) {
          alert("Error: " + data.error);
          return;
        }

        // Replace the quiz setup form with generated questions
        renderQuiz(data.questions, data.session_id, topic, level);

      } catch (err) {
        console.error("Fetch error:", err);
        alert("Something went wrong while starting the quiz.");
      }
    });
  }

  function renderQuiz(questions, sessionId, topic, level) {
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

    // Handle submit
    document.getElementById("quiz-form").addEventListener("submit", async function (e) {
      e.preventDefault();

      const formData = new FormData(this);
      const answers = {};
      formData.forEach((val, key) => {
        answers[key] = val;
      });

      try {
        const response = await fetch(`/quiz/submit/${sessionId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ answers: answers }),
        });

        const result = await response.json();

        if (result.error) {
          alert("Error: " + result.error);
          return;
        }

        // Show score + explanations
        showResults(result);

      } catch (err) {
        console.error("Submit error:", err);
        alert("Something went wrong while submitting the quiz.");
      }
    });
  }

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
});
