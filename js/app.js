
import {
    createOnlineRoom,
    joinOnlineRoom
} from "./multiplayer.js";

import {
    openLobby
} from "./lobby.js";


/* =========================================
   DUOVA — MAIN JAVASCRIPT
   Complete Main Application
   ========================================= */


/* =========================================
   01. ELEMENTS
   ========================================= */

const gameCarousel = document.getElementById("gameCarousel");
const previousGame = document.getElementById("previousGame");
const nextGame = document.getElementById("nextGame");
const carouselProgress = document.getElementById("carouselProgress");

const gameCards = document.querySelectorAll(".game-card");
const gameButtons = document.querySelectorAll("[data-select-game]");

const playerNameInput = document.getElementById("playerName");
const roomCodeInput = document.getElementById("roomCode");

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");

const roomSection = document.getElementById("roomSection");


/* =========================================
   02. GAME STATE
   ========================================= */

let selectedGame = null;
let currentCardIndex = 0;
let currentRoomCode = null;


/* =========================================
   03. VALIDATE PLAYER NAME
   ========================================= */

function getPlayerName() {

    const name = playerNameInput.value.trim();

    if (!name) {
        showMessage("Enter your nickname first.", "error");
        playerNameInput.focus();
        return null;
    }

    if (name.length < 2) {
        showMessage(
            "Your nickname must contain at least 2 characters.",
            "error"
        );

        playerNameInput.focus();
        return null;
    }

    return name;
}


/* =========================================
   04. VALIDATE SELECTED GAME
   ========================================= */

function validateGame() {

    if (!selectedGame) {
        showMessage("Choose a game before continuing.", "error");
        return false;
    }

    return true;
}


/* =========================================
   05. VALIDATE ROOM CODE
   ========================================= */

function getRoomCode() {

    const code = roomCodeInput.value.trim().toUpperCase();

    if (!code) {
        showMessage("Enter a room code.", "error");
        roomCodeInput.focus();
        return null;
    }

    if (!/^[A-Z0-9]{6}$/.test(code)) {
        showMessage(
            "Room codes must contain exactly 6 characters.",
            "error"
        );

        roomCodeInput.focus();
        return null;
    }

    return code;
}


/* =========================================
   06. CREATE ONLINE ROOM
   ========================================= */

createRoomButton.addEventListener("click", async () => {

    const playerName = getPlayerName();

    if (!playerName) return;
    if (!validateGame()) return;

    createRoomButton.disabled = true;
    createRoomButton.textContent = "Creating...";

    try {

        const room = await createOnlineRoom(
            playerName,
            selectedGame
        );

        currentRoomCode = room.code;

        roomCodeInput.value = room.code;

        showMessage(
            `Room created! Your code is ${room.code}`,
            "success"
        );

        openLobby(room.code, () => {

            showMessage(
                "Game starting will be connected to the backend next.",
                "info"
            );

        });

        console.log("ROOM CREATED:", room);

    } catch (error) {

        console.error("CREATE ROOM ERROR:", error);

        showMessage(
            error.message || "Could not create room.",
            "error"
        );

    } finally {

        createRoomButton.disabled = false;
        createRoomButton.textContent = "Create Room";

    }

});


/* =========================================
   07. JOIN ONLINE ROOM
   ========================================= */

joinRoomButton.addEventListener("click", async () => {

    const playerName = getPlayerName();

    if (!playerName) return;

    const roomCode = getRoomCode();

    if (!roomCode) return;

    joinRoomButton.disabled = true;
    joinRoomButton.textContent = "Joining...";

    try {

        const room = await joinOnlineRoom(
            playerName,
            roomCode
        );

        currentRoomCode = room.code;

        showMessage(
            `Successfully joined room ${room.code}!`,
            "success"
        );

        openLobby(room.code, () => {

            showMessage(
                "Game starting will be connected to the backend next.",
                "info"
            );

        });

        console.log("ROOM JOINED:", room);

    } catch (error) {

        console.error("JOIN ROOM ERROR:", error);

        showMessage(
            error.message || "Could not join room.",
            "error"
        );

    } finally {

        joinRoomButton.disabled = false;
        joinRoomButton.textContent = "Join Room";

    }

});


/* =========================================
   08. ROOM CODE FORMATTING
   ========================================= */

roomCodeInput.addEventListener("input", () => {

    roomCodeInput.value = roomCodeInput.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);

});


/* =========================================
   09. PLAYER NAME FORMATTING
   ========================================= */

playerNameInput.addEventListener("input", () => {

    playerNameInput.value =
        playerNameInput.value.slice(0, 18);

});


/* =========================================
   10. CAROUSEL HELPERS
   ========================================= */

