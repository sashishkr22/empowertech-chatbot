import os
import csv
import io
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, Response
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev_secret")

# MongoDB Setup
client = MongoClient(os.getenv("MONGODB_URI"))
db = client.get_database()
tickets_col = db.tickets

def format_db_object(obj):
    if not obj: return None
    obj['_id'] = str(obj['_id'])
    # Ensure 'id' exists (it should in our schema, but just in case)
    if 'id' not in obj and 'ticketId' in obj:
        obj['id'] = obj['ticketId']
    return obj

@app.route('/')
def dashboard():
    tickets = list(tickets_col.find().sort("created_at", -1))
    formatted_tickets = [format_db_object(t) for t in tickets]
    
    stats = {
        "total": len(tickets),
        "open": len([t for t in tickets if t.get('status') == 'Open']),
        "in_progress": len([t for t in tickets if t.get('status') == 'In Progress']),
        "resolved": len([t for t in tickets if t.get('status') == 'Resolved']),
        "closed": len([t for t in tickets if t.get('status') == 'Closed'])
    }
    
    return render_template('dashboard.html', stats=stats, recent_tickets=formatted_tickets[:5])

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
            {'user_name': {'$regex': search, '$options': 'i'}},
            {'subject': {'$regex': search, '$options': 'i'}}
        ]

    tickets = list(tickets_col.find(query).sort("created_at", -1))
    formatted_tickets = [format_db_object(t) for t in tickets]
    return render_template('tickets.html', tickets=formatted_tickets)

@app.route('/ticket/<ticket_id>', methods=['GET', 'POST'])
def ticket_detail(ticket_id):
    if request.method == 'POST':
        # Fallback for non-JS form submission if any
        action = request.form.get('action')
        if action == 'add_reply':
            reply_text = request.form.get('reply')
            tickets_col.update_one({"id": ticket_id}, {
                "$push": {"manual_replies": {"text": reply_text, "by": "admin", "time": datetime.now().isoformat()}},
                "$set": {"updated_at": datetime.now().isoformat()}
            })
            flash("Reply sent")
        return redirect(url_for('ticket_detail', ticket_id=ticket_id))

    t = tickets_col.find_one({"id": ticket_id})
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
    return render_template('handoff_detail.html', handoff={})

@app.route('/export')
def export_csv():
    tickets = list(tickets_col.find())
    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['Ticket ID', 'User', 'Service', 'Status', 'Priority', 'Created At'])
    for t in tickets:
        cw.writerow([t.get('id'), t.get('user_name'), t.get('service'), t.get('status'), t.get('priority'), t.get('created_at')])
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
    tickets_col.update_one({"id": ticket_id}, {"$set": {"status": status, "updated_at": datetime.now().isoformat()}})
    return jsonify({"ok": True})

@app.route('/api/ticket/<ticket_id>/priority', methods=['POST'])
def api_update_priority(ticket_id):
    data = request.json
    priority = data.get('priority')
    tickets_col.update_one({"id": ticket_id}, {"$set": {"priority": priority, "updated_at": datetime.now().isoformat()}})
    return jsonify({"ok": True})

@app.route('/api/ticket/<ticket_id>/note', methods=['POST'])
def api_add_note(ticket_id):
    data = request.json
    note = data.get('text')
    tickets_col.update_one({"id": ticket_id}, {
        "$push": {"admin_notes": {"note": note, "by": "admin", "time": datetime.now().isoformat()}},
        "$set": {"updated_at": datetime.now().isoformat()}
    })
    return jsonify({"ok": True})

@app.route('/api/ticket/<ticket_id>/reply', methods=['POST'])
def api_add_reply(ticket_id):
    data = request.json
    text = data.get('text')
    reply = {"text": text, "by": "admin", "time": datetime.now().isoformat()}
    tickets_col.update_one({"id": ticket_id}, {
        "$push": {"manual_replies": reply},
        "$set": {"updated_at": datetime.now().isoformat()}
    })
    return jsonify({"ok": True, "reply": reply})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
