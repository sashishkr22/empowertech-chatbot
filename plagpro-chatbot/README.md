# 🛡️ PlagPro – AI-Powered Plagiarism & AI Content Detection
### Noida, Uttar Pradesh | Academic Integrity & EdTech Sector

> An advanced AI-powered chatbot for **PlagPro**, an industry leader in plagiarism detection and AI content verification. Built with **Google Dialogflow** + **Node.js** backend + **HTML/CSS/JS** frontend.

---

## 📌 Table of Contents
1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Step-by-Step Setup (Beginner Friendly)](#step-by-step-setup)
6. [Dialogflow Configuration](#dialogflow-configuration)
7. [Running the Project](#running-the-project)
8. [Deploying to GitHub](#deploying-to-github)
9. [Screenshots](#screenshots)

---

## 📖 Project Overview

**PlagPro** is a Noida-based EdTech company specializing in academic integrity. This chatbot:
- Handles **plagiarism check queries** (similarity reports, source identification)
- Detects **AI-generated content** (ChatGPT, Gemini, etc.)
- Manages **Institutional & University accounts**
- Creates and tracks **support tickets** for similarity report issues
- Escalates complex academic queries to **human integrity experts**

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 Plagiarism Check | Guidance on scanning documents against billions of sources |
| 🤖 AI Detection | Verifying if content is human or AI-generated |
| 🎫 Report Support | Help with understanding similarity percentages |
| 🏛️ Institutional Sales | Onboarding for universities and colleges |
| 👤 Expert Handoff | Escalates to human support for complex cases |
| 📱 Modern UI | Responsive, theme-aware dashboard for users |

---

## 🛠 Tech Stack

```
Frontend  → HTML5, CSS3, JavaScript (Vanilla) + Modern Glassmorphism UI
Backend   → Node.js + Express.js
Admin     → Python Flask (Support Dashboard)
AI/NLP    → Google Dialogflow ES
Database  → MongoDB (Atlas)
Hosting   → Render.com
```

---

## 📁 Project Structure

```
empowertech-chatbot/           # Main Chatbot Application
│
├── frontend/                    # User interface files
│   ├── index.html               # Main chat page
│   ├── css/style.css            # Modern styling
│   └── js/chat.js               # Chat logic
│
├── backend/                     # Server files
│   ├── server.js                # Main Express server
│   ├── dialogflow.js            # Dialogflow API connection
│   ├── ticketManager.js         # Mongoose-based ticket logic
│
├── dialogflow/                  # Dialogflow export files
│   ├── intents/                 # AI training data
│
├── empowertech-flask/           # Admin Support Dashboard
│   ├── app.py                   # Flask server
│   └── templates/               # HTML for support team
```

---

## 🚀 Step-by-Step Setup

### STEP 1: Install Required Software

**A) Install Node.js & Python**
1. Install Node.js (LTS) from https://nodejs.org
2. Install Python 3.10+ from https://python.org

---

### STEP 2: Set Up Google Dialogflow

1. **Go to:** https://dialogflow.cloud.google.com
2. Create Agent: `PlagPro-AI-Bot`
3. Download Service Account JSON and rename to `serviceAccount.json`
4. Place it in `empowertech-chatbot/backend/`

---

### STEP 3: Database Setup (MongoDB)

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Get your connection string.
3. Add it to your `.env` file.

---

### STEP 4: Configuration

1. **Chatbot (.env):**
   ```
   DIALOGFLOW_PROJECT_ID=plagpro-project-id
   MONGODB_URI=your-mongodb-string
   PORT=3000
   ```
2. **Dashboard (.env in flask folder):**
   ```
   MONGODB_URI=your-mongodb-string
   SECRET_KEY=your-secret
   ```

---

## 🧠 Dialogflow Configuration

### Intents for PlagPro:

| Intent Name | User Says | Bot Response |
|---|---|---|
| `PlagiarismCheck` | "How to check my paper?" | Instructions for scanning |
| `AIDetection` | "Can you detect ChatGPT?" | Explains AI detection tools |
| `Institutional` | "Pricing for my college" | Institutional account info |
| `HumanHandoff` | "I need to talk to a person" | Escalation form |

---

## ▶️ Running the Project

```bash
# 1. Start the Chatbot (Node.js)
cd empowertech-chatbot
npm install
npm start

# 2. Start the Dashboard (Python)
cd empowertech-flask
pip install -r requirements.txt
python app.py
```

---

## 👥 Team
**PlagPro** – Bhutani Cyberpark, Sector-62, Noida, India
Built with ❤️ for Academic Integrity
