
import { auth } from "./firebase-config.js";

import {
    watchRoom,
    stopWatchingRoomListener,
    canStartGame,
    getOnlinePlayerCount
} from "./multiplayer.js";

import {
    initializeChat,
    closeChat
} from "./chat.js";


/* =========================================
   DUOVA — LOBBY SYSTEM
   ========================================= */


/* =========================================
   01. STATE
   ========================================= */

let currentRoomCode = null;
let roomListener = null;
let currentRoomData = null;
let startGameCallback = null;
let chatInitialized = false;


/* =========================================
   02. ELEMENTS
   ========================================= */

const roomSection =
    document.getElementById("roomSection");


/* =========================================
   03. HTML ESCAPING
   ========================================= */

function escapeHTML(value) {

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
   04. OPEN LOBBY
   ========================================= */

export function openLobby(roomCode, onStart = null) {

    if (!roomSection) {

        console.error(
            "DUOVA: Room section was not found."
        );

        return;

    }

    closeLobby();

    currentRoomCode = roomCode.toUpperCase();

    startGameCallback = onStart;

    roomSection.innerHTML = `

        <div class="lobby-container">

            <div class="lobby-header">

                <span class="lobby-label">GAME ROOM</span>

                <h2>Waiting Room</h2>

                <p>
                    Your room is ready.
                    Waiting for players to join.
                </p>

            </div>


            <div class="lobby-code-card">

                <span>ROOM CODE</span>

                <div class="lobby-code-row">

                    <strong id="lobbyRoomCode">
                        ${escapeHTML(currentRoomCode)}
                    </strong>

                    <button id="copyLobbyCode">
                        Copy Code
                    </button>

                </div>

            </div>


            <div class="lobby-player-section">

                <div class="lobby-player-heading">

                    <h3>Players</h3>

                    <span id="lobbyPlayerCount">
                        0 / 8
                    </span>

                </div>

                <div
                    id="lobbyPlayers"
                    class="lobby-players"
                >

                    <p class="lobby-loading">
                        Loading players...
                    </p>

                </div>

            </div>


            <div class="lobby-footer">

                <p id="lobbyStatus">
                    Connecting to room...
                </p>

                <button
                    id="startLobbyGame"
                    disabled
                >
                    Waiting for players
                </button>

            </div>

        </div>

    `;

    setupLobbyButtons();

    listenToLobby();

}


/* =========================================
   05. LOBBY BUTTONS
   ========================================= */

function setupLobbyButtons() {

    const copyButton =
        document.getElementById("copyLobbyCode");

    const startButton =
        document.getElementById("startLobbyGame");


    copyButton?.addEventListener("click", async () => {

        try {

            await navigator.clipboard.writeText(
                currentRoomCode
            );

            copyButton.textContent = "Copied";

        } catch (error) {

            console.error(
                "Could not copy room code:",
                error
            );

            copyButton.textContent = "Copy failed";

        }

    });


    startButton?.addEventListener("click", () => {

        if (!currentRoomData) return;

        const playerId = auth.currentUser?.uid;

        if (!canStartGame(currentRoomData, playerId)) {

            updateLobbyControls(currentRoomData);

            return;

        }

        if (typeof startGameCallback !== "function") {

            updateLobbyStatus(
                "Game start has not been connected yet."
            );

            return;

        }

        startButton.disabled = true;

        startButton.textContent = "Starting...";

        startGameCallback(currentRoomData);

    });

}


/* =========================================
   06. REALTIME ROOM LISTENER
   ========================================= */

function listenToLobby() {

    roomListener = watchRoom(

        currentRoomCode,

        room => {

            if (!room) {

                currentRoomData = null;

                updateLobbyStatus(
                    "Room could not be found."
                );

                return;

            }

            currentRoomData = room;

            renderPlayers(room);

            updateLobbyControls(room);


            // Initialize chat only once.

            if (!chatInitialized && auth.currentUser) {

                const player =
                    room.players?.[auth.currentUser.uid];

                if (player && player.nickname) {

                    initializeChat(
                        currentRoomCode,
                        player.nickname
                    );

                    chatInitialized = true;

                }

            }

        }

    );

}


/* =========================================
   07. RENDER PLAYERS
   ========================================= */

function renderPlayers(room) {

    const playersContainer =
        document.getElementById("lobbyPlayers");

    const playerCount =
        document.getElementById("lobbyPlayerCount");

    if (!playersContainer || !playerCount) return;


    const players = Object.entries(
        room.players || {}
    );

    const onlinePlayers = players.filter(
        ([, player]) => player.online === true
    );


    playerCount.textContent =
        `${getOnlinePlayerCount(room)} / ${room.maxPlayers || 8}`;


    if (onlinePlayers.length === 0) {

        playersContainer.innerHTML = `

            <p class="lobby-loading">
                Waiting for players...
            </p>

        `;

        return;

    }


    playersContainer.innerHTML = onlinePlayers.map(

        ([playerId, player]) => {

            const isHost =
                playerId === room.hostId;

            return `

                <div class="lobby-player-card">

                    <div class="lobby-player-avatar">

                        ${escapeHTML(
                            (player.nickname || "P")
                                .charAt(0)
                                .toUpperCase()
                        )}

                    </div>

                    <div class="lobby-player-info">

                        <strong>
                            ${escapeHTML(
                                player.nickname || "Player"
                            )}
                        </strong>

                        <span>
                            ${isHost ? "Room Host" : "Player"}
                        </span>

                    </div>

                    <span class="lobby-online-indicator">
                        Online
                    </span>

                </div>

            `;

        }

    ).join("");

}


/* =========================================
   08. UPDATE LOBBY CONTROLS
   ========================================= */

function updateLobbyControls(room) {

    const startButton =
        document.getElementById("startLobbyGame");

    if (!startButton) return;


    const playerId = auth.currentUser?.uid;

    const onlinePlayers =
        getOnlinePlayerCount(room);

    const isHost =
        room.hostId === playerId;


    if (room.status === "playing") {

        startButton.textContent = "Game Starting...";

        startButton.disabled = true;

        updateLobbyStatus(
            "The game is starting."
        );

        return;

    }


    if (room.status !== "waiting") {

        startButton.textContent = "Unavailable";

        startButton.disabled = true;

        updateLobbyStatus(
            "This room is currently unavailable."
        );

        return;

    }


    if (!isHost) {

        startButton.textContent = "Waiting for Host";

        startButton.disabled = true;

        updateLobbyStatus(
            "Waiting for the host to start the game."
        );

        return;

    }


    if (onlinePlayers < 2) {

        startButton.textContent = "Waiting for Players";

        startButton.disabled = true;

        updateLobbyStatus(
            "At least 2 online players are needed."
        );

        return;

    }


    if (onlinePlayers > (room.maxPlayers || 8)) {

        startButton.textContent = "Room Limit Exceeded";

        startButton.disabled = true;

        updateLobbyStatus(
            "The room has exceeded its player limit."
        );

        return;

    }


    startButton.textContent = "Start Game";

    startButton.disabled = false;

    updateLobbyStatus(
        `${onlinePlayers} players online. The host can start.`
    );

}


/* =========================================
   09. STATUS MESSAGE
   ========================================= */

function updateLobbyStatus(message) {

    const status =
        document.getElementById("lobbyStatus");

    if (status) {
        status.textContent = message;
    }

}


/* =========================================
   10. CLOSE LOBBY
   ========================================= */

export function closeLobby() {

    if (roomListener) {

        stopWatchingRoomListener(roomListener);

        roomListener = null;

    }

    closeChat();

    chatInitialized = false;

    currentRoomCode = null;

    currentRoomData = null;

    startGameCallback = null;

}
