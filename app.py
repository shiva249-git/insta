import os
import uuid
from flask import Flask, request, jsonify, render_template
from openai import OpenAI

app = Flask(__name__)

# Initialize OpenAI client
api_key = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

# Store active quiz sessions in memory
sessions = {}

def generate_ssc_question(topic):
    """Ask GPT-4 to generate an SSC CGL MCQ."""
    prompt = f"""
Generate one SSC CGL multiple choice question on the topic "{topic}".
Provide:
- The question
- Four options (A, B, C, D)
- The correct answer letter
- A brief explanation

Format your response exactly like this:
Question: <question text>
A) <option A>
B) <option B>
C) <option C>
D) <option D>
Answer: <correct option letter>
Explanation: <short explanation>
"""

    completion = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are an SSC CGL exam question generator."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.5
    )

    return completion.choices[0].message.content

@app.route("/", methods=["GET"])
def home():
    return render_template("index.html")
@app.route("/quiz", methods=["POST"])
def quiz_endpoint():
    return start_quiz()

@app.route("/quiz", methods=["POST"])
def start_quiz():
    data = request.get_json()
    topic = data.get("topic", "General Knowledge")

    question_text = generate_ssc_question(topic)

    # Parse the AI response
    lines = question_text.strip().split("\n")
    question_line = lines[0]
    options_lines = lines[1:5]
    answer_line = next((l for l in lines if l.startswith("Answer:")), "")
    explanation_line = next((l for l in lines if l.startswith("Explanation:")), "")

    question = question_line.replace("Question: ", "").strip()
    options = {}
    for line in options_lines:
        if ") " in line:
            key, val = line.split(") ", 1)
            options[key.strip()] = val.strip()

    answer = answer_line.replace("Answer: ", "").strip()
    explanation = explanation_line.replace("Explanation: ", "").strip()

    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "answer": answer,
        "explanation": explanation
    }

    return jsonify({
        "question": question,
        "options": options,
        "session_id": session_id,
        "message": "Reply with A, B, C or D."
    })

@app.route("/answer", methods=["POST"])
def check_answer():
    data = request.get_json()
    session_id = data.get("session_id")
    user_answer = data.get("answer", "").strip().upper()

    if session_id not in sessions:
        return jsonify({"error": "Invalid or expired session_id."}), 400

    correct_answer = sessions[session_id]["answer"]
    explanation = sessions[session_id]["explanation"]

    # Remove session after answer checked
    sessions.pop(session_id)

    if user_answer == correct_answer:
        return jsonify({
            "result": "correct",
            "explanation": explanation
        })
    else:
        return jsonify({
            "result": "incorrect",
            "correct_answer": correct_answer,
            "explanation": explanation
        })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
