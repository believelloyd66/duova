
import { db, auth } from "./firebase-config.js";

import {
    ref,
    get,
    set,
    runTransaction,
    onValue,
    onDisconnect,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";

import {
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";


/* ==========================================
   DUOVA — MULTIPLAYER SYSTEM
   ========================================== */

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;


/* ==========================================
   01. PLAYER AUTHENTICATION
   ========================================== */

export async function signInPlayer() {

    if (auth.currentUser) {
        return auth.currentUser;
    }

    const result = await signInAnonymously(auth);

    return result.user;

}


/* ==========================================
   02. GENERATE ROOM CODE
   ========================================== */

function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    const randomValues = new Uint8Array(6);

    crypto.getRandomValues(randomValues);

    return Array.from(randomValues)
        .map(value =>
            characters[value % characters.length]
        )
        .join("");

}


/* ==========================================
   03. VALIDATE NICKNAME
   ========================================== */

function validateNickname(nickname) {

    if (typeof nickname !== "string") {
        throw new Error("Enter a valid nickname.");
    }

    const name = nickname.trim();

    if (name.length < 2 || name.length > 18) {
        throw new Error(
            "Nickname must contain 2–18 characters."
        );
    }

    return name;

}


/* ==========================================
   04. VALIDATE ROOM CODE
   ========================================== */

function validateRoomCode(code) {

    if (typeof code !== "string") {
        throw new Error("Enter a valid room code.");
    }

    const roomCode = code.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
        throw new Error(
            "Enter a valid 6-character room code."
        );
    }

    return roomCode;

}


/* ==========================================
   05. PLAYER ONLINE PRESENCE
   ========================================== */

async function registerPlayerPresence(roomCode, playerId) {

    const onlineRef = ref(
        db,
        `rooms/${roomCode}/players/${playerId}/online`
    );

    // Register automatic offline status when disconnected.

    await onDisconnect(onlineRef).set(false);

    // Mark this player as online.

    await set(onlineRef, true);

}


/* ==========================================
   06. CREATE ONLINE ROOM
   ========================================== */

export async function createOnlineRoom(nickname, game) {

    const user = await signInPlayer();

    const playerId = user.uid;

    const playerName = validateNickname(nickname);

    if (!["truth", "wheel"].includes(game)) {
        throw new Error("Select a game first.");
    }

    let roomCode = null;

    for (let attempt = 0; attempt < 5; attempt++) {

        const newCode = generateRoomCode();

        const roomRef = ref(
            db,
            `rooms/${newCode}`
        );

        const roomData = {

            code: newCode,

            hostId: playerId,

            game: game,

            status: "waiting",

            maxPlayers: MAX_PLAYERS,

            createdAt: serverTimestamp(),

            players: {

                [playerId]: {

                    nickname: playerName,

                    online: true,

                    isHost: true,

                    joinedAt: Date.now()

                }

            }

        };

        const result = await runTransaction(
            roomRef,
            currentData => {

                if (currentData === null) {
                    return roomData;
                }

                return;

            }
        );

        if (result.committed) {

            roomCode = newCode;

            break;

        }

    }

    if (!roomCode) {
        throw new Error(
            "Could not create a room. Please try again."
        );
    }

    await registerPlayerPresence(
        roomCode,
        playerId
    );

    return {

        code: roomCode,

        playerId: playerId,

        isHost: true

    };

}


/* ==========================================
   07. JOIN EXISTING ROOM
   ========================================== */

export async function joinOnlineRoom(nickname, enteredCode) {

    const user = await signInPlayer();

    const playerId = user.uid;

    const playerName = validateNickname(nickname);

    const roomCode = validateRoomCode(enteredCode);

    const roomRef = ref(
        db,
        `rooms/${roomCode}`
    );

    const roomSnapshot = await get(roomRef);

    if (!roomSnapshot.exists()) {
        throw new Error(
            "Room not found. Check the code."
        );
    }

    const room = roomSnapshot.val();

    if (room.status !== "waiting") {
        throw new Error(
            "This game has already started."
        );
    }

    if (!room.players) {
        throw new Error(
            "This room has no player list."
        );
    }

    const playerRef = ref(
        db,
        `rooms/${roomCode}/players/${playerId}`
    );

    const existingPlayer = room.players[playerId];

    // Check whether this player is already registered.

    if (existingPlayer) {

        if (existingPlayer.isHost === true &&
            room.hostId !== playerId) {

            throw new Error(
                "Room membership could not be verified."
            );

        }

    } else {

        // Count currently registered players.

        const playerCount = Object.keys(
            room.players
        ).length;

        if (playerCount >= MAX_PLAYERS) {
            throw new Error(
                "This room is full."
            );
        }

        // Register the new player without overwriting
        // an existing player record.

        const result = await runTransaction(
            playerRef,
            currentPlayer => {

                if (currentPlayer === null) {

                    return {

                        nickname: playerName,

                        online: true,

                        isHost: false,

                        joinedAt: Date.now()

                    };

                }

                return;

            }
        );

        if (!result.committed) {

            if (!result.snapshot.exists()) {
                throw new Error(
                    "Could not join the room. Try again."
                );
            }

        }

    }

    // Confirm that the room is still waiting.

    const latestRoomSnapshot = await get(roomRef);

    if (!latestRoomSnapshot.exists()) {
        throw new Error("This room no longer exists.");
    }

    const latestRoom = latestRoomSnapshot.val();

    if (latestRoom.status !== "waiting") {
        throw new Error(
            "This game has already started."
        );
    }

    if (!latestRoom.players?.[playerId]) {
        throw new Error(
            "Your player registration could not be verified."
        );
    }

    await registerPlayerPresence(
        roomCode,
        playerId
    );

    return {

        code: roomCode,

        playerId: playerId,

        isHost: playerId === latestRoom.hostId

    };

}


/* ==========================================
   08. LISTEN TO ROOM CHANGES
   ========================================== */

export function watchRoom(roomCode, callback) {

    const validCode = validateRoomCode(roomCode);

    const roomRef = ref(
        db,
        `rooms/${validCode}`
    );

    return onValue(

        roomRef,

        snapshot => {

            if (!snapshot.exists()) {
                callback(null);
                return;
            }

            callback(snapshot.val());

        },

        error => {

            console.error(
                "DUOVA ROOM LISTENER ERROR:",
                error
            );

        }

    );

}


/* ==========================================
   09. STOP WATCHING ROOM
   ========================================== */

export function stopWatchingRoomListener(listener) {

    if (typeof listener === "function") {
        listener();
    }

}


/* ==========================================
   10. PLAYER COUNT HELPERS
   ========================================== */

export function getOnlinePlayerCount(room) {

    if (!room?.players) {
        return 0;
    }

    return Object.values(room.players)
        .filter(player => player.online === true)
        .length;

}


export function canStartGame(room, playerId) {

    if (!room || !playerId) {
        return false;
    }

    const onlinePlayers =
        getOnlinePlayerCount(room);

    return (
        room.status === "waiting" &&
        room.hostId === playerId &&
        onlinePlayers >= MIN_PLAYERS &&
        onlinePlayers <= MAX_PLAYERS
    );

}
