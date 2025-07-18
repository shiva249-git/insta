import os
import uuid

from flask import Flask, request, jsonify, render_template, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user  # this is correct
from werkzeug.security import generate_password_hash, check_password_hash
from openai import OpenAI

import random



app = Flask(__name__)

app.config["SECRET_KEY"] = "your-secret-key"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///quiz_app.db"
db = SQLAlchemy(app)

login_manager = LoginManager(app)
login_manager.init_app(app)
login_manager.login_view = "login"

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Initialize OpenAI client
api_key = os.environ.get("OPENAI_API_KEY")

if api_key:
    client = OpenAI(api_key=api_key)
else:
    client = None

# In-memory store for active quiz sessions
quiz_sessions = {}

def generate_ssc_prompt(topic, level="Medium", num_options=4):
    return f"""
You are an expert question setter for the SSC CGL exam in India.

Please generate **one single multiple-choice question** for the SSC CGL exam on the topic: \"{topic}\". 

- The question should be suitable for the {level} difficulty level.
- Provide exactly {num_options} options, each uniquely labeled as A), B), C), D).
- Mark the correct answer clearly.
- Provide a short explanation in 1-2 sentences that helps a student understand why the answer is correct.

**IMPORTANT: Follow this output format EXACTLY (no extra text, no markdown, no titles):**

Question: <your question text here>
A) <option A>
B) <option B>
C) <option C>
D) <option D>
Answer: <one letter A/B/C/D>
Explanation: <1-2 sentence explanation>

Example:
Question: What is the capital of India?
A) Mumbai
B) Kolkata
C) New Delhi
D) Chennai
Answer: C
Explanation: New Delhi is the capital of India and houses important government institutions.

Now generate the question.
"""

      
def generate_ssc_question_openai(topic, level="Medium"):
    prompt = generate_ssc_prompt(topic, level)

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


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            flash('Username already exists. Please choose another.', 'danger')
            return redirect(url_for('register'))

        hashed_password = generate_password_hash(password, method='sha256')
        user = User(username=username, password_hash=hashed_password)
        db.session.add(user)
        db.session.commit()

        flash("✅ Registration successful. Please log in.", "success")
        return redirect(url_for('login'))  # <-- user is redirected to login

    return render_template_string('register.html')


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            flash("Logged in successfully!", "success")
            return redirect(url_for("dashboard"))
        else:
            flash("Invalid credentials.", "danger")
            return redirect(url_for("login"))

    return render_template("login.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))

@app.route("/")
@login_required
def home():
    return redirect(url_for('dashboard'))

@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html")

@app.route("/practice_papers")
@login_required
def practice_papers():
    return render_template("practice_papers.html")


@login_required
@app.route("/quiz", methods=["GET", "POST"])
def quiz():
    topic = None
    level = None
    num_questions = None

    if request.method == "POST":
        topic = request.form.get("topic")
        level = request.form.get("level")
        num_questions = request.form.get("num_questions", type=int)

        print("User selected topic:", topic)
        print("Difficulty level:", level)
        print("Number of questions:", num_questions)

    return render_template(
        "quiz.html",
        topic=topic,
        level=level,
        num_questions=num_questions
    )

@app.route("/quiz/fetch", methods=["POST"])
def fetch_quiz():
    data = request.get_json()
    topic = data.get("topic")
    level = data.get("level", "Medium")
    num_questions = int(data.get("num_questions", 5))

    if not topic:
        return jsonify({"error": "Topic is required."}), 400

    questions_list = []
    session_id = "session_" + str(random.randint(1000, 9999))
    quiz_sessions[session_id] = {}

    for i in range(num_questions):
        try:
            q_text, options, correct_answer, explanation = generate_ssc_question_openai(topic, level)
            qid = f"q{i+1}"
            questions_list.append({
                "id": qid,
                "question": q_text,
                "options": options
            })
            quiz_sessions[session_id][qid] = {
                "correct_answer": correct_answer,
                "explanation": explanation
            }
        except Exception as e:
            print(f"⚠️ Skipping question {i+1} due to error:", e)
            continue

    if not questions_list:
        return jsonify({"error": f"No valid questions generated for topic '{topic}'."}), 500

    return jsonify({
        "session_id": session_id,
        "questions": questions_list
    })

@login_required
@app.route("/answer", methods=["POST"])
def check_answer():
    data = request.get_json()
    question_id = data.get("question_id")
    selected_answer = data.get("answer")
    session_id = data.get("session_id")

    if not session_id or not question_id:
        return jsonify({"error": "Session ID and Question ID are required."}), 400

    session_data = quiz_sessions.get(session_id)
    if not session_data:
        return jsonify({"error": "Invalid or expired session ID."}), 400

    question_data = session_data.get(question_id)
    if not question_data:
        return jsonify({"error": "Invalid question ID for this session."}), 400

    correct_answer = question_data["correct_answer"]
    explanation = question_data["explanation"]

    result = "correct" if selected_answer == correct_answer else "incorrect"

    return jsonify({
        "result": result,
        "correct_answer": correct_answer,
        "explanation": explanation
    })



if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
