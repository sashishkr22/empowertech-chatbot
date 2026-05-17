// =============================================
// chat.js - Frontend Chat Logic
// =============================================

const SESSION_ID = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
let messageCount = 0;
let ticketCount = 0;
const SERVER_URL = window.location.origin;

let ticketState = {
  active: false,
  type: 'ticket',
  data: { name: '', email: '', phone: '', issue: '' }
};

let adminPollInterval = null;
let lastSeenAdminReplyTime = null;

async function checkAdminReplies() {
  try {
    const url = `${SERVER_URL}/api/chat/updates?sessionId=${SESSION_ID}&lastSeenTime=${lastSeenAdminReplyTime}`;
    const response = await fetch(url);
    if (!response.ok) return;
    const data = await response.json();
    if (data.replies && data.replies.length > 0) {
      data.replies.forEach(reply => {
        if (!lastSeenAdminReplyTime || reply.time > lastSeenAdminReplyTime) {
          lastSeenAdminReplyTime = reply.time;
          const adminText = `🛡️ **Support Executive (${reply.by}):**\n\n${reply.text}`;
          addMessage(adminText, 'bot');
        }
      });
    }
  } catch (error) {
    console.error('Error polling for admin replies:', error);
  }
}

function startAdminPolling() {
  if (adminPollInterval) return;
  adminPollInterval = setInterval(checkAdminReplies, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  startAdminPolling();
  const inputEl = document.getElementById('userInput');
  if (inputEl) inputEl.focus();
  updateCharCount();
});

// =============================================
// NEW: FORM-BASED TICKET FLOW
// =============================================

