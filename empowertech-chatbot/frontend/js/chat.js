// =============================================
// chat.js - Frontend Chat Logic (Redesigned)
// =============================================

const SESSION_ID = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
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
          const adminText = `🛡️ **Integrity Expert (${reply.by}):**\n\n${reply.text}`;
          addMessage(adminText, 'bot');
        }
      });
    }
  } catch (error) { console.error('Error polling for admin replies:', error); }
}

function startAdminPolling() {
  if (adminPollInterval) return;
  adminPollInterval = setInterval(checkAdminReplies, 5000);
}

/** Toggles between Dark and Light mode */
function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    const icon = document.getElementById('theme-icon');
    
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('chat-theme', newTheme);
    
    if (icon) {
        icon.className = newTheme === 'dark' ? 'ti ti-moon' : 'ti ti-sun';
    }
}

document.addEventListener('DOMContentLoaded', () => {
  // Load saved theme
  const savedTheme = localStorage.getItem('chat-theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = savedTheme === 'dark' ? 'ti ti-moon' : 'ti ti-sun';
  
  const sessionIdDisplay = document.getElementById('sessionIdDisplay');
  if (sessionIdDisplay) sessionIdDisplay.textContent = SESSION_ID.split('-').pop();

  startAdminPolling();
  const inputEl = document.getElementById('userInput');
  if (inputEl) inputEl.focus();
  updateCharCount();
});

// =============================================
// TICKET / HANDOFF FORM FLOW
// =============================================

function startTicketFlow(type = 'ticket') {
  ticketState.active = true;
  ticketState.type = type;
  
  // Disable main chat input
  const mainInput = document.getElementById('userInput');
  const mainSend = document.getElementById('sendBtn');
  if (mainInput) mainInput.disabled = true;
  if (mainSend) mainSend.disabled = true;
  
  const title = type === 'handoff' ? "Consult Integrity Expert" : "Request Support";
  const buttonText = type === 'handoff' ? "Request Consultation" : "Submit Request";
  const placeholder = type === 'handoff' ? "Briefly describe your academic query..." : "Explain the issue with your report...";

  const formHtml = `
    <div class="ticket-form-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; margin-top: 10px; width: 100%; max-width: 400px; color: var(--text-primary); box-shadow: var(--shadow);">
      <h3 style="margin-bottom: 12px; color: var(--primary); font-size: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">${title}</h3>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <input type="text" id="form-name" placeholder="Full Name (Required)" style="padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-primary); font-size: 13px; outline: none;">
        <input type="text" id="form-contact" placeholder="Email or University ID" style="padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-primary); font-size: 13px; outline: none;">
        <textarea id="form-query" placeholder="${placeholder}" rows="3" style="padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-primary); font-size: 13px; resize: none; outline: none;"></textarea>
        <div style="display: flex; gap: 8px;">
            <button onclick="submitTicketForm()" id="btn-submit-form" style="flex: 1; padding: 10px; background: var(--primary); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">${buttonText}</button>
            <button onclick="cancelTicketFlow()" style="padding: 10px; background: var(--bg-main); color: var(--text-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">Cancel</button>
        </div>
      </div>
    </div>
  `;
  addMessage(formHtml, 'bot', null, true);
}

function cancelTicketFlow() {
    ticketState.active = false;
    const mainInput = document.getElementById('userInput');
    const mainSend = document.getElementById('sendBtn');
    if (mainInput) mainInput.disabled = false;
    if (mainSend) mainSend.disabled = false;
    addMessage("Cancelled. How else can I help?", 'bot');
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
    btn.innerText = "Saving...";

    const emailMatch = contact.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const data = {
        name: name,
        email: emailMatch ? emailMatch[0] : "",
        phone: !emailMatch ? contact : "",
        issue: query,
        sessionId: SESSION_ID
    };

    try {
        const endpoint = ticketState.type === 'handoff' ? '/api/handoff/create' : '/api/ticket/create';
        const res = await fetch(`${SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
            // Re-enable main chat
            document.getElementById('userInput').disabled = false;
            document.getElementById('sendBtn').disabled = false;
            
            if (ticketState.type === 'handoff') {
                addMessage(`⏳ **Handoff Token: ${result.handoffId}**\n\nSupport team notified. Please wait for an executive to respond.`, 'bot');
            } else {
                addMessage(`✅ **Success!**\n\nYour ticket **${result.ticketId}** has been created. Our team will contact you soon.`, 'bot');
            }
            ticketState.active = false;
        } else { throw new Error(result.error); }
    } catch (err) {
        alert("Error: " + err.message);
        btn.disabled = false;
        btn.innerText = "Try Again";
    }
}

// =============================================
// MAIN CHAT LOGIC
// =============================================

async function sendMessage() {
  const inputElement = document.getElementById('userInput');
  const userText = inputElement.value.trim();
  if (!userText || inputElement.disabled) return;
  
  inputElement.value = '';
  updateCharCount();
  addMessage(userText, 'user');
  setLoading(true);
  
  try {
    const response = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText, sessionId: SESSION_ID })
    });
    const data = await response.json();

    if (data.intent === 'HumanHandoff') return startTicketFlow('handoff');
    if (data.intent === 'CreateTicket') return startTicketFlow('ticket');
    
    if (data.reply) addMessage(data.reply, 'bot');
  } catch (error) {
    addMessage("⚠️ Server error. Please check your connection.", 'bot');
  }
  setLoading(false);
}

function addMessage(text, type, ticket = null, isRaw = false) {
  const container = document.getElementById('messagesContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = `msg-${type}`;
  
  if (type === 'bot') {
    messageDiv.innerHTML = `
      <div class="bot-bubble-wrapper">
        <div class="msg-bot-bubble">
          ${isRaw ? text : formatMessage(text)}
          ${ticket ? createTicketCard(ticket) : ''}
          <span class="msg-time">${getCurrentTime()}</span>
        </div>
      </div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="msg-user-bubble">
        ${formatMessage(text)}
        <span class="msg-time" style="color: rgba(255,255,255,0.7);">${getCurrentTime()}</span>
      </div>
    `;
  }
  
  container.appendChild(messageDiv);
  scrollToBottom();
}

function formatMessage(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/\n/g, '<br>')
             .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function createTicketCard(ticket) {
  return `
    <div class="ticket-created-card" style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 8px; padding: 12px; margin-top: 10px;">
      <p style="font-size: 12px; color: #22c55e; margin-bottom: 4px;">✅ <strong>Support Request Logged!</strong></p>
      <p style="font-weight: 700; font-size: 16px; color: #16a34a;">#${ticket.id}</p>
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
    } else { addMessage(`❌ No ticket found with ID "${ticketInput}".`, 'bot'); }
  } catch (error) { addMessage(`Error checking status.`, 'bot'); }
  document.getElementById('ticketInput').value = '';
}

function sendQuickMessage(message) {
  document.getElementById('userInput').value = message;
  sendMessage();
}

function clearChat() {
  const container = document.getElementById('messagesContainer');
  // Keep the first message (welcome)
  while (container.children.length > 1) {
    container.removeChild(container.lastChild);
  }
}

function setLoading(isLoading) {
  const typing = document.getElementById('typingIndicator');
  const btn = document.getElementById('sendBtn');
  const input = document.getElementById('userInput');
  if (typing) typing.style.display = isLoading ? 'flex' : 'none';
  if (btn && !ticketState.active) btn.disabled = isLoading;
  if (input && !ticketState.active) input.disabled = isLoading;
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  if (container) container.scrollTop = container.scrollHeight;
}

function getCurrentTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function updateCharCount() {
  const input = document.getElementById('userInput');
  const char = document.getElementById('charCount');
  if (input && char) char.textContent = `${input.value.length}/500`;
}

function handleKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}
