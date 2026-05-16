import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
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

@app.route('/')
def dashboard():
    tickets = list(tickets_col.find().sort("created_at", -1))
    
    # Calculate stats
    stats = {
        "total": len(tickets),
        "open": len([t for t in tickets if t['status'] == 'Open']),
        "in_progress": len([t for t in tickets if t['status'] == 'In Progress']),
        "resolved": len([t for t in tickets if t['status'] == 'Resolved']),
        "closed": len([t for t in tickets if t['status'] == 'Closed'])
    }
    
    return render_template('dashboard.html', stats=stats)

@app.route('/tickets')
def ticket_list():
    tickets = list(tickets_col.find().sort("created_at", -1))
    return render_template('tickets.html', tickets=tickets)

@app.route('/ticket/<ticket_id>', methods=['GET', 'POST'])
def ticket_detail(ticket_id):
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'update_status':
            new_status = request.form.get('status')
            tickets_col.update_one({"ticketId": ticket_id}, {"$set": {"status": new_status, "updated_at": datetime.now()}})
            flash(f"Ticket {ticket_id} status updated to {new_status}")
        elif action == 'add_reply':
            reply_text = request.form.get('reply')
            tickets_col.update_one({"ticketId": ticket_id}, {
                "$push": {"messages": {
                    "role": "admin",
                    "text": reply_text,
                    "timestamp": datetime.now()
                }},
                "$set": {"updated_at": datetime.now()}
            })
            flash("Reply sent to user")
        return redirect(url_for('ticket_detail', ticket_id=ticket_id))

    ticket = tickets_col.find_one({"ticketId": ticket_id})
    if not ticket:
        flash("Ticket not found")
        return redirect(url_for('ticket_list'))
    return render_template('ticket_detail.html', ticket=ticket)

@app.route('/api/tickets/live')
def live_tickets():
    # Return recent tickets for polling
    tickets = list(tickets_col.find().sort("updated_at", -1).limit(10))
    for t in tickets: t['_id'] = str(t['_id']) # JSON serializable
    return jsonify(tickets)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
