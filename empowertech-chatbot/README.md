# 🤖 EmpowerTech Solutions – AI Chatbot for Customer Service
### Chennai, Tamil Nadu | Information Technology Sector

> An AI-powered customer service chatbot built with **Google Dialogflow** + **Node.js** backend + **HTML/CSS/JS** frontend. Handles IT support tickets, technical queries, and user interactions 24/7.

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

**EmpowerTech Solutions** is a Chennai-based IT company. This chatbot:
- Handles **technical support queries** (Wi-Fi issues, software errors, hardware problems)
- Creates and tracks **support tickets** automatically
- Provides **24/7 customer service** without human agents
- Escalates complex issues to **human agents** when needed

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎯 Intent Detection | Understands what the user wants using Dialogflow NLP |
| 🎫 Ticket Creation | Automatically creates support tickets |
| 📋 Ticket Status | Users can check their ticket status by ID |
| 🔧 Technical FAQs | Answers common IT questions instantly |
| 👤 Human Handoff | Escalates to human agent when bot can't help |
| 📱 Responsive UI | Works on mobile and desktop |
| 💬 Chat History | Stores conversation in session |

---

## 🛠 Tech Stack

```
Frontend  → HTML5, CSS3, JavaScript (Vanilla)
Backend   → Node.js + Express.js
AI/NLP    → Google Dialogflow ES (Essentials)
Database  → JSON file (beginner-friendly, no SQL needed)
Hosting   → GitHub + Render.com (free)
```

---

## 📁 Project Structure

```
empowertech-chatbot/
│
├── frontend/                    # User interface files
│   ├── index.html               # Main chat page
│   ├── css/
│   │   └── style.css            # All styling
│   └── js/
│       └── chat.js              # Chat logic (send/receive messages)
│
├── backend/                     # Server files
│   ├── server.js                # Main Express server
│   ├── dialogflow.js            # Dialogflow API connection
│   ├── ticketManager.js         # Create/read support tickets
│   └── tickets.json             # Ticket database (JSON file)
│
├── dialogflow/                  # Dialogflow export files
│   ├── intents/                 # What users say → what bot replies
│   │   ├── Default Welcome Intent.json
│   │   ├── TechnicalSupport.json
│   │   ├── CreateTicket.json
│   │   ├── CheckTicketStatus.json
│   │   └── HumanHandoff.json
│   └── entities/                # Custom word lists
│       └── issue-type.json
│
├── docs/
│   └── setup-guide.md           # Extra help for beginners
│
├── .env.example                 # Environment variable template
├── .gitignore                   # Files NOT to upload to GitHub
├── package.json                 # Node.js project config
└── README.md                    # This file!
```

---

## 🚀 Step-by-Step Setup

### STEP 1: Install Required Software

**A) Install Node.js**
1. Go to: https://nodejs.org
2. Download the **LTS version** (recommended for beginners)
3. Install it (just click Next → Next → Finish)
4. Verify: Open Command Prompt/Terminal and type:
   ```bash
   node --version
   # Should show: v18.x.x or higher
   ```

**B) Install Git**
1. Go to: https://git-scm.com/downloads
2. Download and install Git
3. Verify:
   ```bash
   git --version
   # Should show: git version 2.x.x
   ```

**C) Install VS Code (Code Editor)**
1. Go to: https://code.visualstudio.com
2. Download and install it (free)

---

### STEP 2: Set Up Google Dialogflow

1. **Go to:** https://dialogflow.cloud.google.com
2. **Sign in** with your Google account
3. Click **"Create Agent"**
4. Fill in:
   - Agent Name: `EmpowerTech-Support-Bot`
   - Default Language: `English`
   - Default Time Zone: `Asia/Kolkata`
5. Click **"Create"**

**Create a Service Account (to connect your code to Dialogflow):**
1. Go to: https://console.cloud.google.com
2. Select your project (same as Dialogflow)
3. Go to: **IAM & Admin → Service Accounts**
4. Click **"Create Service Account"**
5. Name it: `dialogflow-bot`
6. Role: Select **"Dialogflow API Client"**
7. Click **"Done"**
8. Click on the service account → **Keys → Add Key → JSON**
9. A file will download — rename it to `serviceAccount.json`
10. Put this file inside the `backend/` folder

---

### STEP 3: Download This Project

```bash
# Open Terminal/Command Prompt and run:
git clone https://github.com/YOUR-USERNAME/empowertech-chatbot.git
cd empowertech-chatbot
```

Or download the ZIP from GitHub and extract it.

---

### STEP 4: Install Dependencies

```bash
# Inside the project folder, run:
npm install
```

This installs all required packages automatically.

---

### STEP 5: Configure Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` in VS Code and fill in:
   ```
   DIALOGFLOW_PROJECT_ID=your-google-project-id
   PORT=3000
   ```

> ⚠️ Never upload `.env` or `serviceAccount.json` to GitHub! They are already in `.gitignore`.

---

### STEP 6: Set Up Intents in Dialogflow

Inside the `dialogflow/intents/` folder, you'll find JSON files.
Import them into Dialogflow:
1. In Dialogflow Console → Click the ⚙️ gear icon (Settings)
2. Click **"Export and Import"**
3. Click **"Import from ZIP"** → upload the `dialogflow-export.zip`

OR create manually (see [Dialogflow Configuration](#dialogflow-configuration) below).

---

## 🧠 Dialogflow Configuration

### What is an "Intent"?
An intent = what the user MEANS when they type something.
Example: If user types "my laptop won't start" → Intent = `TechnicalSupport`

### Intents We've Created:

| Intent Name | Example User Says | Bot Replies |
|---|---|---|
| `Default Welcome Intent` | "Hi", "Hello", "Hey" | Welcome message |
| `TechnicalSupport` | "My internet is down", "Software crash" | Asks for details |
| `CreateTicket` | "Create a ticket", "Log my issue" | Creates ticket, gives ID |
| `CheckTicketStatus` | "Check ticket #1234" | Shows ticket status |
| `HumanHandoff` | "Talk to agent", "I need human help" | Connects to agent |

---

## ▶️ Running the Project

```bash
# Start the server
npm start

# You should see:
# ✅ EmpowerTech Chatbot Server running on http://localhost:3000
```

Open your browser and go to: **http://localhost:3000**

---

## 📤 Deploying to GitHub

```bash
# Step 1: Initialize git (if not already done)
git init

# Step 2: Add all files
git add .

# Step 3: Save your changes
git commit -m "Initial commit - EmpowerTech AI Chatbot"

# Step 4: Connect to GitHub (create repo on github.com first)
git remote add origin https://github.com/YOUR-USERNAME/empowertech-chatbot.git

# Step 5: Upload to GitHub
git push -u origin main
```

---

## 👥 Team
**EmpowerTech Solutions** – Chennai, Tamil Nadu, India
Built with ❤️ using Google Dialogflow + Node.js

---

## 📄 License
MIT License – Free to use and modify
