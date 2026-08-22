/* =========================================================
   NEXAUREN — CATEGORY ENGINE V1
   ========================================================= */

"use strict";


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const authenticated =
            await checkCategorySession();

        if (!authenticated) {
            return;
        }

        await loadCategoryTools();

    }
);


/* =========================================================
   SESSION
   ========================================================= */

async function checkCategorySession() {

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

            window.location.href =
                "/login";

            return false;

        }


        document.body.classList.add(
            "page-ready"
        );


        return true;


    } catch (error) {

        console.error(
            "Category session error:",
            error
        );


        window.location.href =
            "/login";

        return false;

    }

}


/* =========================================================
   GET CURRENT CATEGORY
   ========================================================= */

function getCurrentCategory() {

    const path =
        window.location.pathname;


    const parts =
        path
            .split("/")
            .filter(Boolean);


    /*
     * Esperamos:
     *
     * /categories/audio/
     *
     * parts:
     *
     * ["categories", "audio"]
     */

    if (
        parts.length < 2 ||
        parts[0] !== "categories"
    ) {

        return null;

    }


    return parts[1].toLowerCase();

}


/* =========================================================
   LOAD TOOLS
   ========================================================= */

async function loadCategoryTools() {

    const grid =
        document.getElementById(
            "tools-grid"
        );


    if (!grid) {
        return;
    }


    const category =
        getCurrentCategory();


    if (!category) {

        showEmptyState(
            grid,
            "Invalid category."
        );

        return;

    }


    try {

        const response =
            await fetch(
                "/data/tools.json",
                {
                    method: "GET",
                    cache: "no-cache"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        const tools =
            Array.isArray(data.tools)
                ? data.tools
                : [];


        const categoryTools =
            tools.filter(
                tool =>
                    tool &&
                    tool.category === category &&
                    tool.status === "published"
            );


        renderTools(
            grid,
            categoryTools
        );


    } catch (error) {

        console.error(
            "Tool registry error:",
            error
        );


        showEmptyState(
            grid,
            "Unable to load tools."
        );

    }

}


/* =========================================================
   RENDER TOOLS
   ========================================================= */

function renderTools(
    grid,
    tools
) {

    grid.innerHTML = "";


    if (tools.length === 0) {

        showEmptyState(
            grid,
            "No tools available yet."
        );

        return;

    }


    tools.forEach(
        (tool, index) => {

            const card =
                document.createElement(
                    "a"
                );


            card.href =
                tool.path;


            card.className =
                "category-card reveal";


            card.style.animationDelay =
                `${index * 70}ms`;


            card.innerHTML = `

                <div class="category-icon">
                    ${escapeHtml(
                        getToolIcon(tool)
                    )}
                </div>

                <h3>
                    ${escapeHtml(
                        tool.name
                    )}
                </h3>

                <p>
                    ${escapeHtml(
                        tool.description
                    )}
                </p>

                <span class="category-open">
                    Open
                    <span>→</span>
                </span>

            `;


            grid.appendChild(
                card
            );

        }
    );


    requestAnimationFrame(
        () => {

            grid
                .querySelectorAll(
                    ".reveal"
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
   EMPTY STATE
   ========================================================= */

function showEmptyState(
    grid,
    message
) {

    grid.innerHTML = `

        <div
            class="card"
            style="text-align:center;"
        >

            <div class="icon">
                ✦
            </div>

            <h3>
                Coming Soon
            </h3>

            <p>
                ${escapeHtml(message)}
            </p>

        </div>

    `;

}


/* =========================================================
   TOOL ICON
   ========================================================= */

function getToolIcon(tool) {

    if (tool.icon) {
        return tool.icon;
    }


    switch (tool.category) {

        case "audio":
            return "♪";

        case "image":
            return "◈";

        case "text":
            return "T";

        case "pdf":
            return "PDF";

        default:
            return "✦";

    }

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    }
