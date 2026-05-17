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
    ticketId: { type: String, unique: true },
    session_id: String,
    user_name: { type: String, default: "Anonymous" },
    user_email: { type: String, default: "" },
    user_phone: { type: String, default: "" },
    subject: String,
    service: { type: String, default: "General" },
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
    handoffId: { type: String, unique: true },
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

    // NEW: Robust Direct Ticket Creation
    createDirectTicket: async (data) => {
        const count = await Ticket.countDocuments();
        const tId = `EMP-${1001 + count}`;
        
        // Auto-detect service from text keywords
        let service = "General Support";
        const issue = (data.issue || "").toLowerCase();
        if (issue.includes("app") || issue.includes("android") || issue.includes("ios")) service = "App Development";
        else if (issue.includes("web") || issue.includes("site") || issue.includes("design")) service = "Website Design";
        else if (issue.includes("consult") || issue.includes("help") || issue.includes("advice")) service = "Consulting";
        else if (issue.includes("legal") || issue.includes("law") || issue.includes("policy")) service = "Legal Tech Support";

        const newTicket = new Ticket({
            ticketId: tId,
            session_id: data.sessionId,
            user_name: data.name || "Anonymous User",
            user_email: data.email || "",
            user_phone: data.phone || "",
            subject: (data.issue || "New Request").substring(0, 50) + "...",
            service: service,
            status: "Open",
            priority: (service === "Legal Tech Support") ? "High" : "Low",
            messages: [{
                role: 'user',
                text: data.issue || "No description provided",
                time: new Date().toISOString(),
                by: data.name || "User"
            }]
        });

        await newTicket.save();
        return newTicket;
    },

    // NEW: Robust Direct Handoff Creation
    createDirectHandoff: async (data) => {
        let existing = await Handoff.findOne({ session_id: data.sessionId, status: { $ne: 'Resolved' } });
        if (existing) return existing;

        const count = await Handoff.countDocuments();
        const hId = `H-${1001 + count}`;

        const newHandoff = new Handoff({
            handoffId: hId,
            session_id: data.sessionId,
            user_name: data.name || "Anonymous User",
            user_email: data.email || "",
            user_phone: data.phone || "",
            status: "Waiting",
            messages: [{
                role: 'user',
                text: data.issue || "Human agent requested",
                time: new Date().toISOString(),
                by: data.name || "User"
            }]
        });

        await newHandoff.save();
        return newHandoff;
    },

    getHandoffStatus: async (sessionId) => {
        return await Handoff.findOne({ session_id: sessionId, status: { $ne: 'Resolved' } });
    },

    getTicketStatus: async (ticketId) => {
        return await Ticket.findOne({ ticketId: ticketId.toUpperCase() });
    },

    getTicketStatusBySession: async (sessionId) => {
        return await Ticket.findOne({ session_id: sessionId }).sort({ created_at: -1 });
    },

    updateTicketMessages: async (sessionId, message) => {
        const timestamp = new Date().toISOString();
        const ticket = await Ticket.findOne({ session_id: sessionId }).sort({ created_at: -1 });
        if (ticket) {
            ticket.messages.push({ ...message, time: timestamp, by: message.role === 'user' ? (ticket.user_name || "User") : "AI Bot" });
            ticket.updated_at = timestamp;
            await ticket.save();
        }
        const handoff = await Handoff.findOne({ session_id: sessionId, status: { $ne: 'Resolved' } });
        if (handoff) {
            handoff.messages.push({ ...message, time: timestamp, by: message.role === 'user' ? (handoff.user_name || "User") : "AI Bot" });
            handoff.updated_at = timestamp;
            await handoff.save();
        }
    }
};

module.exports = ticketManager;
