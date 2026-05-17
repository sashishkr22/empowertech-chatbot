require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const ticketManager = require('./ticketManager');
const { sendMessageToDialogflow, getFallbackResponse } = require('./dialogflow');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Connect to MongoDB
ticketManager.connect();

const sessionHistory = {};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, ticketData, isPartialSync, intent: incomingIntent } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Empty message' });

    if (!sessionHistory[sessionId]) sessionHistory[sessionId] = [];

    const userMsg = {
      role:  'user',
      text:  message,
      time:  new Date().toISOString(),
      intent: incomingIntent || null,
      confidence: 1.0
    };

    // 0. Push user message to history immediately
    sessionHistory[sessionId].push(userMsg);

    // 1. Check for active handoff
    const activeHandoff = await ticketManager.getHandoffStatus(sessionId);
    if (activeHandoff && !['bye', 'exit'].includes(message.toLowerCase().trim())) {
        await ticketManager.updateTicketMessages(sessionId, userMsg);
        return res.json({ reply: null, intent: 'HumanHandoff_Active', handoff: activeHandoff });
    }

    // 2. Determine Final Reply and Intent
    let finalReply = "";
    let finalIntent = incomingIntent || "Default Fallback Intent";
    let ticketId = null;

    const isFinalSubmission = ticketData && !isPartialSync;

    if (isFinalSubmission) {
        // --- BYPASS AI: DIRECT TICKET/HANDOFF CREATION ---
        if (incomingIntent === 'HumanHandoff') {
            const h = await ticketManager.createHandoffRequest({ sessionId, conversationHistory: sessionHistory[sessionId], userData: ticketData });
            finalReply = `I have notified our support team. Your token number is **${h.id}**. Please wait for an agent to respond.`;
        } else {
            ticketId = await ticketManager.createTicket({ sessionId }, sessionHistory[sessionId], ticketData);
            finalReply = `✅ Ticket **${ticketId}** created successfully! Our team will contact you at ${ticketData.email || ticketData.phone || 'your provided contact'}.`;
        }
    } else if (isPartialSync && ticketData) {
        // --- REAL-TIME DATA SYNC (No reply needed) ---
        await ticketManager.createHandoffRequest({ sessionId, conversationHistory: sessionHistory[sessionId], userData: ticketData });
        finalReply = ""; // Quiet sync
    } else {
        // --- NORMAL AI CHAT ---
        const dfResponse = await sendMessageToDialogflow(message, sessionId);
        finalReply = dfResponse?.queryResult?.fulfillmentText || "I'm here to help!";
        finalIntent = dfResponse?.queryResult?.intent?.displayName || finalIntent;
        
        if (finalIntent === 'Default Fallback Intent') {
            finalReply = getFallbackResponse(message);
        }
    }

    // 3. Status Check Logic (if not already handled)
    if (!isFinalSubmission && (finalIntent === 'CheckTicketStatus' || message.toUpperCase().includes('EMP-'))) {
        const match = message.match(/EMP-\d{4}/i);
        if (match) {
            const ticket = await ticketManager.getTicketStatus(match[0].toUpperCase());
            finalReply = ticket ? `🔍 **Ticket Found!**\n\n**ID:** ${ticket.id}\n**Status:** ${ticket.status}\n**Priority:** ${ticket.priority}` : `❌ No ticket found with ID **${match[0].toUpperCase()}**.`;
        }
    }

    // 4. Save to History and DB
    const botMsg = { role: 'bot', text: finalReply, time: new Date().toISOString() };
    if (finalReply) {
        sessionHistory[sessionId].push(userMsg, botMsg);
        await ticketManager.updateTicketMessages(sessionId, userMsg);
        await ticketManager.updateTicketMessages(sessionId, botMsg);
    }

    // 5. Final Response
    res.json({
      reply: finalReply,
      intent: finalIntent,
      ticketId: ticketId,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ reply: "I'm sorry, I encountered an error. Please try again.", error: err.message });
  }
});

// Admin updates polling
app.get('/api/chat/updates', async (req, res) => {
    try {
        const { sessionId, lastSeenTime } = req.query;
        let allReplies = [];
        const handoff = await ticketManager.getHandoffStatus(sessionId);
        if (handoff) allReplies = handoff.messages.filter(m => m.role === 'admin');
        else {
            const ticket = await ticketManager.getTicketStatusBySession(sessionId);
            if (ticket) allReplies = ticket.manual_replies || [];
        }
        if (lastSeenTime && lastSeenTime !== 'null') allReplies = allReplies.filter(r => r.time > lastSeenTime);
        res.json({ replies: allReplies });
    } catch (err) { res.json({ replies: [] }); }
});

// Sidebar ticket check
app.get('/api/ticket/:id', async (req, res) => {
    try {
        const ticket = await ticketManager.getTicketStatus(req.params.id.toUpperCase());
        res.json({ success: !!ticket, ticket });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Chatbot running on port ${PORT}`));
