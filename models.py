from extensions import db

class QuizQuestion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    topic = db.Column(db.String(100), nullable=False)
    level = db.Column(db.String(50), nullable=False)
    question = db.Column(db.Text, nullable=False)
    options = db.Column(db.JSON, nullable=False)   # store choices as JSON
    correct_answer = db.Column(db.String(200), nullable=False)
    explanation = db.Column(db.Text, nullable=True)
