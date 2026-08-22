"use strict";

/* =========================================================
   NEXAUREN — CATEGORY ENGINE V1
   Sistema automático de categorias e ferramentas
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const authenticated =
            await checkSession();

        if (!authenticated) {
            return;
        }

        await loadCategoryTools();

    }
);


/* =========================================================
   SESSION
   ========================================================= */

async function checkSession() {

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


        /*
         * Sem sessão = sem serviços.
         */

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
   DETECT CATEGORY
   ========================================================= */

function getCurrentCategory() {

    const path =
        window.location.pathname
            .toLowerCase();


    if (
        path.includes("/categories/audio")
    ) {
        return "audio";
    }


    if (
        path.includes("/categories/image")
    ) {
        return "image";
    }


    if (
        path.includes("/categories/text")
    ) {
        return "text";
    }


    if (
        path.includes("/categories/pdf")
    ) {
        return "pdf";
    }


    return null;

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

        showMessage(
            grid,
            "Category not found",
            "This Nexauren category does not exist."
        );

        return;

    }


    try {

        /*
         * IMPORTANT:
         * tools.json fica em:
         *
         * frontend/tools/tools.json
         */

        const response =
            await fetch(
                "/tools/tools.json",
                {
                    method: "GET",
                    cache: "no-cache",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                `Unable to load tools.json: HTTP ${response.status}`
            );

        }


        const registry =
            await response.json();


        const tools =
            Array.isArray(
                registry.tools
            )
                ? registry.tools
                : [];


        /*
         * Filtra somente:
         *
         * 1. categoria atual
         * 2. ferramenta ativa
         */

        const categoryTools =
            tools.filter(
                tool =>
                    tool.category === category &&
                    tool.status === "active"
            );


        renderTools(
            grid,
            categoryTools
        );


    } catch (error) {

        console.error(
            "Category tools error:",
            error
        );


        showMessage(
            grid,
            "Unable to load tools",
            "Nexauren could not load the tool registry."
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


    /*
     * Nenhuma ferramenta registrada.
     */

    if (!tools.length) {

        showMessage(
            grid,
            "No tools yet",
            "Nexauren tools will appear here automatically."
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
                "card tool-card reveal";


            card.style.animationDelay =
                `${index * 70}ms`;


            card.innerHTML = `

                <div class="icon">
                    ${escapeHtml(
                        tool.icon || "◈"
                    )}
                </div>

                <h3>
                    ${escapeHtml(
                        tool.name
                    )}
                </h3>

                <p>
                    ${escapeHtml(
                        tool.description ||
                        "Nexauren tool."
                    )}
                </p>

                <span class="category-open">

                    Open tool

                    <span>
                        →
                    </span>

                </span>

            `;


            grid.appendChild(
                card
            );

        }
    );


    /*
     * Ativa animações.
     */

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


    setupToolNavigation();

}


/* =========================================================
   TOOL NAVIGATION
   ========================================================= */

function setupToolNavigation() {

    const links =
        document.querySelectorAll(
            "#tools-grid .tool-card"
        );


    links.forEach(
        link => {

            link.addEventListener(
                "click",
                event => {

                    if (
                        event.ctrlKey ||
                        event.metaKey ||
                        event.shiftKey ||
                        event.altKey ||
                        event.button !== 0
                    ) {
                        return;
                    }


                    event.preventDefault();


                    const transition =
                        document.querySelector(
                            ".page-transition"
                        );


                    if (!transition) {

                        window.location.href =
                            link.href;

                        return;

                    }


                    transition.classList.add(
                        "active"
                    );


                    setTimeout(
                        () => {

                            window.location.href =
                                link.href;

                        },
                        350
                    );

                }
            );

        }
    );

}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(
    grid,
    title,
    description
) {

    grid.innerHTML = `

        <div
            class="card"
            style="text-align:center;"
        >

            <h3>
                ${escapeHtml(title)}
            </h3>

            <p>
                ${escapeHtml(description)}
            </p>

        </div>

    `;

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

    }
