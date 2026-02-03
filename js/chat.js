// Chat functionality
(function() {
    'use strict';

    // DOM Elements
    const chatPanel = document.getElementById('chat-panel');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const toggleChatBtn = document.getElementById('toggle-chat-btn');
    const chatOpenTab = document.getElementById('chat-open-tab');
    const onlineCountEl = document.getElementById('chat-online-count');
    const gameContainer = document.getElementById('game-container');

    // State
    let lastMessageId = 0;
    let isPolling = false;
    let pollInterval = null;
    let isChatOpen = true;
    let canDeleteMessages = false;  // Whether current user can delete messages

    // Initialize
    if (chatPanel) {
        init();
    }

    function init() {
        loadMessages();
        startPolling();
        setupEventListeners();
        updateOnlineCount();

        // Check saved chat state
        const savedState = localStorage.getItem('chatOpen');
        if (savedState === 'false') {
            closeChat();
        } else {
            openChat();
        }
    }

    function setupEventListeners() {
        // Toggle chat button (arrow in header)
        if (toggleChatBtn) {
            toggleChatBtn.addEventListener('click', toggleChat);
        }

        // Open chat tab (when chat is closed)
        if (chatOpenTab) {
            chatOpenTab.addEventListener('click', openChat);
        }

        // Send message
        if (chatSendBtn) {
            chatSendBtn.addEventListener('click', sendMessage);
        }

        // Enter key to send
        if (chatInput) {
            chatInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        // Pause polling when page is hidden
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                stopPolling();
            } else {
                startPolling();
                loadMessages();
            }
        });
    }

    function toggleChat() {
        if (isChatOpen) {
            closeChat();
        } else {
            openChat();
        }
    }

    function openChat() {
        isChatOpen = true;
        chatPanel.classList.add('open');
        chatOpenTab.style.display = 'none';
        if (gameContainer) {
            gameContainer.classList.add('chat-open');
        }
        document.body.classList.add('chat-open');
        toggleChatBtn.style.transform = 'rotate(0deg)';
        localStorage.setItem('chatOpen', 'true');
    }

    function closeChat() {
        isChatOpen = false;
        chatPanel.classList.remove('open');
        chatOpenTab.style.display = 'flex';
        if (gameContainer) {
            gameContainer.classList.remove('chat-open');
        }
        document.body.classList.remove('chat-open');
        toggleChatBtn.style.transform = 'rotate(180deg)';
        localStorage.setItem('chatOpen', 'false');
    }

    async function loadMessages() {
        try {
            const response = await fetch('/chat/messages');
            const data = await response.json();

            if (data.success && data.messages) {
                canDeleteMessages = data.canDelete || false;
                renderMessages(data.messages);
                if (data.messages.length > 0) {
                    lastMessageId = data.messages[data.messages.length - 1].id;
                }
            }
        } catch (error) {
            console.error('Failed to load chat messages:', error);
        }
    }

    function renderMessages(messages) {
        if (!chatMessages) return;

        const wasAtBottom = isScrolledToBottom();

        chatMessages.innerHTML = '';

        if (messages.length === 0) {
            chatMessages.innerHTML = '<div class="chat-empty">No messages yet. Be the first to say hello!</div>';
            return;
        }

        messages.forEach(msg => {
            chatMessages.appendChild(createMessageElement(msg));
        });

        if (wasAtBottom) {
            scrollToBottom();
        }
    }

    function createMessageElement(msg) {
        const div = document.createElement('div');
        div.className = 'message';
        div.dataset.messageId = msg.id;

        const time = msg.createdAt ? formatTime(new Date(msg.createdAt)) : '--:--';
        const avatarUrl = msg.avatar || 'img/items/default-avatar.png';

        // Role badge and name color
        let roleBadge = '';
        let nameClass = 'message-user clickable';
        if (msg.role === 'admin') {
            roleBadge = '<span class="role-badge role-admin">ADMIN</span>';
            nameClass = 'message-user clickable role-admin-name';
        } else if (msg.role === 'staff') {
            roleBadge = '<span class="role-badge role-staff">STAFF</span>';
            nameClass = 'message-user clickable role-staff-name';
        }

        // Delete button for admin/staff
        const deleteBtn = canDeleteMessages ?
            `<button class="chat-delete-btn" onclick="window.deleteChatMessage(${msg.id})" title="Delete message">×</button>` : '';

        div.innerHTML = `
            <div class="message-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${escapeHtml(avatarUrl)}" alt="" class="message-avatar clickable-avatar" data-user-id="${msg.userId}" onerror="this.src='img/items/default-avatar.png'" title="Click to tip ${escapeHtml(msg.username)}">
                    ${roleBadge}
                    <span class="${nameClass}" data-user-id="${msg.userId}" title="Click to tip ${escapeHtml(msg.username)}">${escapeHtml(msg.username)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="message-time">${time}</span>
                    ${deleteBtn}
                </div>
            </div>
            <div class="message-content">${escapeHtml(msg.content)}</div>
        `;

        // Add click listeners for username and avatar
        const usernameEl = div.querySelector('.message-user.clickable');
        const avatarEl = div.querySelector('.message-avatar.clickable-avatar');

        if (usernameEl) {
            usernameEl.addEventListener('click', function() {
                const userId = this.dataset.userId;
                if (userId && window.openProfilePopup) {
                    window.openProfilePopup(userId);
                }
            });
        }

        if (avatarEl) {
            avatarEl.addEventListener('click', function() {
                const userId = this.dataset.userId;
                if (userId && window.openProfilePopup) {
                    window.openProfilePopup(userId);
                }
            });
            avatarEl.style.cursor = 'pointer';
        }

        return div;
    }

    function appendMessage(msg) {
        if (!chatMessages) return;

        const emptyEl = chatMessages.querySelector('.chat-empty');
        if (emptyEl) {
            emptyEl.remove();
        }

        const wasAtBottom = isScrolledToBottom();
        chatMessages.appendChild(createMessageElement(msg));

        if (wasAtBottom) {
            scrollToBottom();
        }

        lastMessageId = msg.id;
    }

    async function sendMessage() {
        if (!chatInput) return;

        const content = chatInput.value.trim();
        if (!content) return;

        // Disable input while sending
        chatInput.disabled = true;
        if (chatSendBtn) chatSendBtn.disabled = true;

        try {
            const response = await fetch('/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: content })
            });

            const data = await response.json();

            if (data.success && data.message) {
                chatInput.value = '';
                appendMessage(data.message);
            } else if (data.success && data.systemMessage) {
                // Command executed successfully - show system message
                chatInput.value = '';
                showSystemMessage(data.systemMessage);
            } else if (data.error) {
                showChatError(data.error);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            showChatError('Failed to send message');
        } finally {
            chatInput.disabled = false;
            if (chatSendBtn) chatSendBtn.disabled = false;
            chatInput.focus();
        }
    }

    function showSystemMessage(message) {
        if (!chatMessages) return;

        const div = document.createElement('div');
        div.className = 'message system-message';

        // Check if it's a multiline message (like leaderboard)
        const isMultiline = message.includes('\n');
        const formattedMessage = escapeHtml(message).replace(/\n/g, '<br>');

        div.innerHTML = `
            <div class="message-content" style="color: #00ff88; font-style: italic; ${isMultiline ? 'text-align: left; white-space: pre-line;' : 'text-align: center;'}">
                ${isMultiline ? '' : '✓ '}${formattedMessage}
            </div>
        `;

        const wasAtBottom = isScrolledToBottom();
        chatMessages.appendChild(div);

        if (wasAtBottom) {
            scrollToBottom();
        }

        // Remove system message after 5 seconds (10 for multiline like leaderboard)
        const timeout = isMultiline ? 10000 : 5000;
        setTimeout(() => {
            if (div.parentNode) {
                div.remove();
            }
        }, timeout);
    }

    // Delete message function - exposed globally for onclick
    window.deleteChatMessage = async function(messageId) {
        if (!confirm('Delete this message?')) return;

        try {
            const response = await fetch(`/chat/delete/${messageId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                // Remove message from DOM
                const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
                if (msgEl) {
                    msgEl.remove();
                }
            } else if (data.error) {
                showChatError(data.error);
            }
        } catch (error) {
            console.error('Failed to delete message:', error);
            showChatError('Failed to delete message');
        }
    };

    function startPolling() {
        if (isPolling) return;
        isPolling = true;

        pollInterval = setInterval(async () => {
            if (document.hidden) return;

            try {
                const response = await fetch('/chat/messages');
                const data = await response.json();

                if (data.success && data.messages) {
                    // Find new messages
                    const newMessages = data.messages.filter(m => m.id > lastMessageId);
                    newMessages.forEach(msg => appendMessage(msg));
                }
            } catch (error) {
                // Silent fail for polling
            }

            // Also update online count
            updateOnlineCount();
        }, 5000);
    }

    function stopPolling() {
        isPolling = false;
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    async function updateOnlineCount() {
        try {
            const response = await fetch('/chat/online');
            const data = await response.json();

            if (data.success && onlineCountEl) {
                onlineCountEl.textContent = `${data.online} Online`;
            }
        } catch (error) {
            // Silent fail
        }
    }

    function isScrolledToBottom() {
        if (!chatMessages) return true;
        return chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 50;
    }

    function scrollToBottom() {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showChatError(message) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, true);
        } else {
            console.error('Chat error:', message);
        }
    }
})();
