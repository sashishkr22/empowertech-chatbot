const mongoose = require('mongoose');
require('dotenv').config();

const messageSchema = new mongoose.Schema({
    role: String,
    text: String,
    time: { type: String, default: () => new Date().toISOString() },
    intent: String,
    confidence: Number,
    by: { type: String, default: "System" }
});

const adminNoteSchema = new mongoose.Schema({
    note: String,
    by: String,
    time: { type: String, default: () => new Date().toISOString() }
});

const manualReplySchema = new mongoose.Schema({
    text: String,
    by: String,
    time: { type: String, default: () => new Date().toISOString() }
});

const ticketSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    session_id: String,
    user_name: { type: String, default: "Anonymous" },
    user_email: { type: String, default: "" },
    user_phone: { type: String, default: "" },
    subject: String,
    service: String,
    intent: String,
    status: { type: String, default: 'Open' },
    priority: { type: String, default: 'Low' },
    assigned_to: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
    admin_notes: [adminNoteSchema],
    messages: [messageSchema],
    manual_replies: [manualReplySchema]
}, { collection: 'tickets' });

const handoffSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    session_id: String,
    user_name: { type: String, default: "Anonymous" },
    user_email: { type: String, default: "" },
    user_phone: { type: String, default: "" },
    status: { type: String, default: 'Waiting' },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
    messages: [messageSchema]
}, { collection: 'handoffs' });

const Ticket = mongoose.model('Ticket', ticketSchema);
const Handoff = mongoose.model('Handoff', handoffSchema);

const ticketManager = {
    connect: async () => {
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✅ MongoDB Connected (Mongoose)');
        } catch (err) {
            console.error('❌ MongoDB Connection Error:', err.message);
        }
    },

    createTicket: async (sessionData, messages, userData = {}) => {
        const count = await Ticket.countDocuments();
        const ticketId = `EMP-${1001 + count}`;
        const lastMsg = messages[messages.length - 1];
        
        const cleanedMessages = messages.map(m => ({
            ...m,
            by: m.role === 'user' ? (userData.name || "User") : "AI Bot"
        }));

        const newTicket = new Ticket({
            id: ticketId,
            session_id: sessionData.sessionId,
            user_name: userData.name || "Website User",
            user_email: userData.email || "",
            user_phone: userData.phone || "",
            subject: lastMsg.text.substring(0, 50) + "...",
            status: "Open",
            messages: cleanedMessages
        });
        await newTicket.save();
        return ticketId;
    },

    createHandoffRequest: async (data) => {
        // Check if handoff already exists for this session
        let handoff = await Handoff.findOne({ session_id: data.sessionId, status: { $ne: 'Resolved' } });
        
        const cleanedMessages = data.conversationHistory.map(m => ({
            ...m,
            by: m.role === 'user' ? (data.userData?.name || "User") : "AI Bot"
        }));

        if (handoff) {
            // Update existing
            handoff.messages = cleanedMessages;
            if (data.userData?.name) handoff.user_name = data.userData.name;
            if (data.userData?.phone) handoff.user_phone = data.userData.phone;
            handoff.updated_at = new Date().toISOString();
            await handoff.save();
            return handoff;
        }

        const count = await Handoff.countDocuments();
        const handoffId = `H-${1001 + count}`;

        const newHandoff = new Handoff({
            id: handoffId,
            session_id: data.sessionId,
            user_name: data.userData?.name || "Anonymous User",
            user_phone: data.userData?.phone || "",
            status: "Waiting",
            messages: cleanedMessages
        });
        await newHandoff.save();
        return newHandoff;
    },

    getHandoffStatus: async (sessionId) => {
        return await Handoff.findOne({ session_id: sessionId, status: { $ne: 'Resolved' } });
    },

    getTicketStatus: async (ticketId) => {
        return await Ticket.findOne({ id: ticketId });
    },

    getTicketStatusBySession: async (sessionId) => {
        return await Ticket.findOne({ session_id: sessionId }).sort({ created_at: -1 });
    },

    updateTicketMessages: async (sessionId, message) => {
        const timestamp = new Date().toISOString();
        
        // Update Ticket
        const ticket = await Ticket.findOne({ session_id: sessionId }).sort({ created_at: -1 });
        if (ticket) {
            ticket.messages.push({ ...message, time: timestamp, by: message.role === 'user' ? (ticket.user_name || "User") : "AI Bot" });
            ticket.updated_at = timestamp;
            await ticket.save();
        }
        
        // Update Handoff
        const handoff = await Handoff.findOne({ session_id: sessionId, status: { $ne: 'Resolved' } });
        if (handoff) {
            handoff.messages.push({ ...message, time: timestamp, by: message.role === 'user' ? (handoff.user_name || "User") : "AI Bot" });
            handoff.updated_at = timestamp;
            await handoff.save();
        }
    }
};

module.exports = ticketManager;
