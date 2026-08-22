"use strict";


/* =========================================================
   NEXAUREN — IMAGE CATEGORY ENGINE
   ========================================================= */


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkSession();

    }
);


/* =========================================================
   SESSION
   ========================================================= */

async function checkSession() {

    const grid =
        document.getElementById(
            "tools-grid"
        );


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
         * No session = no services.
         */

        if (
            !data.success ||
            !data.authenticated ||
            !data.user
        ) {

            window.location.href =
                "/login";

            return;

        }


        /*
         * Session valid.
         * Now load tools.
         */

        document.body.classList.add(
            "page-ready"
        );


        await loadTools();


    } catch (error) {

        console.error(
            "Image category session error:",
            error
        );


        window.location.href =
            "/login";

    }

}


/* =========================================================
   LOAD TOOLS
   ========================================================= */

async function loadTools() {

    const grid =
        document.getElementById(
            "tools-grid"
        );


    if (!grid) {
        return;
    }


    try {

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
                `HTTP ${response.status}`
            );

        }


        const registry =
            await response.json();


        const tools =
            Array.isArray(registry.tools)
                ? registry.tools
                : [];


        /*
         * Only active IMAGE tools.
         */

        const imageTools =
            tools.filter(
                tool =>
                    tool.category === "image" &&
                    tool.status === "active"
            );


        renderTools(
            imageTools
        );


    } catch (error) {

        console.error(
            "Tool registry error:",
            error
        );


        grid.innerHTML = `

            <div
                class="card"
                style="text-align:center;"
            >

                <h3>
                    Unable to load tools
                </h3>

                <p>
                    Nexauren could not load
                    the image tool registry.
                </p>

            </div>

        `;

    }

}


/* =========================================================
   RENDER TOOLS
   ========================================================= */

function renderTools(tools) {

    const grid =
        document.getElementById(
            "tools-grid"
        );


    if (!grid) {
        return;
    }


    grid.innerHTML = "";


    /*
     * No tools.
     */

    if (!tools.length) {

        grid.innerHTML = `

            <div
                class="card"
                style="text-align:center;"
            >

                <h3>
                    No tools yet
                </h3>

                <p>
                    Nexauren image tools
                    will appear here.
                </p>

            </div>

        `;

        return;

    }


    /*
     * Create cards.
     */

    tools.forEach(
        (tool, index) => {

            const card =
                document.createElement(
                    "a"
                );


            card.className =
                "card tool-card reveal";


            card.href =
                tool.path;


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
                        "Nexauren image tool."
                    )}
                </p>


                <span
                    class="category-open"
                >
                    Open tool
                    <span>→</span>
                </span>

            `;


            grid.appendChild(
                card
            );

        }
    );


    /*
     * Activate reveal animation.
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


    /*
     * Futuristic page transition.
     */

    setupToolNavigation();

}


/* =========================================================
   TOOL NAVIGATION
   ========================================================= */

function setupToolNavigation() {

    const links =
        document.querySelectorAll(
            "#tools-grid a.tool-card"
        );


    links.forEach(
        link => {

            link.addEventListener(
                "click",
                event => {

                    /*
                     * Don't interfere with
                     * Ctrl / Cmd / middle click.
                     */

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


                    const destination =
                        link.href;


                    const transition =
                        document.querySelector(
                            ".page-transition"
                        );


                    if (!transition) {

                        window.location.href =
                            destination;

                        return;

                    }


                    transition.classList.add(
                        "active"
                    );


                    setTimeout(
                        () => {

                            window.location.href =
                                destination;

                        },
                        350
                    );

                }
            );

        }
    );

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
