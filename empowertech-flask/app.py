import os
import csv
import io
import json
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, Response
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from collections import Counter

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev_secret")

# MongoDB Setup
try:
    client = MongoClient(os.getenv("MONGODB_URI"), serverSelectionTimeoutMS=5000)
    db = client.get_default_database(default="empowertech")
    print(f"✅ Connected to MongoDB: {db.name}")
except Exception as e:
    print(f"⚠️ MongoDB Warning: {e}")
    client = MongoClient(os.getenv("MONGODB_URI"))
    db = client["empowertech"]

tickets_col = db.tickets
handoffs_col = db.handoffs

def get_now_ist_str():
    """Returns current IST time as ISO string."""
    ist_time = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    return ist_time.isoformat()

def safe_serialize(obj):
    if isinstance(obj, datetime):
        ist_time = obj.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30)))
        return ist_time.isoformat()
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, list):
        return [safe_serialize(item) for item in obj]
    if isinstance(obj, dict):
        return {key: safe_serialize(value) for key, value in obj.items()}
    return obj

def format_doc(raw_doc):
    if not raw_doc or not isinstance(raw_doc, dict):
        return {}
    
    t = safe_serialize(raw_doc)
    
    # CRITICAL: Align with Mongoose Schema and existing Indexes
    # We map 'ticketId' or 'handoffId' to 'id' for the HTML templates
    if 'id' not in t:
        t['id'] = t.get('ticketId') or t.get('handoffId') or str(t.get('_id'))
    
    # Fill defaults
    t.setdefault('user_name', t.get('userName', 'Anonymous'))
    t.setdefault('subject', 'New Request')
    t.setdefault('service', 'General')
    t.setdefault('status', 'Open')
    t.setdefault('priority', 'Low')
    
    # Normalize nested lists and their timestamps
    for field in ['messages', 'manual_replies', 'admin_notes']:
        if field in t and isinstance(t[field], list):
            for item in t[field]:
                if isinstance(item, dict):
                    if 'time' not in item:
                        item['time'] = item.get('timestamp') or t.get('created_at', get_now_ist_str())
                    if 'by' not in item:
                        item['by'] = 'User' if item.get('role') == 'user' else 'AI Bot'
    
    return t

@app.context_processor
def inject_globals():
    return dict(admin="Project Admin", now=datetime.now())

@app.route('/')
def dashboard():
    try:
        tickets = [format_doc(t) for t in tickets_col.find().sort("created_at", -1)]
        active_h = list(handoffs_col.find({"status": {"$ne": "Resolved"}}))
        
        stats = {
            "total": len(tickets),
            "open": len([t for t in tickets if t.get('status') == 'Open']),
            "in_progress": len([t for t in tickets if t.get('status') == 'In Progress']),
            "resolved": len([t for t in tickets if t.get('status') == 'Resolved']),
            "closed": len([t for t in tickets if t.get('status') == 'Closed'])
        }
        
        service_counts = dict(Counter([t.get('service', 'General') for t in tickets]))
        for s in ['App Development', 'Website Design', 'Consulting', 'Legal Tech Support']:
            service_counts.setdefault(s, 0)

        top_intents = Counter([t.get('intent') for t in tickets if t.get('intent')]).most_common(6)

        return render_template('dashboard.html', 
                               stats=stats, 
                               service_counts=service_counts,
                               top_intents=top_intents,
                               recent_tickets=tickets[:5],
                               active_handoffs=len(active_h))
    except Exception as e:
        return f"Dashboard Error: {e}", 500

@app.route('/tickets')
def tickets_page():
    try:
        search = request.args.get('search', '')
        status_filter = request.args.get('status', 'all')
        service_filter = request.args.get('service', 'all')
        priority_filter = request.args.get('priority', 'all')

        query = {}
        if status_filter != 'all': query['status'] = status_filter
        if service_filter != 'all': query['service'] = service_filter
        if priority_filter != 'all': query['priority'] = priority_filter
        
        if search:
            query['$or'] = [
                {'ticketId': {'$regex': search, '$options': 'i'}},
                {'user_name': {'$regex': search, '$options': 'i'}},
                {'subject': {'$regex': search, '$options': 'i'}}
            ]

        raw_tickets = list(tickets_col.find(query).sort("created_at", -1))
        tickets = [format_doc(t) for t in raw_tickets]
        
        return render_template('tickets.html', 
                               tickets=tickets,
                               total=len(tickets),
                               search=search,
                               status_filter=status_filter,
                               service_filter=service_filter,
                               priority_filter=priority_filter,
                               all_statuses=['Open', 'In Progress', 'Resolved', 'Closed'],
                               all_services=['App Development', 'Website Design', 'Consulting', 'Legal Tech Support'],
                               all_priorities=['Low', 'Medium', 'High'])
    except Exception as e:
        return f"Error: {e}", 500

@app.route('/ticket/<ticket_id>', methods=['GET', 'POST'])
def ticket_detail(ticket_id):
    query = {"$or": [{"ticketId": ticket_id}, {"id": ticket_id}]}
    if len(ticket_id) == 24:
        try: query["$or"].append({"_id": ObjectId(ticket_id)})
        except: pass
        
    t = tickets_col.find_one(query)
    if not t:
        flash("Ticket not found", "error")
        return redirect(url_for('tickets_page'))
    
    return render_template('ticket_detail.html', 
                           ticket=format_doc(t),
                           all_statuses=['Open', 'In Progress', 'Resolved', 'Closed'],
                           all_priorities=['Low', 'Medium', 'High'])

