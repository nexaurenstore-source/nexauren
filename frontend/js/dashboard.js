"use strict";


/* =========================================================
   NEXAUREN DASHBOARD
   ========================================================= */


/* =========================================================
   DOM
   ========================================================= */

const categoriesGrid =
    document.getElementById(
        "categories-grid"
    );


const accountStatus =
    document.getElementById(
        "account-status"
    );


const logoutButton =
    document.getElementById(
        "logout-button"
    );


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeDashboard
);


/* =========================================================
   DASHBOARD
   ========================================================= */

async function initializeDashboard() {

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );


        const data =
            await response.json();


        /*
         * No active session.
         */

        if (
            !response.ok ||
            !data.success ||
            !data.user
        ) {

            window.location.href =
                "/login";

            return;

        }


        /*
         * Active session.
         */

        updateAccountStatus(
            data.user
        );


        loadCategories();


    } catch (error) {

        console.error(
            "Dashboard session error:",
            error
        );


        window.location.href =
            "/login";

    }

}


/* =========================================================
   ACCOUNT STATUS
   ========================================================= */

function updateAccountStatus(
    user
) {

    if (!accountStatus) {
        return;
    }


    const name =
        user.name ||
        user.email ||
        "Account";


    accountStatus.textContent =
        `Signed in as ${name}`;

}


/* =========================================================
   LOAD CATEGORIES
   ========================================================= */

async function loadCategories() {

    if (!categoriesGrid) {
        return;
    }


    categoriesGrid.innerHTML = "";


    try {

        const response =
            await fetch(
                "/data/categories.json",
                {
                    method: "GET",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                "Unable to load categories."
            );

        }


        const categories =
            await response.json();


        if (
            !Array.isArray(categories) ||
            categories.length === 0
        ) {

            showEmptyCategories();

            return;

        }


        categories.forEach(
            category => {

                const card =
                    createCategoryCard(
                        category
                    );


                categoriesGrid.appendChild(
                    card
                );

            }
        );


    } catch (error) {

        console.error(
            "Category loading error:",
            error
        );


        showCategoryError();

    }

}


/* =========================================================
   CREATE CATEGORY CARD
   ========================================================= */

function createCategoryCard(
    category
) {

    const card =
        document.createElement(
            "a"
        );


    card.className =
        "card category-card";


    card.href =
        category.url ||
        `/categories/${category.id}/`;


    const icon =
        document.createElement(
            "div"
        );


    icon.className =
        "category-icon";


    icon.textContent =
        category.icon ||
        "•";


    const title =
        document.createElement(
            "h3"
        );


    title.textContent =
        category.name ||
        category.id;


    const description =
        document.createElement(
            "p"
        );


    description.textContent =
        category.description ||
        "Explore tools in this category.";


    card.appendChild(
        icon
    );


    card.appendChild(
        title
    );


    card.appendChild(
        description
    );


    return card;

}


/* =========================================================
   EMPTY STATE
   ========================================================= */

function showEmptyCategories() {

    categoriesGrid.innerHTML = `

        <div
            class="card"
            style="text-align:center;"
        >

            <h3>
                No categories available
            </h3>

            <p>
                Nexauren does not have any
                available categories yet.
            </p>

        </div>

    `;

}


/* =========================================================
   ERROR STATE
   ========================================================= */

function showCategoryError() {

    categoriesGrid.innerHTML = `

        <div
            class="card"
            style="text-align:center;"
        >

            <h3>
                Unable to load categories
            </h3>

            <p>
                Please refresh the page
                and try again.
            </p>

        </div>

    `;

}


/* =========================================================
   LOGOUT
   ========================================================= */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        logout
    );

}


async function logout() {

    if (logoutButton) {

        logoutButton.disabled =
            true;

        logoutButton.textContent =
            "Signing out...";

    }


    try {

        await fetch(
            "/api/logout",
            {
                method: "POST",
                credentials: "include"
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
