
import { db, auth } from "./firebase-config.js";

import {
    ref,
    push,
    set,
    onValue,
    query,
    orderByChild,
    limitToLast,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";


/* =========================================
   DUOVA — ROOM CHAT
   ========================================= */


/* =========================================
   01. CHAT STATE
   ========================================= */

let currentChatRoom = null;
let chatListener = null;
let chatNickname = null;

let chatMessages = [];
let chatOpen = false;


/* =========================================
   02. CHAT ELEMENTS
   ========================================= */

let chatContainer = null;
let chatMessagesContainer = null;
let chatInput = null;
let chatSendButton = null;
let chatToggleButton = null;


/* =========================================
   03. HTML ESCAPING
   ========================================= */

function escapeChatHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => {

        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];

    });

}


/* =========================================
   04. INITIALIZE CHAT
   ========================================= */

export function initializeChat(roomCode, nickname) {

    closeChat();

    if (!auth.currentUser) {
        console.error("DUOVA: Player is not authenticated.");
        return;
    }

    currentChatRoom = roomCode.toUpperCase();

    chatNickname = nickname;

    createChatInterface();

    listenForMessages();

}


/* =========================================
   05. CREATE CHAT INTERFACE
   ========================================= */

function createChatInterface() {

    const existingChat =
        document.getElementById("duovaChat");

    if (existingChat) {
        existingChat.remove();
    }

    chatContainer = document.createElement("div");

    chatContainer.id = "duovaChat";

    chatContainer.innerHTML = `

        <button
            type="button"
            id="chatToggle"
            class="duova-chat-toggle"
            aria-label="Open room chat"
            aria-expanded="false"
        >
            <span>Chat</span>
            <span id="chatUnreadCount"></span>
        </button>


        <section
            class="duova-chat-panel"
            id="chatPanel"
            aria-label="Room chat"
            aria-hidden="true"
        >

            <header class="duova-chat-header">

                <div>
                    <span class="duova-chat-label">
                        DUOVA COMMUNITY
                    </span>

                    <h3>Room Chat</h3>
                </div>

                <button
                    type="button"
                    id="chatClose"
                    aria-label="Close chat"
                >
                    ×
                </button>

            </header>


            <div
                class="duova-chat-messages"
                id="chatMessages"
                aria-live="polite"
                aria-relevant="additions"
            >
                <p class="chat-empty">
                    Connecting to room chat...
                </p>
            </div>


            <form
                class="duova-chat-form"
                id="chatForm"
            >

                <input
                    type="text"
                    id="chatInput"
                    maxlength="500"
                    placeholder="Write a message..."
                    autocomplete="off"
                    required
                >

                <button
                    type="submit"
                    id="chatSend"
                >
                    Send
                </button>

            </form>

        </section>

    `;


    document.body.appendChild(chatContainer);


    chatMessagesContainer =
        document.getElementById("chatMessages");

    chatInput =
        document.getElementById("chatInput");

    chatSendButton =
        document.getElementById("chatSend");

    chatToggleButton =
        document.getElementById("chatToggle");


    setupChatEvents();

}


/* =========================================
   06. CHAT EVENTS
   ========================================= */

function setupChatEvents() {

    const chatForm =
        document.getElementById("chatForm");

    const chatClose =
        document.getElementById("chatClose");


    chatToggleButton.addEventListener("click", () => {

        toggleChat();

    });


    chatClose.addEventListener("click", () => {

        toggleChat(false);

    });


    chatForm.addEventListener("submit", async event => {

        event.preventDefault();

        await sendChatMessage();

    });

}


/* =========================================
   07. OPEN / CLOSE CHAT
   ========================================= */

function toggleChat(forceState = null) {

    chatOpen = forceState === null
        ? !chatOpen
        : forceState;

    const panel =
        document.getElementById("chatPanel");

    if (!panel) return;

    panel.classList.toggle("active", chatOpen);

    panel.setAttribute(
        "aria-hidden",
        String(!chatOpen)
    );

    chatToggleButton.setAttribute(
        "aria-expanded",
        String(chatOpen)
    );

    if (chatOpen && chatMessagesContainer) {

        chatMessagesContainer.scrollTop =
            chatMessagesContainer.scrollHeight;

        chatInput?.focus();

    }

}