function startTicketFlow(type = 'ticket') {
  ticketState.active = true;
  ticketState.type = type;
  
  // Disable main chat input to focus on the form
  const mainInput = document.getElementById('userInput');
  const mainSend = document.getElementById('sendBtn');
  if (mainInput) mainInput.disabled = true;
  if (mainSend) mainSend.disabled = true;
  
  const title = type === 'handoff' ? "Talk to Human Expert" : "Create Support Ticket";
  const buttonText = type === 'handoff' ? "Request Handoff" : "Create Ticket";
  const placeholder = type === 'handoff' ? "Briefly describe what you'd like to discuss..." : "Describe your issue or query in detail...";

  const formHtml = `
    <div class="ticket-form-card" style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-top: 10px; width: 100%; max-width: 400px; color: white;">
      <h3 style="margin-bottom: 12px; color: #6366f1; font-size: 16px; border-bottom: 1px solid #334155; padding-bottom: 8px;">${title}</h3>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <input type="text" id="form-name" placeholder="Your Full Name (Required)" style="padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 13px;">
        <input type="text" id="form-contact" placeholder="Mobile No. or Email" style="padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 13px;">
        <textarea id="form-query" placeholder="${placeholder}" rows="3" style="padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 13px; resize: none;"></textarea>
        <div style="display: flex; gap: 8px;">
            <button onclick="submitTicketForm()" id="btn-submit-form" style="flex: 1; padding: 10px; background: #6366f1; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">${buttonText}</button>
            <button onclick="cancelTicketFlow()" style="padding: 10px; background: #334155; color: #94a3b8; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  addMessage(formHtml, 'bot', null, true);
}

function cancelTicketFlow() {
    ticketState.active = false;
    
    // Re-enable main chat input
    const mainInput = document.getElementById('userInput');
    const mainSend = document.getElementById('sendBtn');
    if (mainInput) mainInput.disabled = false;
    if (mainSend) mainSend.disabled = false;
    
    addMessage("Creation cancelled. How else can I help?", 'bot');
}

async function submitTicketForm() {
    const name = document.getElementById('form-name').value.trim();
    const contact = document.getElementById('form-contact').value.trim();
    const query = document.getElementById('form-query').value.trim();
    const btn = document.getElementById('btn-submit-form');

    if (!name || !query) {
        alert("Please fill in your Name and Query.");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Processing...";

    const emailMatch = contact.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    ticketState.data = {
        name: name,
        email: emailMatch ? emailMatch[0] : "",
        phone: !emailMatch ? contact : "",
        issue: query
    };

    try {
        await finalizeTicket();
        ticketState.active = false;
    } catch (err) {
        alert("Error connecting to server. Please try again.");
        btn.disabled = false;
        btn.innerText = "Try Again";
    }
}

async function finalizeTicket(isPartialSync = false) {
  try {
    const response = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: ticketState.data.issue || "New Request",
        sessionId: SESSION_ID,
        intent: ticketState.type === 'handoff' ? 'HumanHandoff' : 'CreateTicket',
        ticketData: ticketState.data,
        isPartialSync: isPartialSync
      })
    });

    const data = await response.json();
    
    // Re-enable main chat input
    const mainInput = document.getElementById('userInput');
    const mainSend = document.getElementById('sendBtn');
    if (mainInput) mainInput.disabled = false;
    if (mainSend) mainSend.disabled = false;

    if (!isPartialSync) {
        if (ticketState.type === 'handoff') {
            addMessage("### ⏳ Connecting to Agent...\n\nI have notified our support team. **Please wait for a human customer care executive to respond.**", 'bot');
        } else {
            addMessage(data.reply, 'bot', data.ticket);
        }
    }

    if (data.ticketId) {
      ticketCount++;
      document.getElementById('ticketCount').textContent = ticketCount;
      showTicketInSidebar({ id: data.ticketId, status: 'Open' });
    }
  } catch (error) {
    throw error;
  }
}

// =============================================
// MAIN SEND LOGIC
// =============================================

async function sendMessage() {
  const inputElement = document.getElementById('userInput');
  const userText = inputElement.value.trim();
  if (!userText) return;
  
  inputElement.value = '';
  updateCharCount();
  
  addMessage(userText, 'user');
  messageCount++;
  document.getElementById('messageCount').textContent = messageCount;
  setLoading(true);
  
  try {
    const response = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText, sessionId: SESSION_ID })
    });
    
    const data = await response.json();

    if (data.intent === 'HumanHandoff') {
        startTicketFlow('handoff');
        setLoading(false);
        return;
    }
    
    if (data.intent === 'CreateTicket') {
        startTicketFlow('ticket');
        setLoading(false);
        return;
    }
    
    if (data.reply) {
      addMessage(data.reply, 'bot');
    }
    
  } catch (error) {
    addMessage("⚠️ Server connection error. Please try again.", 'bot');
  }
  
  setLoading(false);
  inputElement.focus();
}

function addMessage(text, type, ticket = null, isRaw = false) {
  const container = document.getElementById('messagesContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = `msg-wrapper ${type}-msg`;
  const avatarEmoji = type === 'bot' ? '🤖' : '👤';
  
  messageDiv.innerHTML = `
    <div class="msg-avatar">${avatarEmoji}</div>
    <div class="msg-bubble">
      ${isRaw ? text : formatMessage(text)}
      ${ticket ? createTicketCard(ticket) : ''}
      <span class="msg-time">${getCurrentTime()}</span>
    </div>
  `;
  container.appendChild(messageDiv);
  scrollToBottom();
}

function formatMessage(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function createTicketCard(ticket) {
  return `
    <div class="ticket-created-card" style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin-top: 10px;">
      <p style="font-size: 12px; color: #166534; margin-bottom: 4px;">✅ <strong>Support Ticket Created!</strong></p>
      <p style="font-weight: 700; font-size: 16px; color: #15803d;">#${ticket.id}</p>
      <p style="font-size: 11px; margin-top: 4px;">Status: <strong>${ticket.status || 'Open'}</strong></p>
    </div>
  `;
}

async function checkTicketStatus() {
  const ticketInput = document.getElementById('ticketInput').value.trim();
  if (!ticketInput) return;
  try {
    const response = await fetch(`${SERVER_URL}/api/ticket/${ticketInput}`);
    const data = await response.json();
    if (data.success) {
      const t = data.ticket;
      addMessage(`**Status for ${t.id}:**\n📋 Status: ${t.status}\n🔥 Priority: ${t.priority}`, 'bot');
    } else {
      addMessage(`❌ No ticket found with ID "${ticketInput}".`, 'bot');
    }
  } catch (error) { addMessage(`Error checking status.`, 'bot'); }
  document.getElementById('ticketInput').value = '';
}

function sendQuickMessage(message) {
  document.getElementById('userInput').value = message;
  sendMessage();
}

function clearChat() {
  if (!confirm('Clear chat history?')) return;
  const container = document.getElementById('messagesContainer');
  while (container.children.length > 1) container.removeChild(container.lastChild);
  messageCount = 0; ticketCount = 0;
  document.getElementById('messageCount').textContent = '0';
  document.getElementById('ticketCount').textContent = '0';
}

function setLoading(isLoading) {
  document.getElementById('typingIndicator').style.display = isLoading ? 'flex' : 'none';
  document.getElementById('sendBtn').disabled = isLoading;
  document.getElementById('userInput').disabled = isLoading;
}

function showTicketInSidebar(ticket) {
  const hub = document.getElementById('latestTicketHub');
  const card = document.getElementById('latestTicketCard');
  card.innerHTML = `<p class="ticket-id">${ticket.id}</p><p>Status: <strong>${ticket.status}</strong></p>`;
  hub.style.display = 'block';
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  container.scrollTop = container.scrollHeight;
}

function getCurrentTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function updateCharCount() {
  const input = document.getElementById('userInput');
  document.getElementById('charCount').textContent = `${input.value.length}/500`;
}

function handleKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}
