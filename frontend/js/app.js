/* =========================================================
   NEXAUREN — FUTURISTIC NAVIGATION V1
   Transições + Loading + Page Enter
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


    /*
     * Todos os links internos.
     */

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
             * Ignorar links sem destino.
             */

            const href =
                link.getAttribute("href");

            if (
                !href ||
                href === "#" ||
                href.startsWith("#") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:")
            ) {
                return;
            }


            /*
             * Links externos.
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


            if (
                destination.origin !==
                window.location.origin
            ) {
                return;
            }


            /*
             * Não interceptar download.
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
             * INTERCEPTAR
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
   NAVIGATE WITH TRANSITION
   ========================================================= */

function navigateWithTransition(
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
     * Mostrar tela de processamento.
     */

    transition.classList.add(
        "active"
    );


    /*
     * Pequeno atraso para o efeito
     * ser realmente percebido.
     */

    setTimeout(
        () => {

            window.location.href =
                url;

        },
        420
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
     *
     * Faz os elementos aparecerem
     * quando entram na tela.
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
                                .add("visible");


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

        /*
         * Guardar texto original.
         */

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
   FORM PROCESSING EFFECT
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


        /*
         * Não bloqueamos o formulário.
         *
         * O código existente de login/
         * registro continua funcionando.
         */

        const submitButton =
            form.querySelector(
                'button[type="submit"], input[type="submit"]'
            );


        if (!submitButton) {
            return;
        }


        /*
         * Pequeno efeito visual.
         */

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
   PAGE EXIT
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
   EXPOSE FUNCTION
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
