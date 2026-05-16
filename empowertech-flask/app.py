import os
import csv
import io
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, Response
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
from datetime import datetime
from collections import Counter

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev_secret")

# MongoDB Setup
try:
    client = MongoClient(os.getenv("MONGODB_URI"))
    db = client.get_default_database(default="empowertech")
except Exception:
    client = MongoClient(os.getenv("MONGODB_URI"))
    db = client["empowertech"]

tickets_col = db.tickets

def format_db_object(obj):
    if not obj: return None
    obj['_id'] = str(obj['_id'])
    if 'id' not in obj:
        obj['id'] = obj.get('ticketId') or str(obj['_id'])
    
    obj.setdefault('user_name', 'Anonymous')
    obj.setdefault('subject', 'No Subject')
    obj.setdefault('service', 'General')
    obj.setdefault('status', 'Open')
    obj.setdefault('priority', 'Low')
    obj.setdefault('messages', [])
    obj.setdefault('manual_replies', [])
    obj.setdefault('admin_notes', [])
    return obj

@app.context_processor
def inject_globals():
    return dict(admin="Project Admin", now=datetime.now())

@app.route('/')
def dashboard():
    try:
        raw_tickets = list(tickets_col.find().sort("created_at", -1))
        formatted_tickets = [format_db_object(t) for t in raw_tickets]
        
        # 1. Main Stats
        stats = {
            "total": len(formatted_tickets),
            "open": len([t for t in formatted_tickets if t['status'] == 'Open']),
            "in_progress": len([t for t in formatted_tickets if t['status'] == 'In Progress']),
            "resolved": len([t for t in formatted_tickets if t['status'] == 'Resolved']),
            "closed": len([t for t in formatted_tickets if t['status'] == 'Closed'])
        }
        
        # 2. Service Breakdown (Required by dashboard.html)
        services = [t.get('service', 'General') for t in formatted_tickets]
        service_counts = dict(Counter(services))
        # Ensure core services exist in dict even if 0
        for s in ['App Development', 'Website Design', 'Consulting', 'Legal Tech Support']:
            service_counts.setdefault(s, 0)

        # 3. Top Intents (Required by dashboard.html)
        intents = [t.get('intent', 'N/A') for t in formatted_tickets if t.get('intent')]
        top_intents = Counter(intents).most_common(6)

        return render_template('dashboard.html', 
                               stats=stats, 
                               service_counts=service_counts,
                               top_intents=top_intents,
                               recent_tickets=formatted_tickets[:5])
    except Exception as e:
        print(f"Dashboard Error: {e}")
        return f"Internal Server Error: {e}", 500

@app.route('/tickets')
def tickets_page():
    status_filter = request.args.get('status', 'All')
    query = {}
    if status_filter != 'All':
        query['status'] = status_filter
        
    search = request.args.get('search', '')
    if search:
        query['$or'] = [
            {'id': {'$regex': search, '$options': 'i'}},
            {'ticketId': {'$regex': search, '$options': 'i'}},
            {'user_name': {'$regex': search, '$options': 'i'}},
            {'userName': {'$regex': search, '$options': 'i'}},
            {'subject': {'$regex': search, '$options': 'i'}}
        ]

    tickets = list(tickets_col.find(query).sort("created_at", -1))
    formatted_tickets = [format_db_object(t) for t in tickets]
    return render_template('tickets.html', tickets=formatted_tickets)

@app.route('/ticket/<ticket_id>', methods=['GET', 'POST'])
def ticket_detail(ticket_id):
    t = tickets_col.find_one({"$or": [{"id": ticket_id}, {"ticketId": ticket_id}]})
    if not t:
        flash("Ticket not found")
        return redirect(url_for('tickets_page'))
    
    return render_template('ticket_detail.html', 
                           ticket=format_db_object(t),
                           all_statuses=['Open', 'In Progress', 'Resolved', 'Closed'],
                           all_priorities=['Low', 'Medium', 'High'])

@app.route('/handoffs')
def handoffs_page():
    return render_template('handoffs.html', handoffs=[])

@app.route('/handoff/<handoff_id>')
def handoff_detail(handoff_id):
    return render_template('handoff_detail.html', handoff={'id': handoff_id, 'messages': []})

@app.route('/export')
def export_csv():
    tickets = list(tickets_col.find())
    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['Ticket ID', 'User', 'Service', 'Status', 'Priority', 'Created At'])
    for t in tickets:
        obj = format_db_object(t)
        cw.writerow([obj.get('id'), obj.get('user_name'), obj.get('service'), obj.get('status'), obj.get('priority'), obj.get('created_at')])
    output = si.getvalue()
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=tickets_export.csv"}
    )

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    return redirect(url_for('login'))

# ── API ENDPOINTS FOR AJAX ──

@app.route('/api/tickets/live')
def live_tickets():
    tickets = list(tickets_col.find().sort("updated_at", -1).limit(20))
    formatted = [format_db_object(t) for t in tickets]
    return jsonify({"tickets": formatted})

@app.route('/api/ticket/<ticket_id>/status', methods=['POST'])
def api_update_status(ticket_id):
    data = request.json
    status = data.get('status')
    tickets_col.update_one({"$or": [{"id": ticket_id}, {"ticketId": ticket_id}]}, {"$set": {"status": status, "updated_at": datetime.now().isoformat()}})
    return jsonify({"ok": True})

@app.route('/api/ticket/<ticket_id>/priority', methods=['POST'])
def api_update_priority(ticket_id):
    data = request.json
    priority = data.get('priority')
    tickets_col.update_one({"$or": [{"id": ticket_id}, {"ticketId": ticket_id}]}, {"$set": {"priority": priority, "updated_at": datetime.now().isoformat()}})
    return jsonify({"ok": True})

@app.route('/api/ticket/<ticket_id>/note', methods=['POST'])
def api_add_note(ticket_id):
    data = request.json
    note = data.get('text')
    tickets_col.update_one({"$or": [{"id": ticket_id}, {"ticketId": ticket_id}]}, {
        "$push": {"admin_notes": {"note": note, "by": "admin", "time": datetime.now().isoformat()}},
        "$set": {"updated_at": datetime.now().isoformat()}
    })
    return jsonify({"ok": True})

@app.route('/api/ticket/<ticket_id>/reply', methods=['POST'])
def api_add_reply(ticket_id):
    data = request.json
    text = data.get('text')
    reply = {"text": text, "by": "admin", "time": datetime.now().isoformat()}
    tickets_col.update_one({"$or": [{"id": ticket_id}, {"ticketId": ticket_id}]}, {
        "$push": {"manual_replies": reply},
        "$set": {"updated_at": datetime.now().isoformat()}
    })
    return jsonify({"ok": True, "reply": reply})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
