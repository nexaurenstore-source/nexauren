/*
 * =========================================================
 * NEXAUREN
 * DASHBOARD
 * =========================================================
 */

"use strict";


const title =
    document.getElementById(
        "dashboard-title"
    );

const email =
    document.getElementById(
        "dashboard-email"
    );

const message =
    document.getElementById(
        "dashboard-message"
    );

const logoutButton =
    document.getElementById(
        "logout-button"
    );

const logoutButtonMain =
    document.getElementById(
        "logout-button-main"
    );


function showMessage(
    text,
    type = "error"
) {

    if (!message) {
        return;
    }

    message.textContent =
        text;

    message.className =
        `auth-message ${type}`;

}


function setLogoutLoading(
    loading
) {

    if (logoutButton) {

        logoutButton.disabled =
            loading;

    }

    if (logoutButtonMain) {

        logoutButtonMain.disabled =
            loading;

        logoutButtonMain.textContent =
            loading
                ? "Signing out..."
                : "Sign out";

    }

}


/* =========================================================
   LOAD USER
   ========================================================= */

async function loadCurrentUser() {

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",

                    credentials:
                        "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        let result;

        try {

            result =
                await response.json();

        } catch {

            result = {
                success: false
            };

        }


        if (
            !response.ok ||
            !result.success ||
            !result.authenticated
        ) {

            window.location.href =
                "pages/login.html";

            return;

        }


        const user =
            result.user;


        if (title) {

            title.textContent =
                `Welcome, ${user.name}`;

        }


        if (email) {

            email.textContent =
                user.email;

        }


    } catch (error) {

        console.error(
            "Dashboard authentication error:",
            error
        );

        showMessage(
            "Unable to verify your account.",
            "error"
        );

    }

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    setLogoutLoading(true);


    try {

        const response =
            await fetch(
                "/api/logout",
                {
                    method: "POST",

                    credentials:
                        "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        let result;

        try {

            result =
                await response.json();

        } catch {

            result = {
                success: false
            };

        }


        if (
            !response.ok ||
            !result.success
        ) {

            showMessage(
                result.message ||
                "Unable to sign out.",
                "error"
            );

            return;

        }


        window.location.href =
            "pages/login.html";


    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        showMessage(
            "Unable to connect to Nexauren.",
            "error"
        );

    } finally {

        setLogoutLoading(false);

    }

}


/* =========================================================
   EVENTS
   ========================================================= */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        logout
    );

}


if (logoutButtonMain) {

    logoutButtonMain.addEventListener(
        "click",
        logout
    );

}


/* =========================================================
   START
   ========================================================= */

loadCurrentUser();
