/* =========================================================
   NEXAUREN — DASHBOARD ENGINE V1
   ========================================================= */

"use strict";


/* =========================================================
   CATEGORY REGISTRY
   ========================================================= */

const categories = [

    {
        id: "audio",
        name: "Audio",
        description:
            "Tools for working with sound and audio.",
        icon: "♪",
        path: "/categories/audio/"
    },

    {
        id: "image",
        name: "Images",
        description:
            "Tools for editing and working with images.",
        icon: "◈",
        path: "/categories/image/"
    },

    {
        id: "video",
        name: "Video",
        description:
            "Tools for working with video content.",
        icon: "▶",
        path: "/categories/video/"
    },

    {
        id: "files",
        name: "Files",
        description:
            "Tools for managing and processing files.",
        icon: "↗",
        path: "/categories/files/"
    }

];


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await checkSession();

        renderCategories();

        setupLogout();

    }
);


/* =========================================================
   SESSION
   ========================================================= */

async function checkSession() {

    const status =
        document.getElementById(
            "account-status"
        );


    if (!status) {
        return false;
    }


    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",
                    credentials: "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        const data =
            await response.json();


        if (
            !data.success ||
            !data.authenticated ||
            !data.user
        ) {

            /*
             * Dashboard só deve ser
             * acessível com sessão.
             */

            window.location.href =
                "/login";

            return false;

        }


        status.textContent =
            `Welcome back, ${data.user.name}.`;

        return true;


    } catch (error) {

        console.error(
            "Dashboard session error:",
            error
        );


        window.location.href =
            "/login";

        return false;

    }

}


/* =========================================================
   RENDER CATEGORIES
   ========================================================= */

function renderCategories() {

    const grid =
        document.getElementById(
            "categories-grid"
        );


    if (!grid) {
        return;
    }


    grid.innerHTML = "";


    categories.forEach(
        (category, index) => {

            const card =
                document.createElement(
                    "a"
                );


            card.href =
                category.path;


            card.className =
                "category-card reveal";


            card.style.animationDelay =
                `${index * 70}ms`;


            card.innerHTML = `

                <div class="category-icon">
                    ${escapeHtml(category.icon)}
                </div>

                <h3>
                    ${escapeHtml(category.name)}
                </h3>

                <p>
                    ${escapeHtml(category.description)}
                </p>

                <span class="category-open">
                    Explore
                    <span>→</span>
                </span>

            `;


            grid.appendChild(
                card
            );

        }
    );


    /*
     * Ativar animações depois
     * de criar os elementos.
     */

    requestAnimationFrame(
        () => {

            document
                .querySelectorAll(
                    ".category-card.reveal"
                )
                .forEach(
                    element => {

                        element.classList.add(
                            "visible"
                        );

                    }
                );

        }
    );

}


/* =========================================================
   LOGOUT
   ========================================================= */

function setupLogout() {

    const button =
        document.getElementById(
            "logout-button"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            button.disabled = true;

            button.textContent =
                "Signing out...";


            try {

                await fetch(
                    "/api/logout",
                    {
                        method: "POST",
                        credentials: "include",

                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );


            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            }


            window.location.href =
                "/";

        }
    );

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

        }
