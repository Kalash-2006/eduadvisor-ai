# ══ EduAdvisor AI — app.py ══
# Run: python app.py  →  open http://localhost:5000

import re
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='.', static_url_path='')

# ── Rules ─────────────────────────────────────────────────────
def parse_input(text):
    text = text.lower()
    result = {}
    m = re.search(r'marks?\s*[:\s=]+(\d+(?:\.\d+)?)', text)
    if m: result['marks'] = float(m.group(1))
    m = re.search(r'attendance\s*[:\s=]+(\d+(?:\.\d+)?)', text)
    if m: result['attendance'] = float(m.group(1))
    m = re.search(r'study[_\s]hours?\s*[:\s=]+(\d+(?:\.\d+)?)', text)
    if m: result['study_hours'] = float(m.group(1))
    m = re.search(r'assignments?\s*[:\s=]+(\w+)', text)
    if m: result['assignments'] = m.group(1) in ('yes','true','1','done','complete','completed')
    return result

def analyze(data):
    issues, advice, scores = [], [], []
    critical = warning = 0

    if 'marks' in data:
        m = data['marks']
        scores.append({'label': 'Marks', 'value': f'{m}/100', 'pct': min(m, 100)})
        if m < 40:
            issues.append({'text': f'Marks ({m}/100) are critically low — below passing threshold.', 'severity': 'high'})
            advice.append('Focus on core concepts, attempt past year papers regularly.')
            advice.append('Visit your teacher during office hours for extra help.')
            critical += 1
        elif m < 60:
            issues.append({'text': f'Marks ({m}/100) are average — room to improve.', 'severity': 'medium'})
            advice.append('Revise weak topics first and allocate dedicated study time weekly.')
            warning += 1
        else:
            issues.append({'text': f'Marks ({m}/100) are good — keep it up!', 'severity': 'low'})

    if 'attendance' in data:
        a = data['attendance']
        scores.append({'label': 'Attendance', 'value': f'{a}%', 'pct': min(a, 100)})
        if a < 75:
            issues.append({'text': f'Attendance ({a}%) is below 75% minimum — risk of exam ban!', 'severity': 'high'})
            advice.append('Attend every class. Speak to your counsellor about any personal issues.')
            critical += 1
        elif a < 85:
            issues.append({'text': f'Attendance ({a}%) meets minimum but could be better.', 'severity': 'medium'})
            advice.append('Aim for 85%+ attendance for better learning outcomes.')
            warning += 1
        else:
            issues.append({'text': f'Excellent attendance ({a}%)! This is a key success factor.', 'severity': 'low'})

    if 'study_hours' in data:
        sh = data['study_hours']
        scores.append({'label': 'Study Hrs', 'value': f'{sh}h/day', 'pct': min((sh/8)*100, 100)})
        if sh < 2:
            issues.append({'text': f'Only {sh}h/day study — well below the recommended 2–4 hours.', 'severity': 'high'})
            advice.append('Build a daily timetable. Start with 30-min Pomodoro sessions.')
            critical += 1
        elif sh < 4:
            issues.append({'text': f'{sh}h/day is acceptable but increasing will help.', 'severity': 'medium'})
            advice.append('Try to reach 4+ hours spread across morning and evening.')
            warning += 1
        else:
            issues.append({'text': f'Great study habit — {sh}h/day. Ensure it is focused study.', 'severity': 'low'})

    if 'assignments' in data:
        done = data['assignments']
        if not done:
            issues.append({'text': 'Not completing assignments hurts internal marks badly.', 'severity': 'high'})
            advice.append('Submit all assignments, even if imperfect — consistency matters.')
            critical += 1
        else:
            issues.append({'text': 'Good — you complete assignments regularly. Keep it up!', 'severity': 'low'})

    if not data:
        return {'status': 'unknown', 'summary': 'No data detected. Please provide your marks, attendance, study hours and assignment status.', 'issues': [], 'advice': [], 'scores': []}

    if critical >= 2:
        status  = 'critical'
        summary = 'Multiple critical issues detected. Immediate action required to avoid failing this semester.'
    elif critical == 1 or warning >= 2:
        status  = 'warning'
        summary = 'Some areas need improvement. With focused effort, you can turn things around quickly.'
    else:
        status  = 'good'
        summary = 'Overall good performance! Keep your current habits and work on the areas below.'

    if not advice:
        advice.append('Review your notes within 24 hours of each class for better retention.')

    return {'status': status, 'summary': summary, 'issues': issues, 'advice': advice, 'scores': scores}

# ── Routes ────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/chat.html')
def chat_page():
    return send_from_directory('.', 'chat.html')

@app.route('/chat', methods=['POST'])
def chat():
    body = request.get_json(silent=True)
    if not body or 'message' not in body:
        return jsonify({'status': 'error', 'summary': 'No message.', 'issues': [], 'advice': [], 'scores': []}), 400
    parsed = parse_input(body['message'])
    return jsonify(analyze(parsed))

if __name__ == '__main__':
    print("\n🎓 EduAdvisor AI running!")
    print("   Home  → http://localhost:5000")
    print("   Chat  → http://localhost:5000/chat.html\n")
    app.run(debug=True, port=5000)
