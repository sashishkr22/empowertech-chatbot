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

// ── NEW: DEDICATED TICKET CREATION API ──
app.post('/api/ticket/create', async (req, res) => {
    try {
        const { name, email, phone, issue, sessionId } = req.body;
        const ticket = await ticketManager.createDirectTicket({ name, email, phone, issue, sessionId });
        
        // Save to local history for consistency
        if (!sessionHistory[sessionId]) sessionHistory[sessionId] = [];
        sessionHistory[sessionId].push({ role: 'bot', text: `✅ Ticket ${ticket.ticketId} created!`, time: new Date().toISOString() });
        
        res.json({ success: true, ticketId: ticket.ticketId, message: "Ticket created successfully" });
    } catch (err) {
        console.error('API Error (Create Ticket):', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── NEW: DEDICATED HANDOFF CREATION API ──
app.post('/api/handoff/create', async (req, res) => {
    try {
        const { name, email, phone, issue, sessionId } = req.body;
        const handoff = await ticketManager.createDirectHandoff({ name, email, phone, issue, sessionId });
        
        if (!sessionHistory[sessionId]) sessionHistory[sessionId] = [];
        sessionHistory[sessionId].push({ role: 'bot', text: `Handoff requested. Token: ${handoff.handoffId}`, time: new Date().toISOString() });
        
        res.json({ success: true, handoffId: handoff.handoffId });
    } catch (err) {
        console.error('API Error (Create Handoff):', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── EXISTING: MAIN CHAT API ──
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Empty message' });

    if (!sessionHistory[sessionId]) sessionHistory[sessionId] = [];

    const userMsg = {
      role:  'user',
      text:  message,
      time:  new Date().toISOString(),
      intent: null,
      confidence: 1.0
    };

    // 1. Check for active handoff
    const activeHandoff = await ticketManager.getHandoffStatus(sessionId);
    const msgLower = message.toLowerCase().trim();
    const isExitMsg = ['bye', 'exit', 'stop', 'goodbye', 'end chat'].includes(msgLower);

    if (activeHandoff) {
        if (isExitMsg) {
            // User wants to return to AI - resolve handoff
            await ticketManager.resolveHandoff(sessionId);
            console.log(`👋 [${sessionId}] Handoff ended by user. Returning to AI.`);
        } else {
            // Quietly sync message to handoff and stop bot from replying
            await ticketManager.updateTicketMessages(sessionId, userMsg);
            return res.json({ reply: null, intent: 'HumanHandoff_Active', handoff: activeHandoff });
        }
    }

    // 2. Normal AI Chat
    const dfResponse = await sendMessageToDialogflow(message, sessionId);
    let finalReply = dfResponse?.queryResult?.fulfillmentText || "I'm PlagPro AI, how can I help?";
    let finalIntent = dfResponse?.queryResult?.intent?.displayName || "Default Fallback Intent";
    
    if (finalIntent === 'Default Fallback Intent') {
        finalReply = getFallbackResponse(message);
    }

    // 3. Status Check Logic
    if (finalIntent === 'CheckTicketStatus' || message.toUpperCase().includes('EMP-')) {
        const match = message.match(/EMP-\d{4}/i);
        if (match) {
            const ticket = await ticketManager.getTicketStatus(match[0]);
            finalReply = ticket ? `🔍 **Ticket Found!**\n\n**ID:** ${ticket.ticketId}\n**Status:** ${ticket.status}\n**Priority:** ${ticket.priority}\n**Service:** ${ticket.service}` : `❌ No ticket found with ID **${match[0].toUpperCase()}**.`;
        }
    }

    // 4. Save and Respond
    const botMsg = { role: 'bot', text: finalReply, time: new Date().toISOString() };
    sessionHistory[sessionId].push(userMsg, botMsg);
    await ticketManager.updateTicketMessages(sessionId, userMsg);
    await ticketManager.updateTicketMessages(sessionId, botMsg);

    res.json({
      reply: finalReply,
      intent: finalIntent,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ reply: "I'm sorry, I encountered an error. Please try again." });
  }
});

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

app.get('/api/ticket/:id', async (req, res) => {
    try {
        const ticket = await ticketManager.getTicketStatus(req.params.id);
        res.json({ success: !!ticket, ticket });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🛡️ PlagPro AI Bot running on port ${PORT}`));