function getCardPosition(index) {

    const card = gameCards[index];

    if (!card) return;

    const carouselRect =
        gameCarousel.getBoundingClientRect();

    const cardRect =
        card.getBoundingClientRect();

    const currentScroll =
        gameCarousel.scrollLeft;

    const cardOffset =
        cardRect.left -
        carouselRect.left +
        currentScroll;

    return cardOffset -
        (gameCarousel.clientWidth - card.offsetWidth) / 2;

}


/* =========================================
   11. UPDATE CAROUSEL INDICATOR
   ========================================= */

function updateCarouselIndicator() {

    const progressItems =
        carouselProgress.querySelectorAll("span");

    progressItems.forEach((item, index) => {

        item.classList.toggle(
            "progress-active",
            index === currentCardIndex
        );

    });

}


/* =========================================
   12. MOVE TO GAME CARD
   ========================================= */

function moveToGame(index) {

    if (index < 0 || index >= gameCards.length) {
        return;
    }

    currentCardIndex = index;

    const position = getCardPosition(index);

    if (position === undefined) return;

    gameCarousel.scrollTo({

        left: position,

        behavior: "smooth"

    });

    updateCarouselIndicator();

}


/* =========================================
   13. PREVIOUS GAME
   ========================================= */

previousGame.addEventListener("click", () => {

    let nextIndex = currentCardIndex - 1;

    if (nextIndex < 0) {
        nextIndex = gameCards.length - 1;
    }

    moveToGame(nextIndex);

});


/* =========================================
   14. NEXT GAME
   ========================================= */

nextGame.addEventListener("click", () => {

    let nextIndex = currentCardIndex + 1;

    if (nextIndex >= gameCards.length) {
        nextIndex = 0;
    }

    moveToGame(nextIndex);

});


/* =========================================
   15. DETECT MANUAL SWIPING
   ========================================= */

let scrollTimer = null;

gameCarousel.addEventListener("scroll", () => {

    clearTimeout(scrollTimer);

    scrollTimer = setTimeout(() => {

        const carouselCenter =
            gameCarousel.getBoundingClientRect().left +
            gameCarousel.clientWidth / 2;

        let closestIndex = 0;

        let smallestDistance = Infinity;

        gameCards.forEach((card, index) => {

            const cardCenter =
                card.getBoundingClientRect().left +
                card.offsetWidth / 2;

            const distance = Math.abs(
                carouselCenter - cardCenter
            );

            if (distance < smallestDistance) {

                smallestDistance = distance;

                closestIndex = index;

            }

        });

        currentCardIndex = closestIndex;

        updateCarouselIndicator();

    }, 100);

});


/* =========================================
   16. INITIAL CAROUSEL STATE
   ========================================= */

updateCarouselIndicator();


/* =========================================
   17. SELECT A GAME
   ========================================= */

function selectGame(game) {

    if (game !== "truth" && game !== "wheel") {
        return;
    }

    selectedGame = game;

    gameCards.forEach(card => {

        card.classList.remove("selected-card");

        if (card.dataset.game === game) {

            card.classList.add("selected-card");

        }

    });

    roomSection.scrollIntoView({

        behavior: "smooth",

        block: "center"

    });

}


/* =========================================
   18. GAME BUTTON EVENTS
   ========================================= */

gameButtons.forEach(button => {

    button.addEventListener("click", () => {

        const game = button.dataset.selectGame;

        selectGame(game);

    });

});


/* =========================================
   19. NOTIFICATION SYSTEM
   ========================================= */

let notificationTimer = null;

let notificationElement = null;


function createNotification() {

    if (notificationElement) return;

    notificationElement = document.createElement("div");

    notificationElement.className = "duova-notification";

    notificationElement.setAttribute("role", "status");

    notificationElement.setAttribute("aria-live", "polite");

    document.body.appendChild(notificationElement);

}


function showMessage(message, type = "info") {

    createNotification();

    clearTimeout(notificationTimer);

    notificationElement.className =
        "duova-notification notification-" + type;

    notificationElement.innerHTML = `
        <span class="notification-indicator"></span>
        <span class="notification-message"></span>
    `;

    notificationElement.querySelector(
        ".notification-message"
    ).textContent = message;

    requestAnimationFrame(() => {

        notificationElement.classList.add(
            "notification-visible"
        );

    });

    notificationTimer = setTimeout(() => {

        notificationElement.classList.remove(
            "notification-visible"
        );

    }, 3200);

}


/* =========================================
   20. SELECTED GAME VISUAL EFFECT
   ========================================= */

function updateSelectedGameVisual(game) {

    gameCards.forEach(card => {

        const isSelected =
            card.dataset.game === game;

        card.classList.toggle(
            "selected-card",
            isSelected
        );

        card.classList.toggle(
            "unselected-card",
            !isSelected
        );

    });

}


