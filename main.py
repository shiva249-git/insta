import os
import uuid
from datetime import datetime, timezone
from flask import Flask, render_template, redirect, url_for, flash, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_wtf import FlaskForm, CSRFProtect
from flask_wtf.csrf import generate_csrf
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Email, EqualTo
from openai import OpenAI
from dotenv import load_dotenv

# ------------------- Load environment -------------------
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    client = OpenAI(api_key=OPENAI_API_KEY)
else:
    client = None
    print("⚠ WARNING: OpenAI API key not found. AI generation disabled.")

# ------------------- Flask App -------------------
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or 'supersecretkey'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///quiz_app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SECURE'] = False  # True if HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# ------------------- Extensions -------------------
db = SQLAlchemy(app)
csrf = CSRFProtect(app)
limiter = Limiter(app=app, key_func=get_remote_address)
login_manager = LoginManager(app)
login_manager.login_view = "login"

# ------------------- Models -------------------
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ------------------- Forms -------------------
class RegisterForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    confirm_password = PasswordField('Confirm Password', validators=[
        DataRequired(), EqualTo('password', message="Passwords must match")
    ])
    submit = SubmitField('Register')

class LoginForm(FlaskForm):
    user_identifier = StringField('Username or Email', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

class DummyForm(FlaskForm):
    pass

# ------------------- Quiz session storage -------------------
quiz_sessions = {}

# ------------------- OpenAI SSC Question Logic -------------------
def generate_ssc_prompt(topic, level="Medium", num_options=4):
    return f"""
You are an expert question setter for the SSC CGL exam in India.

Please generate **one single multiple-choice question** for the SSC CGL exam on the topic: "{topic}".

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
"""

def generate_ssc_question_openai(topic, level="Medium"):
    if client is None:
        raise RuntimeError("OpenAI client not initialized. Set your OPENAI_API_KEY.")

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
    try:
        lines = ai_text.splitlines()
        question = lines[0].replace("Question:", "").strip()
        options = {line.split(")")[0].strip(): line.split(")")[1].strip() for line in lines[1:5]}
        answer = [l.replace("Answer:", "").strip().upper() for l in lines if l.startswith("Answer:")][0]
        explanation = [l.replace("Explanation:", "").strip() for l in lines if l.startswith("Explanation:")][0]
        return question, options, answer, explanation
    except Exception as e:
        print("❌ Error parsing AI response:", e)
        raise ValueError("Failed to parse AI response")

# ------------------- Context Processors -------------------
@app.context_processor
def inject_csrf_token():
    return dict(csrf_token=generate_csrf())

@app.context_processor
def inject_now():
    return {'now': datetime.now(timezone.utc)}

# ------------------- CSP -------------------
@app.after_request
def add_csp_headers(response):
    csp = (
        "default-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; "
        "font-src 'self' https://fonts.gstatic.com;"
    )
    response.headers['Content-Security-Policy'] = csp
    return response

# ------------------- Routes -------------------
@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    form = RegisterForm()
    if form.validate_on_submit():
        if User.query.filter_by(username=form.username.data).first():
            flash('Username already taken', 'warning')
        elif User.query.filter_by(email=form.email.data).first():
            flash('Email already registered', 'warning')
        else:
            hashed_pw = generate_password_hash(form.password.data)
            new_user = User(username=form.username.data, email=form.email.data, password_hash=hashed_pw)
            db.session.add(new_user)
            db.session.commit()
            flash('Registration successful. Please login.', 'success')
            return redirect(url_for('login'))
    return render_template('register.html', form=form)

@app.route('/login', methods=['GET', 'POST'])
@limiter.limit("5 per minute")
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    form = LoginForm()
    if form.validate_on_submit():
        user_identifier = form.user_identifier.data
        user = User.query.filter((User.username==user_identifier) | (User.email==user_identifier)).first()
        if user and check_password_hash(user.password_hash, form.password.data):
            login_user(user)
            flash('Logged in successfully.', 'success')
            next_page = request.args.get('next')
            return redirect(next_page or url_for('dashboard'))
        else:
            flash('Invalid username/email or password', 'danger')
    return render_template('login.html', form=form)

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
    return render_template('dashboard.html', user=current_user)

@app.route("/quiz", methods=["GET", "POST"])
@login_required
def quiz():
    form = DummyForm()
    error = None
    questions = None
    topic = request.form.get("topic")
    level = request.form.get("level")
    num_questions = request.form.get("num_questions", 5, type=int)
    return render_template('quiz.html', form=form, error=error, questions=questions, topic=topic, level=level, num_questions=num_questions)

@app.route("/quiz/fetch", methods=["POST"])
@login_required
def fetch_quiz():
    data = request.get_json()
    topic = data.get("topic")
    level = data.get("level", "Medium")
    num_questions = int(data.get("num_questions", 5))
    if not topic:
        return jsonify({"error": "Topic is required."}), 400

    questions_dict = {}
    questions_list = []

    try:
        for i in range(num_questions):
            question, options, answer, explanation = generate_ssc_question_openai(topic, level)
            question_id = f"q{i+1}_{str(uuid.uuid4())[:8]}"
            questions_dict[question_id] = {
                "question": question,
                "options": options,
                "correct_answer": answer,
                "explanation": explanation
            }
            questions_list.append({
                "id": question_id,
                "question": question,
                "options": options
            })
    except Exception as e:
        return jsonify({"error": "Failed to generate questions from AI.", "details": str(e)}), 500

    session_id = f"session_{str(uuid.uuid4())}"
    quiz_sessions[session_id] = {"questions": questions_dict, "user_answers": {}}

    return jsonify({"session_id": session_id, "questions": questions_list})

@app.route("/answer", methods=["POST"])
@login_required
def check_answer():
    data = request.get_json()
    question_id = data.get("question_id")
    selected_answer = data.get("answer")
    session_id = data.get("session_id")
    if not session_id or not question_id or not selected_answer:
        return jsonify({"error": "Missing parameters."}), 400

    session_data = quiz_sessions.get(session_id)
    if not session_data:
        return jsonify({"error": "Invalid or expired session ID."}), 400

    question_data = session_data["questions"].get(question_id)
    if not question_data:
        return jsonify({"error": "Invalid question ID for this session."}), 400

    correct_answer = question_data["correct_answer"]
    explanation = question_data["explanation"]
    is_correct = (selected_answer.upper() == correct_answer.upper())
    session_data["user_answers"][question_id] = selected_answer.upper()

    return jsonify({"result": "correct" if is_correct else "incorrect", "correct_answer": correct_answer, "explanation": explanation})

@app.route("/practice_papers")
@login_required
def practice_papers():
    papers_folder = os.path.join(app.static_folder, "papers")
    all_papers = []
    if os.path.exists(papers_folder):
        all_papers = [
            {"title": os.path.splitext(f)[0].replace('_', ' ').title(), "filename": f}
            for f in os.listdir(papers_folder) if f.lower().endswith(".pdf")
        ]
    page = request.args.get('page', 1, type=int)
    per_page = 5
    total_pages = (len(all_papers) + per_page - 1) // per_page
    start = (page - 1) * per_page
    end = start + per_page
    return render_template('practice_papers.html', papers=all_papers[start:end], page=page, total_pages=total_pages)

# ------------------- Run -------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
