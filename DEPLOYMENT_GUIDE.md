# Beginner's Guide: Deploying PlagPro Chatbot to Render & MongoDB

This guide explains how to host your Academic Integrity AI Chatbot project live using free cloud services.

## Prerequisites
1.  A **GitHub** account.
2.  A **MongoDB Atlas** account (Free tier).
3.  A **Render.com** account.
4.  Your **Dialogflow Service Account JSON** key.

---

## Step 1: Set up MongoDB Atlas (The Database)
1.  Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a free account.
2.  Create a new **Cluster** (choose the free shared tier).
3.  In **Network Access**, click "Add IP Address" and select **"Allow Access from Anywhere"** (needed for Render).
4.  In **Database Access**, create a user (e.g., `admin`) and save the password.
5.  Click **"Connect"** -> **"Drivers"** and copy the connection string. It looks like:
    `mongodb+srv://admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
    *Replace `<password>` with your actual password.*

---

## Step 2: Prepare your GitHub Repository
1.  Create a **`.gitignore`** file in your project root:
    ```
    node_modules/
    venv/
    .env
    serviceAccount.json
    __pycache__/
    ```
2.  Push your code to a new GitHub repository:
    ```bash
    git init
    git add .
    git commit -m "Migration to MongoDB for cloud deployment"
    git branch -M main
    git remote add origin YOUR_GITHUB_REPO_URL
    git push -u origin main
    ```

---

## Step 3: Deploy Backend (Node.js Chatbot) to Render
1.  Log in to [Render.com](https://render.com).
2.  Click **"New"** -> **"Web Service"**.
3.  Connect your GitHub repository.
4.  **Configuration:**
    *   **Name:** `plagpro-chatbot`
    *   **Root Directory:** `plagpro-chatbot`
    *   **Runtime:** `Node`
    *   **Build Command:** `npm install`
    *   **Start Command:** `node backend/server.js`
5.  **Environment Variables** (Click "Advanced"):
    *   `MONGODB_URI`: *Paste your MongoDB string from Step 1.*
    *   `DIALOGFLOW_PROJECT_ID`: *Your Google Project ID.*
    *   `GOOGLE_APPLICATION_CREDENTIALS_JSON`: *Open your serviceAccount.json, copy ALL text, and paste it here.*

---

## Step 4: Deploy Dashboard (Python Flask) to Render
1.  Click **"New"** -> **"Web Service"** again.
2.  Connect the same GitHub repository.
3.  **Configuration:**
    *   **Name:** `plagpro-flask`
    *   **Root Directory:** `plagpro-flask`
    *   **Runtime:** `Python`
    *   **Build Command:** `pip install -r requirements.txt` (Make sure you have a requirements.txt file)
    *   **Start Command:** `python app.py`
4.  **Environment Variables**:
    *   `MONGODB_URI`: *Paste the same MongoDB string.*
    *   `SECRET_KEY`: *Any random string.*

---

## Step 5: Final Check
*   Open your Chatbot URL (e.g., `https://plagpro-chatbot.onrender.com`).
*   Chat with the bot.
*   Check your MongoDB Atlas dashboard—you should see a `tickets` collection appearing!
*   Open your Dashboard URL (e.g., `https://plagpro-flask.onrender.com`).
*   You should see your chats live in the dashboard.

**Success!** Your Academic Integrity project is now professional, secure, and hosted on the cloud.
