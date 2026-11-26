
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


// ==========================================
// 1. PLAYER AUTHENTICATION
// ==========================================

export async function signInPlayer() {

    if (auth.currentUser) {
        return auth.currentUser;
    }

    const result = await signInAnonymously(auth);

    return result.user;
}


// ==========================================
// 2. GENERATE ROOM CODE
// ==========================================

function generateRoomCode() {

    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    const randomValues = new Uint8Array(6);

    crypto.getRandomValues(randomValues);

    return Array.from(randomValues)
        .map(value => characters[value % characters.length])
        .join("");
}


// ==========================================
// 3. VALIDATE NICKNAME
// ==========================================

function validateNickname(nickname) {

    const name = nickname.trim();

    if (name.length < 2 || name.length > 18) {
        throw new Error("Nickname must contain 2–18 characters.");
    }

    return name;
}


// ==========================================
// 4. PLAYER ONLINE PRESENCE
// ==========================================

async function registerPlayerPresence(roomCode, playerId) {

    const onlineRef = ref(
        db,
        `rooms/${roomCode}/players/${playerId}/online`
    );

    await onDisconnect(onlineRef).set(false);

    await set(onlineRef, true);
}


// ==========================================
// 5. CREATE ONLINE ROOM
// ==========================================

export async function createOnlineRoom(nickname, game) {

    const user = await signInPlayer();

    const playerId = user.uid;

    const playerName = validateNickname(nickname);

    if (!["truth", "wheel"].includes(game)) {
        throw new Error("Select a game first.");
    }

    let roomCode = null;
    let roomCreated = false;

    for (let attempt = 0; attempt < 5; attempt++) {

        const newCode = generateRoomCode();

        const roomRef = ref(db, `rooms/${newCode}`);

        const roomData = {

            code: newCode,

            hostId: playerId,

            game: game,

            status: "waiting",

            maxPlayers: 8,

            createdAt: serverTimestamp(),

            players: {

                [playerId]: {

                    nickname: playerName,

                    online: true,

                    isHost: true,

                    joinedAt: Date.now()

                }

            },

            chat: {}

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

            roomCreated = true;

            break;

        }
    }

    if (!roomCreated) {
        throw new Error("Could not create a room. Please try again.");
    }

    await registerPlayerPresence(roomCode, playerId);

    return {
        code: roomCode,
        playerId: playerId,
        isHost: true
    };
}


// ==========================================
// 6. JOIN EXISTING ROOM
// ==========================================

export async function joinOnlineRoom(nickname, enteredCode) {

    const user = await signInPlayer();

    const playerId = user.uid;

    const playerName = validateNickname(nickname);

    const roomCode = enteredCode.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
        throw new Error("Enter a valid 6-character room code.");
    }

    const roomRef = ref(db, `rooms/${roomCode}`);

    const roomSnapshot = await get(roomRef);

    if (!roomSnapshot.exists()) {
        throw new Error("Room not found. Check the code.");
    }

    const room = roomSnapshot.val();

    if (room.status !== "waiting") {
        throw new Error("This game has already started.");
    }

    if (!room.players) {
        throw new Error("This room has no player list.");
    }

    const existingPlayer = room.players[playerId];

    const playerRef = ref(
        db,
        `rooms/${roomCode}/players/${playerId}`
    );

    // Add the player only if they are not already registered.

    if (!existingPlayer) {

        const playerCount = Object.keys(room.players).length;

        if (playerCount >= room.maxPlayers) {
            throw new Error("This room is full.");
        }

        await set(playerRef, {

            nickname: playerName,

            online: true,

            isHost: false,

            joinedAt: Date.now()

        });

    }

    // Register presence for both new and returning players.

    await registerPlayerPresence(roomCode, playerId);

    return {
        code: roomCode,
        playerId: playerId,
        isHost: playerId === room.hostId
    };
}


// ==========================================
// 7. LISTEN TO ROOM CHANGES
// ==========================================

export function watchRoom(roomCode, callback) {

    const roomRef = ref(db, `rooms/${roomCode}`);

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

            console.error("ROOM LISTENER ERROR:", error);

        }
    );
}


// ==========================================
// 8. STOP WATCHING ROOM
// ==========================================

export function stopWatchingRoomListener(listener) {

    if (typeof listener === "function") {
        listener();
    }

}