@app.route('/handoffs')
def handoffs_page():
    status = request.args.get('status', 'All')
    query = {} if status == 'All' else {'status': status}
    handoffs = [format_doc(h) for h in handoffs_col.find(query).sort("created_at", -1)]
    return render_template('handoffs.html', handoffs=handoffs, status_filter=status)

@app.route('/handoff/<handoff_id>')
def handoff_detail(handoff_id):
    query = {"$or": [{"handoffId": handoff_id}, {"id": handoff_id}]}
    if len(handoff_id) == 24:
        try: query["$or"].append({"_id": ObjectId(handoff_id)})
        except: pass
        
    h = handoffs_col.find_one(query)
    if not h: return redirect(url_for('handoffs_page'))
    
    handoff = format_doc(h)
    return render_template('handoff_detail.html', handoff=handoff, all_messages=handoff.get('messages', []))

@app.route('/api/handoff/<handoff_id>/status', methods=['POST'])
def api_handoff_status(handoff_id):
    status = request.json.get('status')
    now = get_now_ist_str()
    query = {"$or": [{"handoffId": handoff_id}, {"id": handoff_id}]}
    if len(handoff_id) == 24:
        try: query["$or"].append({"_id": ObjectId(handoff_id)})
        except: pass
    handoffs_col.update_one(query, {"$set": {"status": status, "updated_at": now}})
    return jsonify({"ok": True})

@app.route('/api/handoff/<handoff_id>/reply', methods=['POST'])
def api_handoff_reply(handoff_id):
    text = request.json.get('text')
    now = get_now_ist_str()
    reply = { "role": "admin", "text": text, "by": "Human Agent", "time": now }
    query = {"$or": [{"handoffId": handoff_id}, {"id": handoff_id}]}
    if len(handoff_id) == 24:
        try: query["$or"].append({"_id": ObjectId(handoff_id)})
        except: pass
    handoffs_col.update_one(query, {
        "$push": {"messages": reply},
        "$set": {"updated_at": now}
    })
    return jsonify({"ok": True})

@app.route('/api/handoff/<handoff_id>/messages')
def api_handoff_messages(handoff_id):
    query = {"$or": [{"handoffId": handoff_id}, {"id": handoff_id}]}
    if len(handoff_id) == 24:
        try: query["$or"].append({"_id": ObjectId(handoff_id)})
        except: pass
    h = handoffs_col.find_one(query)
    if not h: return jsonify({"ok": False, "error": "Not found"})
    handoff = format_doc(h)
    return jsonify({"ok": True, "messages": handoff.get('messages', []), "status": handoff.get('status')})

@app.route('/api/ticket/<ticket_id>/status', methods=['POST'])
def api_update_status(ticket_id):
    query = {"$or": [{"ticketId": ticket_id}, {"id": ticket_id}]}
    if len(ticket_id) == 24:
        try: query["$or"].append({"_id": ObjectId(ticket_id)})
        except: pass
    status = request.json.get('status')
    now = get_now_ist_str()
    tickets_col.update_one(query, {"$set": {"status": status, "updated_at": now}})
    return jsonify({"ok": True})

@app.route('/api/ticket/<ticket_id>/priority', methods=['POST'])
def api_update_priority(ticket_id):
    query = {"$or": [{"ticketId": ticket_id}, {"id": ticket_id}]}
    if len(ticket_id) == 24:
        try: query["$or"].append({"_id": ObjectId(ticket_id)})
        except: pass
    priority = request.json.get('priority')
    now = get_now_ist_str()
    tickets_col.update_one(query, {"$set": {"priority": priority, "updated_at": now}})
    return jsonify({"ok": True})

@app.route('/api/tickets/live')
def live_tickets():
    tickets = [format_doc(t) for t in tickets_col.find().sort("updated_at", -1).limit(20)]
    handoffs_count = handoffs_col.count_documents({"status": {"$ne": "Resolved"}})
    return jsonify({
        "total": tickets_col.count_documents({}),
        "stats": {
            "open": tickets_col.count_documents({"status": "Open"}),
            "in_progress": tickets_col.count_documents({"status": "In Progress"}),
            "resolved": tickets_col.count_documents({"status": "Resolved"})
        },
        "active_handoffs": handoffs_count,
        "handoffs_count": handoffs_col.count_documents({}),
        "tickets": tickets
    })

@app.route('/export')
def export_csv():
    tickets = list(tickets_col.find())
    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['ID', 'User', 'Service', 'Status', 'Priority', 'Date'])
    for t in tickets:
        obj = format_doc(t)
        cw.writerow([obj.get('id'), obj.get('user_name'), obj.get('service'), obj.get('status'), obj.get('priority'), obj.get('created_at')])
    return Response(si.getvalue(), mimetype="text/csv", headers={"Content-disposition": "attachment; filename=tickets.csv"})

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST': return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    return redirect(url_for('login'))

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
