document.addEventListener("DOMContentLoaded", function () {
  const startBtn = document.getElementById("start-quiz-btn");
  if (!startBtn) return;

  startBtn.addEventListener("click", async () => {
    const topic = document.getElementById("topic").value;
    const level = document.getElementById("level").value;
    const num_questions = document.getElementById("num_questions").value;

    if (!topic || !level || !num_questions) {
      alert("Please fill all fields.");
      return;
    }

    try {
      const response = await fetch("/quiz/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level, num_questions })
      });

      const data = await response.json();

      if (response.ok) {
        window.location.href = `/quiz/session/${data.session_id}`;
      } else {
        alert(data.error || "Failed to fetch quiz.");
      }
    } catch (err) {
      console.error(err);
      alert("Error fetching quiz.");
    }
  });
});