/* =========================================
   08. LISTEN FOR MESSAGES
   ========================================= */

function listenForMessages() {

    if (!currentChatRoom) return;

    const messagesRef = query(

        ref(
            db,
            `rooms/${currentChatRoom}/chat`
        ),

        orderByChild("createdAt"),

        limitToLast(50)

    );


    chatListener = onValue(

        messagesRef,

        snapshot => {

            chatMessages = [];

            snapshot.forEach(childSnapshot => {

                chatMessages.push({

                    id: childSnapshot.key,

                    ...childSnapshot.val()

                });

            });


            renderChatMessages();

        },

        error => {

            console.error(
                "DUOVA chat listener error:",
                error
            );

            chatMessagesContainer.innerHTML = `

                <p class="chat-empty">
                    Unable to load messages.
                </p>

            `;

        }

    );

}


/* =========================================
   09. RENDER MESSAGES
   ========================================= */

function renderChatMessages() {

    if (!chatMessagesContainer) return;

    if (chatMessages.length === 0) {

        chatMessagesContainer.innerHTML = `

            <p class="chat-empty">
                No messages yet. Start the conversation.
            </p>

        `;

        return;

    }


    chatMessagesContainer.innerHTML =

        chatMessages.map(message => {

            const isMine =
                message.senderId === auth.currentUser?.uid;

            const nickname =
                escapeChatHTML(message.nickname || "Player");

            const content =
                escapeChatHTML(message.message || "");

            const time =
                formatMessageTime(message.createdAt);


            return `

                <article class="
                    duova-message
                    ${isMine ? "my-message" : "other-message"}
                ">

                    <div class="message-meta">

                        <strong>${nickname}</strong>

                        <time>${time}</time>

                    </div>

                    <p>${content}</p>

                </article>

            `;

        }).join("");


    chatMessagesContainer.scrollTop =
        chatMessagesContainer.scrollHeight;

}


/* =========================================
   10. FORMAT MESSAGE TIME
   ========================================= */

function formatMessageTime(timestamp) {

    if (!timestamp) return "Just now";

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "Just now";
    }

    return date.toLocaleTimeString([], {

        hour: "2-digit",

        minute: "2-digit"

    });

}


/* =========================================
   11. SEND MESSAGE
   ========================================= */

async function sendChatMessage() {

    if (!currentChatRoom || !auth.currentUser) {
        return;
    }

    const message = chatInput.value.trim();

    if (!message) return;

    if (message.length > 500) {
        return;
    }


    chatSendButton.disabled = true;

    chatInput.disabled = true;


    try {

        const messagesRef = ref(

            db,

            `rooms/${currentChatRoom}/chat`

        );


        const newMessageRef = push(messagesRef);


        await set(newMessageRef, {

            senderId: auth.currentUser.uid,

            nickname: chatNickname,

            message: message,

            createdAt: serverTimestamp()

        });


        chatInput.value = "";


    } catch (error) {

        console.error(
            "DUOVA message error:",
            error
        );

        alert(
            "Message could not be sent. Please try again."
        );

    } finally {

        chatSendButton.disabled = false;

        chatInput.disabled = false;

        chatInput.focus();

    }

}


/* =========================================
   12. CLOSE AND CLEAN UP CHAT
   ========================================= */

export function closeChat() {

    if (typeof chatListener === "function") {

        chatListener();

    }

    chatListener = null;

    currentChatRoom = null;

    chatNickname = null;

    chatMessages = [];

    chatOpen = false;


    const existingChat =
        document.getElementById("duovaChat");

    if (existingChat) {

        existingChat.remove();

    }


    chatContainer = null;

    chatMessagesContainer = null;

    chatInput = null;

    chatSendButton = null;

    chatToggleButton = null;

}
