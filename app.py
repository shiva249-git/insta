import os
import uuid
from flask import Flask, request, jsonify, render_template
from openai import OpenAI

app = Flask(__name__)

# Initialize OpenAI client
api_key = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

# In-memory store for active quiz sessions
sessions = {}

def generate_ssc_question(topic):
    """
    Ask GPT-4 to generate an SSC CGL MCQ with clean parsing.
    """
    prompt = f"""
Generate one SSC CGL multiple choice question on the topic "{topic}".
Steps:
1. Create the question.
2. Generate four unique options labeled A, B, C, D.
3. Choose the correct answer letter (A/B/C/D).
4. Provide a short explanation.

Format strictly like this:
Question: <question>
A) <Option A>
B) <Option B>
C) <Option C>
D) <Option D>
Answer: <A/B/C/D>
Explanation: <brief explanation>
"""

    completion = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are an SSC CGL question generator."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.5
    )

    ai_text = completion.choices[0].message.content.strip()
    print("AI response:\n", ai_text)

    try:
        lines = ai_text.splitlines()
        question = lines[0].replace("Question:", "").strip()

        options = {}
        for i in range(1, 5):
            if ") " in lines[i]:
                key, val = lines[i].split(") ", 1)
                options[key.strip()] = val.strip()

        answer_line = next(l for l in lines if l.startswith("Answer:"))
        raw_answer = answer_line.replace("Answer:", "").strip()

        # Accept either "C" or "C) text" from model
        if ") " in raw_answer:
            answer_letter, _ = raw_answer.split(") ", 1)
        else:
            answer_letter = raw_answer

        answer = answer_letter.strip()

        if answer not in options:
            raise ValueError(f"Invalid answer option: '{raw_answer}'")

        explanation_line = next(l for l in lines if l.startswith("Explanation:"))
        explanation = explanation_line.replace("Explanation:", "").strip()

        return question, options, answer, explanation

    except Exception as e:
        print("❌ Error parsing AI response:", e)
        raise ValueError("Failed to parse AI response")

@app.route("/", methods=["GET"])
def home():
    return render_template("index.html")

@app.route("/quiz", methods=["POST"])
def start_quiz():
    try:
        data = request.get_json()
        topic = data.get("topic", "General Knowledge")

        question, options, answer, explanation = generate_ssc_question(topic)

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

    except Exception as e:
        print("❌ Error in /quiz:", e)
        return jsonify({"error": "Could not generate question."}), 500

@app.route("/answer", methods=["POST"])
def check_answer():
    try:
        data = request.get_json()
        session_id = data.get("session_id")
        user_answer = data.get("answer", "").strip().upper()

        if session_id not in sessions:
            return jsonify({"error": "Invalid or expired session_id."}), 400

        correct_answer = sessions[session_id]["answer"]
        explanation = sessions[session_id]["explanation"]

        # Clean up session after answer
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

    except Exception as e:
        print("❌ Error in /answer:", e)
        return jsonify({"error": "Internal server error occurred. Check logs."}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
