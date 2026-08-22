/* =========================================================
   NEXAUREN — FUTURISTIC NAVIGATION V2
   Transitions + Session Check + Loading + Page Enter
   ========================================================= */

"use strict";


/* =========================================================
   PAGE LOAD
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    document.body.classList.add("page-ready");

    setupPageTransition();

    setupRevealAnimations();

});


/* =========================================================
   PAGE TRANSITION ELEMENT
   ========================================================= */

function createTransitionElement() {

    let transition =
        document.querySelector(".page-transition");

    if (transition) {
        return transition;
    }

    transition =
        document.createElement("div");

    transition.className =
        "page-transition";

    transition.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.appendChild(
        transition
    );

    return transition;
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupPageTransition() {

    const transition =
        createTransitionElement();


    document.addEventListener(
        "click",
        event => {

            const link =
                event.target.closest("a");

            if (!link) {
                return;
            }


            /*
             * Ignorar cliques especiais.
             */

            if (
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }


            /*
             * Ignorar target="_blank".
             */

            if (
                link.target === "_blank"
            ) {
                return;
            }


            const href =
                link.getAttribute("href");


            if (
                !href ||
                href === "#" ||
                href.startsWith("#") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                href.startsWith("javascript:")
            ) {
                return;
            }


            /*
             * Converter destino para URL.
             */

            let destination;

            try {

                destination =
                    new URL(
                        href,
                        window.location.href
                    );

            } catch {

                return;

            }


            /*
             * Ignorar links externos.
             */

            if (
                destination.origin !==
                window.location.origin
            ) {
                return;
            }


            /*
             * Ignorar downloads.
             */

            if (
                link.hasAttribute("download")
            ) {
                return;
            }


            /*
             * Não repetir página atual.
             */

            if (
                destination.href ===
                window.location.href
            ) {
                return;
            }


            /*
             * Interceptar navegação.
             */

            event.preventDefault();


            navigateWithTransition(
                destination.href,
                transition
            );

        }
    );

}


/* =========================================================
   NAVIGATION WITH TRANSITION
   ========================================================= */

async function navigateWithTransition(
    url,
    transition
) {

    if (
        transition.classList.contains(
            "active"
        )
    ) {
        return;
    }


    /*
     * Mostrar processamento.
     */

    transition.classList.add(
        "active"
    );


    /*
     * Pequeno atraso para a animação
     * aparecer corretamente.
     */

    await wait(420);


    /*
     * Navegar.
     */

    window.location.href =
        url;

}


/* =========================================================
   WAIT
   ========================================================= */

function wait(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


/* =========================================================
   REVEAL ANIMATIONS
   ========================================================= */

function setupRevealAnimations() {

    const elements =
        document.querySelectorAll(
            ".reveal"
        );


    if (!elements.length) {
        return;
    }


    /*
     * IntersectionObserver
     */

    const observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        if (
                            entry.isIntersecting
                        ) {

                            entry.target
                                .classList
                                .add(
                                    "visible"
                                );


                            observer.unobserve(
                                entry.target
                            );

                        }

                    }
                );

            },
            {
                threshold: 0.12
            }
        );


    elements.forEach(
        element => {

            observer.observe(
                element
            );

        }
    );

}


/* =========================================================
   BUTTON LOADING
   ========================================================= */

function setButtonLoading(
    button,
    loading = true
) {

    if (!button) {
        return;
    }


    if (loading) {

        if (
            !button.dataset.originalText
        ) {

            button.dataset.originalText =
                button.innerHTML;

        }


        button.disabled = true;


        button.classList.add(
            "loading"
        );


        button.innerHTML =
            "Processing...";


    } else {

        button.disabled = false;


        button.classList.remove(
            "loading"
        );


        if (
            button.dataset.originalText
        ) {

            button.innerHTML =
                button.dataset.originalText;

        }

    }

}


/* =========================================================
   FORM PROCESSING
   ========================================================= */

document.addEventListener(
    "submit",
    event => {

        const form =
            event.target;


        if (
            !(form instanceof HTMLFormElement)
        ) {
            return;
        }


        const submitButton =
            form.querySelector(
                'button[type="submit"], input[type="submit"]'
            );


        if (!submitButton) {
            return;
        }


        submitButton.classList.add(
            "loading"
        );


        submitButton.disabled =
            true;


        if (
            submitButton.tagName ===
            "BUTTON"
        ) {

            if (
                !submitButton.dataset
                    .originalText
            ) {

                submitButton.dataset
                    .originalText =
                        submitButton.innerHTML;

            }


            submitButton.innerHTML =
                "Processing...";

        }

    }
);


/* =========================================================
   PAGE SHOW
   ========================================================= */

window.addEventListener(
    "pageshow",
    () => {

        const transition =
            document.querySelector(
                ".page-transition"
            );


        if (transition) {

            transition.classList.remove(
                "active"
            );

        }


        document.body.classList.add(
            "page-ready"
        );

    }
);


/* =========================================================
   GLOBAL NEXAUREN UI
   ========================================================= */

window.NexaurenUI = {

    navigate(url) {

        const transition =
            createTransitionElement();


        navigateWithTransition(
            url,
            transition
        );

    },


    loading(button, state) {

        setButtonLoading(
            button,
            state
        );

    }

};
