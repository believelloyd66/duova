
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
    getDatabase
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";


const firebaseConfig = {
    apiKey: "AIzaSyAeZNkoccQqJRFX5yhE0UPgwbqn5JUbZgc",
    authDomain: "duova-2ce87.firebaseapp.com",
    databaseURL: "https://duova-2ce87-default-rtdb.firebaseio.com/",
    projectId: "duova-2ce87",
    storageBucket: "duova-2ce87.firebasestorage.app",
    messagingSenderId: "972013139910",
    appId: "1:972013139910:web:ba5b5fe00845cbbb5f24c7"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);