const originalSelectGame = selectGame;

selectGame = function(game) {

    if (game !== "truth" && game !== "wheel") {
        return;
    }

    originalSelectGame(game);

    updateSelectedGameVisual(game);

    showMessage(
        game === "truth"
            ? "Truth or Dare selected."
            : "Wheel Spin selected.",
        "success"
    );

};


/* =========================================
   21. CARD POINTER EFFECT
   ========================================= */

const supportsHover =
    window.matchMedia(
        "(hover: hover) and (pointer: fine)"
    ).matches;


if (supportsHover) {

    gameCards.forEach(card => {

        card.addEventListener("pointermove", event => {

            const rect = card.getBoundingClientRect();

            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateY =
                ((x - centerX) / centerX) * 2;

            const rotateX =
                ((centerY - y) / centerY) * 2;

            card.style.setProperty(
                "--pointer-x",
                `${x}px`
            );

            card.style.setProperty(
                "--pointer-y",
                `${y}px`
            );

            card.style.setProperty(
                "--rotate-x",
                `${rotateX}deg`
            );

            card.style.setProperty(
                "--rotate-y",
                `${rotateY}deg`
            );

        });

        card.addEventListener("pointerleave", () => {

            card.style.setProperty("--rotate-x", "0deg");
            card.style.setProperty("--rotate-y", "0deg");

        });

    });

}


/* =========================================
   22. BUTTON PRESS FEEDBACK
   ========================================= */

const interactiveButtons = document.querySelectorAll(
    ".play-button, " +
    ".create-room-button, " +
    ".join-room-button, " +
    ".carousel-arrow, " +
    ".profile-button"
);


interactiveButtons.forEach(button => {

    button.addEventListener("pointerdown", () => {

        button.classList.add("button-pressed");

    });

    const releaseButton = () => {

        button.classList.remove("button-pressed");

    };

    button.addEventListener("pointerup", releaseButton);
    button.addEventListener("pointerleave", releaseButton);
    button.addEventListener("pointercancel", releaseButton);

});


/* =========================================
   23. WHEEL VISUAL MOVEMENT
   ========================================= */

const wheelFace =
    document.querySelector(".wheel-face");


if (wheelFace) {

    wheelFace.addEventListener("pointerenter", () => {

        if (!supportsHover) return;

        wheelFace.classList.add("wheel-hover");

    });

    wheelFace.addEventListener("pointerleave", () => {

        wheelFace.classList.remove("wheel-hover");

    });

}


/* =========================================
   24. INTRODUCTION ENTRANCE
   ========================================= */

function revealIntroduction() {

    const introElements = [

        document.querySelector(".intro-label"),
        document.querySelector(".intro h1"),
        document.querySelector(".intro p"),
        document.querySelector(".intro-decoration")

    ];

    introElements.forEach((element, index) => {

        if (!element) return;

        element.classList.add("intro-reveal");

        element.style.setProperty(
            "--reveal-delay",
            `${index * 120}ms`
        );

    });

}


revealIntroduction();


/* =========================================
   25. GAME CARD ENTRANCE
   ========================================= */

function revealGameCards() {

    gameCards.forEach((card, index) => {

        card.classList.add("card-reveal");

        card.style.setProperty(
            "--card-delay",
            `${index * 150}ms`
        );

    });

}


revealGameCards();


/* =========================================
   26. ROOM PANEL ENTRANCE
   ========================================= */

const roomPanel =
    document.querySelector(".room-panel");


if (roomPanel) {

    roomPanel.classList.add("room-panel-ready");

}


/* =========================================
   27. KEYBOARD CAROUSEL CONTROL
   ========================================= */

document.addEventListener("keydown", event => {

    const activeElement = document.activeElement;

    const typing =
        activeElement &&
        (
            activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable
        );

    if (typing) return;

    if (event.key === "ArrowRight") {

        event.preventDefault();

        moveToGame(
            Math.min(
                currentCardIndex + 1,
                gameCards.length - 1
            )
        );

    }

    if (event.key === "ArrowLeft") {

        event.preventDefault();

        moveToGame(
            Math.max(
                currentCardIndex - 1,
                0
            )
        );

    }

});


/* =========================================
   28. WINDOW RESIZE HANDLING
   ========================================= */

let resizeTimer = null;


window.addEventListener("resize", () => {

    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {

        moveToGame(currentCardIndex);

    }, 180);

});


/* =========================================
   29. INITIAL PAGE READY
   ========================================= */

window.addEventListener("load", () => {

    document.body.classList.add("page-ready");

});


/* =========================================
   DUOVA APPLICATION — END
   ========================================= */
