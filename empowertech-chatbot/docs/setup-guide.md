# 📘 PlagPro Chatbot – Detailed Setup Guide for Beginners
## Noida Academic Integrity AI Chatbot

---

## 🧠 Understanding the Architecture (Simple Explanation)

```
USER types message in browser
        ↓
FRONTEND (index.html + chat.js)
  → Sends message to backend
        ↓
BACKEND (server.js)
  → Receives message
  → Sends to Dialogflow API
        ↓
DIALOGFLOW (Google AI)
  → Understands the user's INTENT (what they want)
  → Returns a reply
        ↓
BACKEND
  → If support request needed, creates one in MongoDB
  → Sends reply back to frontend
        ↓
FRONTEND
  → Shows reply in chat bubble
```

---

## 🗂️ What Each File Does (Explained Simply)

| File | What it does | You need to edit? |
|------|-------------|-------------------|
| `backend/server.js` | The main server that runs everything | No (unless customizing) |
| `backend/dialogflow.js` | Connects to Google Dialogflow AI | Add your service account |
| `backend/ticketManager.js` | Creates and stores support requests | No |
| `frontend/index.html` | The chat webpage users see | Yes (customize text) |
| `frontend/css/style.css` | How the page looks (colors, layout) | Yes (customize colors) |
| `frontend/js/chat.js` | Makes the chat work (send/receive) | No (unless adding features) |
| `.env` | Your secret configuration | YES - must fill in |
| `dialogflow/intents/*.json` | Teaching the AI what phrases mean | Import to Dialogflow |

---

## 🔑 Getting Your Dialogflow Credentials (Detailed)

### Step 1: Create Google Cloud Project
1. Go to: https://console.cloud.google.com
2. Click "Select a Project" at the top
3. Click "NEW PROJECT"
4. Name: `plagpro-chatbot`
5. Click "Create"
6. **Copy the Project ID** (looks like: `plagpro-chatbot-123456`)

### Step 2: Enable Dialogflow API
1. In Google Cloud Console, go to "APIs & Services"
2. Click "Enable APIs and Services"
3. Search for "Dialogflow API"
4. Click "Enable"

### Step 3: Create Service Account
1. Go to "IAM & Admin" → "Service Accounts"
2. Click "+ CREATE SERVICE ACCOUNT"
3. Service account name: `dialogflow-bot`
4. Click "CREATE AND CONTINUE"
5. Role: Select "Dialogflow API Client"
6. Click "DONE"

### Step 4: Download the Key File
1. Click on the service account you just created
2. Go to "KEYS" tab
3. Click "ADD KEY" → "Create new key"
4. Choose "JSON" format
5. Click "CREATE"
6. A JSON file downloads to your computer
7. **Rename it to `serviceAccount.json`**
8. **Copy it to the `backend/` folder of your project**

---

## 📥 Importing Intents to Dialogflow

### Option A: Import via Console (Recommended for beginners)
1. Go to: https://dialogflow.cloud.google.com
2. Select your agent
3. Click "Intents" in the left menu
4. Click "+ CREATE INTENT"
5. For each intent, manually add:
   - **Intent name**
   - **Training phrases** (what users say)
   - **Responses** (what bot replies)

### Option B: Use the JSON files
Each file in `dialogflow/intents/` folder is one intent.
Look at the files to understand the structure, then recreate in the UI.

---

## 🧪 Testing the Chatbot

### Test in Dialogflow Console First
Before running your code, test in Dialogflow:
1. Go to Dialogflow Console
2. On the right side, there's a "Try it now" box
3. Type: "hello" → should get welcome message
4. Type: "my internet is not working" → should get support response
5. Type: "create a ticket" → should get ticket creation response

### Test the Full Application
```bash
npm start
# Open http://localhost:3000
# Try these messages:
# 1. "Hello"
# 2. "How can I check for plagiarism?"
# 3. "Can you detect AI content?"
# 4. "I need an institutional account"
# 5. "I want to talk to an integrity expert"
```

---

## 🐛 Common Errors and Solutions

### Error: "Cannot find module '@google-cloud/dialogflow'"
**Solution:** Run `npm install` in the project folder

### Error: "serviceAccount.json not found"
**Solution:** Make sure you placed the JSON key file in the `backend/` folder

### Error: "DIALOGFLOW_PROJECT_ID not set"
**Solution:** Check your `.env` file has `DIALOGFLOW_PROJECT_ID=your-project-id`

### Error: "Connection refused" or "ECONNREFUSED"
**Solution:** Make sure the server is running with `npm start`

### Chat shows "Error connecting to server"
**Solution:** 
1. Check the server is running
2. Check the browser console (F12) for error details
3. Make sure port 3000 is not blocked by firewall

---

## 📤 Pushing to GitHub (Step by Step)

```bash
# 1. Create an account at github.com (if you don't have one)

# 2. Create a new repository:
#    - Go to github.com
#    - Click "+" → "New repository"
#    - Name: plagpro-chatbot
#    - Set to Public
#    - DON'T check "Initialize with README" (we already have one)
#    - Click "Create repository"

# 3. Open terminal/command prompt in your project folder

# 4. Initialize git
git init

# 5. Add all files
git add .

# 6. Make first commit
git commit -m "🚀 Initial commit: PlagPro AI Chatbot"

# 7. Connect to GitHub (replace YOUR-USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR-USERNAME/plagpro-chatbot.git

# 8. Set main branch
git branch -M main

# 9. Push to GitHub
git push -u origin main

# Done! Visit https://github.com/YOUR-USERNAME/plagpro-chatbot to see your code
```

---

## 🎯 Dialogflow Intent Training Tips

The more examples you add, the smarter the bot becomes!

**For PlagiarismCheck intent, add phrases like:**
- "How to scan my thesis?"
- "I need a similarity report"
- "Is my paper original?"
- "Check for plagiarism"
- "How do I upload a document?"
- "What is the similarity limit?"

**For HumanHandoff, add phrases like:**
- "I need to talk to a person"
- "Talk to an integrity expert"
- "Can I speak with support?"
- "I have a complex query"

---

## 🔮 Future Improvements (When You're Ready)

1. **Add a real database** (MongoDB or PostgreSQL instead of tickets.json)
2. **Email notifications** when tickets are created
3. **User authentication** (login system)
4. **Ticket assignment** to specific agents
5. **Dashboard** for IT managers to view all tickets
6. **WhatsApp integration** using Twilio
7. **Mobile app** version

---

## 📞 Getting Help
- Dialogflow Docs: https://cloud.google.com/dialogflow/docs
- Node.js Docs: https://nodejs.org/docs
- Express.js Docs: https://expressjs.com

---
*PlagPro, Noida – Advanced Academic Integrity AI*
