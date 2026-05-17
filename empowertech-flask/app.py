import os
import csv
import io
import json
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
    # Use a long timeout to avoid silent hangs
    client = MongoClient(os.getenv("MONGODB_URI"), serverSelectionTimeoutMS=5000)
    # Check if a database name is in the URI, else default to 'empowertech'
    db = client.get_default_database(default="empowertech")
    print(f"✅ Connected to MongoDB Database: {db.name}")
except Exception as e:
    print(f"⚠️ MongoDB Connection Warning: {e}")
    client = MongoClient(os.getenv("MONGODB_URI"))
    db = client["empowertech"]

tickets_col = db.tickets

def safe_serialize(obj):
    """Recursively converts all non-JSON serializable objects to strings."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, list):
        return [safe_serialize(item) for item in obj]
    if isinstance(obj, dict):
        return {key: safe_serialize(value) for key, value in obj.items()}
    return obj

def format_ticket_for_template(raw_doc):
    """
    Ensures a ticket document is 100% safe for Jinja2 templates.
    Prevents 'subscriptable' and 'no attribute' errors.
    """
    if not raw_doc or not isinstance(raw_doc, dict):
        return {}

    # Deep copy and serialize (converts Datetimes to Strings)
    t = safe_serialize(raw_doc)
    
    # Ensure ID is present for url_for
    if 'id' not in t:
        t['id'] = t.get('ticketId') or t.get('_id')
    
    # Fill standard defaults
    t.setdefault('user_name', t.get('userName', 'Anonymous'))
    t.setdefault('subject', 'New Support Request')
    t.setdefault('service', 'General')
    t.setdefault('status', 'Open')
    t.setdefault('priority', 'Low')
    t.setdefault('created_at', datetime.now().isoformat())
    
    # Normalize and ensure 'time' exists in nested objects
    # This prevents the "'dict object' has no attribute 'time'" error
    for field in ['messages', 'manual_replies', 'admin_notes']:
        if field not in t or not isinstance(t[field], list):
            t[field] = []
        
        for item in t[field]:
            if isinstance(item, dict):
                # If 'time' is missing but 'timestamp' exists, use it
                if 'time' not in item and 'timestamp' in item:
                    item['time'] = item['timestamp']
                # If still missing, use a placeholder or current time
                if 'time' not in item:
                    item['time'] = t['created_at']
                
                # Special case for messages: ensure role exists
                if field == 'messages':
                    item.setdefault('role', 'bot')
                    item.setdefault('text', '')

    # Generate a subject from the first message if missing
    if t['subject'] == "New Support Request" and t['messages']:
        first_msg = t['messages'][0]
        if isinstance(first_msg, dict):
            t['subject'] = first_msg.get('text', 'New Request')[:40] + "..."

    return t

@app.context_processor
def inject_globals():
    return dict(admin="Project Admin", now=datetime.now())

@app.route('/')
def dashboard():
    try:
        # Sort by creation time, handle missing field gracefully
        raw_tickets = list(tickets_col.find().sort("created_at", -1))
        tickets = [format_ticket_for_template(t) for t in raw_tickets]
        
        stats = {
            "total": len(tickets),
            "open": len([t for t in tickets if t.get('status') == 'Open']),
            "in_progress": len([t for t in tickets if t.get('status') == 'In Progress']),
            "resolved": len([t for t in tickets if t.get('status') == 'Resolved']),
            "closed": len([t for t in tickets if t.get('status') == 'Closed'])
        }
        
        # Calculate service distribution
        services = [t.get('service', 'General') for t in tickets]
        service_counts = dict(Counter(services))
        for s in ['App Development', 'Website Design', 'Consulting', 'Legal Tech Support']:
            service_counts.setdefault(s, 0)

        # Calculate top intents
        intents = [t.get('intent') for t in tickets if t.get('intent')]
        top_intents = Counter(intents).most_common(6)

        return render_template('dashboard.html', 
                               stats=stats, 
                               service_counts=service_counts,
                               top_intents=top_intents,
                               recent_tickets=tickets[:5])
    except Exception as e:
        print(f"❌ Dashboard Crash: {e}")
        return f"Dashboard Error: {e}", 500

@app.route('/tickets')
def tickets_page():
    try:
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
                {'userName': {'$regex': search, '$options': 'i'}}
            ]

        raw_tickets = list(tickets_col.find(query).sort("created_at", -1))
        tickets = [format_ticket_for_template(t) for t in raw_tickets]
        return render_template('tickets.html', tickets=tickets)
    except Exception as e:
        print(f"❌ Tickets Page Crash: {e}")
        return f"Error: {e}", 500

@app.route('/ticket/<ticket_id>', methods=['GET', 'POST'])
def ticket_detail(ticket_id):
    try:
        if request.method == 'POST':
            action = request.form.get('action')
            if action == 'add_reply':
                reply_text = request.form.get('reply')
                tickets_col.update_one({"$or": [{"id": ticket_id}, {"ticketId": ticket_id}]}, {
                    "$push": {"manual_replies": {"text": reply_text, "by": "admin", "time": datetime.now()}},
                    "$set": {"updated_at": datetime.now()}
                })
                flash("Reply sent successfully", "success")
            return redirect(url_for('ticket_detail', ticket_id=ticket_id))

        t = tickets_col.find_one({"$or": [{"id": ticket_id}, {"ticketId": ticket_id}]})
        if not t:
            flash("Ticket not found", "error")
            return redirect(url_for('tickets_page'))
        
        return render_template('ticket_detail.html', 
                               ticket=format_ticket_for_template(t),
                               all_statuses=['Open', 'In Progress', 'Resolved', 'Closed'],
                               all_priorities=['Low', 'Medium', 'High'])
    except Exception as e:
        print(f"❌ Ticket Detail Crash: {e}")
        return f"Error: {e}", 500

@app.route('/handoffs')
def handoffs_page():
    return render_template('handoffs.html', handoffs=[])

@app.route('/export')
def export_csv():
    try:
        tickets = list(tickets_col.find())
        si = io.StringIO()
        cw = csv.writer(si)
        cw.writerow(['ID', 'User', 'Service', 'Status', 'Priority', 'Date'])
        for t in tickets:
            obj = format_ticket_for_template(t)
            cw.writerow([obj['id'], obj['user_name'], obj['service'], obj['status'], obj['priority'], obj['created_at']])
        return Response(si.getvalue(), mimetype="text/csv", headers={"Content-disposition": "attachment; filename=tickets.csv"})
    except Exception as e:
        return str(e), 500

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST': return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    return redirect(url_for('login'))

# ── API ENDPOINTS (Live Sync) ──

@app.route('/api/tickets/live')
def live_tickets():
    try:
        raw_tickets = list(tickets_col.find().sort("updated_at", -1))
        tickets = [format_ticket_for_template(t) for t in raw_tickets]
        
        stats = {
            "total": len(tickets),
            "open": len([t for t in tickets if t.get('status') == 'Open']),
            "in_progress": len([t for t in tickets if t.get('status') == 'In Progress']),
            "resolved": len([t for t in tickets if t.get('status') == 'Resolved']),
            "closed": len([t for t in tickets if t.get('status') == 'Closed'])
        }

        return jsonify({
            "total": stats["total"],
            "stats": stats,
            "active_handoffs": 0,
            "handoffs_count": 0,
            "tickets": tickets[:20]
        })
    except Exception as e:
        print(f"❌ Sync API Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/ticket/<ticket_id>/status', methods=['POST'])
def api_update_status(ticket_id):
    tickets_col.update_one({"$or": [{"id": ticket_id}, {"ticketId": ticket_id}]}, {"$set": {"status": request.json.get('status'), "updated_at": datetime.now()}})
    return jsonify({"ok": True})

@app.route('/api/ticket/<ticket_id>/priority', methods=['POST'])
def api_update_priority(ticket_id):
    tickets_col.update_one({"$or": [{"id": ticket_id}, {"ticketId": ticket_id}]}, {"$set": {"priority": request.json.get('priority'), "updated_at": datetime.now()}})
    return jsonify({"ok": True})

@app.route('/api/ticket/<ticket_id>/reply', methods=['POST'])
def api_add_reply(ticket_id):
    reply = {"text": request.json.get('text'), "by": "admin", "time": datetime.now()}
    tickets_col.update_one({"$or": [{"id": ticket_id}, {"ticketId": ticket_id}]}, {"$push": {"manual_replies": reply}, "$set": {"updated_at": datetime.now()}})
    return jsonify({"ok": True, "reply": safe_serialize(reply)})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
