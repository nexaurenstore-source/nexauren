"use strict";

/*
 * NEXAUREN — CATEGORY ENGINE V1
 *
 * Loads tools from the central registry:
 *
 * /data/tools.json
 *
 * The current category is detected
 * from the URL.
 */

document.addEventListener("DOMContentLoaded", () => {
    loadCategoryTools();
});


async function loadCategoryTools() {

    const grid = document.getElementById("tools-grid");

    if (!grid) {
        return;
    }

    try {

        /*
         * Show loading state.
         */

        grid.innerHTML = `
            <div class="card" style="text-align:center;">
                <div class="icon">⚡</div>

                <h3>
                    Loading tools...
                </h3>

                <p>
                    Nexauren is loading the available tools.
                </p>
            </div>
        `;


        /*
         * Detect category from URL.
         *
         * Example:
         *
         * /categories/image/
         *
         * becomes:
         *
         * image
         */

        const category =
            getCurrentCategory();


        if (!category) {

            showError(
                grid,
                "Category could not be detected."
            );

            return;
        }


        /*
         * Load central registry.
         */

        const response =
            await fetch(
                "/data/tools.json",
                {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                `tools.json returned ${response.status}`
            );

        }


        const registry =
            await response.json();


        if (
            !registry ||
            !Array.isArray(registry.tools)
        ) {

            throw new Error(
                "Invalid tools.json format."
            );

        }


        /*
         * Only show tools belonging
         * to the current category.
         */

        const tools =
            registry.tools.filter(
                tool =>
                    tool.category === category &&
                    tool.status !== "hidden"
            );


        /*
         * No tools.
         */

        if (!tools.length) {

            grid.innerHTML = `
                <div
                    class="card"
                    style="text-align:center;"
                >

                    <div class="icon">
                        ${getCategoryIcon(category)}
                    </div>

                    <h3>
                        No tools yet
                    </h3>

                    <p>
                        New Nexauren tools
                        will appear here automatically.
                    </p>

                </div>
            `;

            return;
        }


        /*
         * Render tools.
         */

        grid.innerHTML = "";


        tools.forEach(
            (tool, index) => {

                const card =
                    document.createElement("a");

                card.href =
                    tool.path;

                card.className =
                    "card category-tool-card reveal";

                card.style.animationDelay =
                    `${index * 70}ms`;


                const technology =
                    Array.isArray(tool.technology)
                        ? tool.technology.join(" · ")
                        : "";


                card.innerHTML = `

                    <div class="icon">
                        ${escapeHtml(
                            tool.icon || "⚡"
                        )}
                    </div>

                    <h3>
                        ${escapeHtml(
                            tool.name
                        )}
                    </h3>

                    <p>
                        ${escapeHtml(
                            tool.description || ""
                        )}
                    </p>

                    ${
                        technology
                            ? `
                                <small>
                                    ${escapeHtml(
                                        technology
                                    )}
                                </small>
                              `
                            : ""
                    }

                    <span class="category-open">
                        Open tool
                        <span>→</span>
                    </span>

                `;


                grid.appendChild(card);

            }
        );


        /*
         * Activate reveal animation.
         */

        requestAnimationFrame(() => {

            grid
                .querySelectorAll(".reveal")
                .forEach(element => {

                    element.classList.add(
                        "visible"
                    );

                });

        });


    } catch (error) {

        console.error(
            "Nexauren category error:",
            error
        );


        showError(
            grid,
            "The Nexauren tool registry could not be loaded."
        );

    }

}


/*
 * Get current category.
 */

function getCurrentCategory() {

    const path =
        window.location.pathname;


    const match =
        path.match(
            /\/categories\/([^/]+)/
        );


    if (!match) {
        return null;
    }


    return decodeURIComponent(
        match[1]
    ).toLowerCase();

}


/*
 * Category icons.
 */

function getCategoryIcon(category) {

    const icons = {

        audio: "♪",
        image: "◈",
        text: "T",
        pdf: "PDF"

    };


    return icons[category] || "⚡";

}


/*
 * Error state.
 */

function showError(grid, message) {

    grid.innerHTML = `

        <div
            class="card"
            style="text-align:center;"
        >

            <div class="icon">
                ⚠
            </div>

            <h3>
                Unable to load tools
            </h3>

            <p>
                ${escapeHtml(message)}
            </p>

        </div>

    `;

}


/*
 * Prevent HTML injection
 * from registry data.
 */

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

           }
