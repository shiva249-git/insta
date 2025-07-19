import os
import uuid
import random
from datetime import datetime, timezone
from flask import Flask, request, jsonify, render_template, redirect, url_for, flash, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_wtf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from redis import Redis
from werkzeug.security import generate_password_hash, check_password_hash
from openai import OpenAI
from flask_wtf.csrf import CSRFProtect
from dotenv import load_dotenv
from flask_wtf.csrf import generate_csrf

load_dotenv()

redis_client = Redis(host='localhost', port=6379)


app = Flask(__name__)


app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or os.urandom(24)

app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'


csrf = CSRFProtect()
csrf.init_app(app)


limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    storage_uri="memory://"
)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'quiz_app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


login_manager = LoginManager(app)
login_manager.login_view = "login"

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


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

@app.after_request
def apply_csp(response):
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    return response


@app.context_processor
def inject_csrf_token():
    return dict(csrf_token=generate_csrf())

@app.context_processor
def inject_now():
    return {'now': datetime.now(timezone.utc)}


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = generate_password_hash(request.form['password'])

        # Check if email already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('Email already registered. Please log in.', 'warning')
            return redirect(url_for('login'))
        existing_username = User.query.filter_by(username=username).first()
        if existing_username:
            flash('Username already taken. Please choose another.', 'warning')
            return redirect(url_for('register'))



        new_user = User(username=username, email=email, password=password)
        db.session.add(new_user)
        db.session.commit()

        flash('Registration successful. Please log in.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')

@limiter.limit("5 per minute")
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password, password):
            login_user(user)
            flash("Logged in successfully!", "success")
            return redirect(url_for("dashboard"))
        else:
            flash("Invalid credentials.", "danger")
            return redirect(url_for("login"))

    return render_template("login.html",)

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
    questions = None
    error = None

    if request.method == "POST":
        topic = request.form.get("topic")
        level = request.form.get("level") or "Medium"
        num_questions = request.form.get("num_questions", type=int) or 5

        if not topic:
            error = "Please select a topic."
        else:
            try:
                # Call your AI question generation function here
                questions = []
                for _ in range(num_questions):
                    q, opts, ans, exp = generate_ssc_question_openai(topic, level)
                    questions.append({
                        "question": q,
                        "options": opts,
                        "answer": ans,
                        "explanation": exp
                    })
            except Exception as e:
                error = f"Error generating questions: {str(e)}"

    return render_template(
        "quiz.html",
        topic=topic,
        level=level,
        num_questions=num_questions,
        questions=questions,
        error=error
    )

@app.route("/quiz/fetch", methods=["POST"])
@login_required
def fetch_quiz():
    data = request.get_json()
    topic = data.get("topic")
    level = data.get("level", "Medium")

    if not topic:
        return jsonify({"error": "Topic is required."}), 400

    try:
        question, options, answer, explanation = generate_ssc_question_openai(topic, level)

        session_id = "session_" + str(random.randint(1000, 9999))

        return jsonify({
            "session_id": session_id,
            "questions": [
                {
                    "id": session_id + "_q1",
                    "question": question,
                    "options": options,
                    "correct_answer": answer,
                    "explanation": explanation
                }
            ]
        })

    except Exception as e:
        return jsonify({"error": "Failed to generate question from AI.", "details": str(e)}), 500


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

@app.after_request
def add_csp_headers(response):
    csp = (
        "default-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src https://fonts.gstatic.com; "
        "script-src 'self';"
    )
    response.headers['Content-Security-Policy'] = csp
    return response



if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # This creates all tables based on your models
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
