/* =========================================================
   NEXAUREN — FUTURISTIC UI V1
   Branco + Azul elétrico + Roxo + Ciano
   ========================================================= */

:root {
    --bg: #ffffff;
    --bg-soft: #f6f8ff;

    --text: #101426;
    --text-soft: #626b82;

    --primary: #635bff;
    --primary-dark: #4b42e8;
    --blue: #1687ff;
    --cyan: #00cfff;
    --purple: #9b5cff;
    --pink: #ff4fd8;

    --border: rgba(99, 91, 255, 0.14);

    --card: rgba(255, 255, 255, 0.78);

    --shadow:
        0 20px 60px rgba(44, 52, 100, 0.10);

    --shadow-hover:
        0 30px 80px rgba(99, 91, 255, 0.20);

    --radius: 22px;

    --transition:
        280ms cubic-bezier(.2, .8, .2, 1);
}


/* =========================================================
   RESET
   ========================================================= */

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}


html {
    scroll-behavior: smooth;
}


body {
    min-height: 100vh;

    font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;

    color: var(--text);

    background:
        radial-gradient(
            circle at 10% 10%,
            rgba(99, 91, 255, 0.12),
            transparent 30%
        ),
        radial-gradient(
            circle at 90% 20%,
            rgba(0, 207, 255, 0.10),
            transparent 28%
        ),
        radial-gradient(
            circle at 50% 100%,
            rgba(255, 79, 216, 0.08),
            transparent 30%
        ),
        var(--bg);

    overflow-x: hidden;

    -webkit-font-smoothing: antialiased;
}


/* =========================================================
   BACKGROUND TECHNOLOGY EFFECT
   ========================================================= */

body::before {
    content: "";

    position: fixed;

    inset: 0;

    pointer-events: none;

    opacity: 0.45;

    background-image:
        linear-gradient(
            rgba(99, 91, 255, 0.035) 1px,
            transparent 1px
        ),
        linear-gradient(
            90deg,
            rgba(99, 91, 255, 0.035) 1px,
            transparent 1px
        );

    background-size: 42px 42px;

    mask-image:
        linear-gradient(
            to bottom,
            black,
            transparent 90%
        );

    z-index: -2;
}


/* =========================================================
   AMBIENT LIGHT
   ========================================================= */

body::after {
    content: "";

    position: fixed;

    width: 420px;
    height: 420px;

    top: -180px;
    right: -140px;

    border-radius: 50%;

    background:
        linear-gradient(
            135deg,
            var(--primary),
            var(--cyan)
        );

    filter: blur(100px);

    opacity: 0.13;

    pointer-events: none;

    z-index: -1;

    animation:
        ambientFloat 9s ease-in-out infinite alternate;
}


@keyframes ambientFloat {
    from {
        transform: translate3d(0, 0, 0) scale(1);
    }

    to {
        transform: translate3d(-70px, 50px, 0) scale(1.15);
    }
}


/* =========================================================
   LINKS
   ========================================================= */

a {
    color: inherit;
    text-decoration: none;

    transition:
        color var(--transition),
        opacity var(--transition);
}


a:hover {
    color: var(--primary);
}


/* =========================================================
   BUTTONS
   ========================================================= */

button,
.btn,
input[type="submit"] {
    position: relative;

    border: 0;

    border-radius: 14px;

    padding: 13px 21px;

    font: inherit;
    font-weight: 700;

    cursor: pointer;

    color: #ffffff;

    background:
        linear-gradient(
            135deg,
            var(--primary),
            var(--blue)
        );

    box-shadow:
        0 10px 30px
        rgba(99, 91, 255, 0.24);

    overflow: hidden;

    transition:
        transform var(--transition),
        box-shadow var(--transition),
        filter var(--transition);
}


button::before,
.btn::before {
    content: "";

    position: absolute;

    top: 0;
    left: -120%;

    width: 80%;
    height: 100%;

    background:
        linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,.45),
            transparent
        );

    transform: skewX(-20deg);

    transition: left 600ms ease;
}


button:hover,
.btn:hover {
    transform: translateY(-3px);

    box-shadow:
        0 18px 45px
        rgba(99, 91, 255, 0.32);

    filter: brightness(1.04);
}


button:hover::before,
.btn:hover::before {
    left: 140%;
}


button:active,
.btn:active {
    transform: translateY(0) scale(.98);
}


/* =========================================================
   HEADER / NAVIGATION
   ========================================================= */

header,
.navbar,
nav {
    position: relative;
    z-index: 20;
}


nav {
    display: flex;

    align-items: center;
    justify-content: space-between;

    gap: 24px;

    width: min(
        1180px,
        calc(100% - 40px)
    );

    margin: 0 auto;

    padding: 20px 0;
}


/* Logo */

.logo,
.brand {
    font-size: 1.35rem;

    font-weight: 900;

    letter-spacing: -0.04em;

    background:
        linear-gradient(
            90deg,
            var(--primary),
            var(--blue),
            var(--cyan)
        );

    -webkit-background-clip: text;
    background-clip: text;

    color: transparent;

    transition:
        transform var(--transition);
}


.logo:hover,
.brand:hover {
    transform: translateY(-2px);
}


/* Navigation links */

nav a {
    font-weight: 650;

    color: var(--text-soft);

    transition:
        color var(--transition),
        transform var(--transition);
}


nav a:hover {
    color: var(--primary);

    transform: translateY(-2px);
}


/* =========================================================
   MAIN CONTAINER
   ========================================================= */

.container {
    width: min(
        1180px,
        calc(100% - 40px)
    );

    margin: 0 auto;
}


main {
    position: relative;
}


/* =========================================================
   HERO
   ========================================================= */

.hero {
    position: relative;

    min-height: 650px;

    display: flex;

    align-items: center;

    justify-content: center;

    text-align: center;

    padding:
        90px 0
        80px;

    overflow: hidden;
}


.hero::before {
    content: "";

    position: absolute;

    width: 360px;
    height: 360px;

    border-radius: 50%;

    left: 50%;
    top: 35%;

    transform:
        translate(-50%, -50%);

    background:
        radial-gradient(
            circle,
            rgba(99, 91, 255, 0.17),
            transparent 68%
        );

    filter: blur(20px);

    pointer-events: none;

    animation:
        heroGlow 6s ease-in-out infinite alternate;
}


@keyframes heroGlow {
    from {
        transform:
            translate(-50%, -50%)
            scale(.9);
    }

    to {
        transform:
            translate(-50%, -50%)
            scale(1.2);
    }
}


.hero-content {
    position: relative;

    z-index: 2;

    max-width: 850px;

    animation:
        pageEnter 700ms cubic-bezier(.2,.8,.2,1);
}


.hero h1 {
    font-size:
        clamp(
            3rem,
            8vw,
            6.8rem
        );

    line-height: .94;

    letter-spacing: -0.075em;

    font-weight: 900;

    margin-bottom: 25px;

    background:
        linear-gradient(
            100deg,
            #15182a 10%,
            var(--primary) 45%,
            var(--blue) 70%,
            var(--cyan)
        );

    -webkit-background-clip: text;
    background-clip: text;

    color: transparent;
}


.hero p {
    max-width: 680px;

    margin: 0 auto 34px;

    color: var(--text-soft);

    font-size:
        clamp(
            1rem,
            2vw,
            1.2rem
        );

    line-height: 1.75;
}


/* =========================================================
   SECTION
   ========================================================= */

section {
    position: relative;

    padding:
        90px 0;
}


.section-title {
    margin-bottom: 42px;

    text-align: center;
}


.section-title h2 {
    font-size:
        clamp(
            2rem,
            5vw,
            3.4rem
        );

    letter-spacing: -0.05em;

    font-weight: 850;
}


.section-title p {
    margin-top: 12px;

    color: var(--text-soft);

    line-height: 1.7;
}


/* =========================================================
   GRID
   ========================================================= */

.grid,
.tools-grid,
.cards-grid {
    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(
                230px,
                1fr
            )
        );

    gap: 22px;
}


/* =========================================================
   CARDS
   ========================================================= */

.card,
.tool-card,
.feature-card {
    position: relative;

    padding: 28px;

    border-radius: var(--radius);

    background:
        linear-gradient(
            145deg,
            rgba(255,255,255,.92),
            rgba(247,249,255,.78)
        );

    border:
        1px solid var(--border);

    box-shadow:
        var(--shadow);

    backdrop-filter:
        blur(18px);

    -webkit-backdrop-filter:
        blur(18px);

    overflow: hidden;

    transition:
        transform 400ms cubic-bezier(.2,.8,.2,1),
        box-shadow 400ms ease,
        border-color 400ms ease;
}


.card::before,
.tool-card::before,
.feature-card::before {
    content: "";

    position: absolute;

    width: 160px;
    height: 160px;

    top: -100px;
    right: -80px;

    border-radius: 50%;

    background:
        linear-gradient(
            135deg,
            var(--primary),
            var(--cyan)
        );

    filter: blur(50px);

    opacity: .12;

    transition:
        opacity 400ms ease,
        transform 400ms ease;
}


.card:hover,
.tool-card:hover,
.feature-card:hover {
    transform:
        translateY(-9px);

    box-shadow:
        var(--shadow-hover);

    border-color:
        rgba(99,91,255,.30);
}


.card:hover::before,
.tool-card:hover::before,
.feature-card:hover::before {
    opacity: .24;

    transform:
        scale(1.25);
}


.card h3,
.tool-card h3,
.feature-card h3 {
    position: relative;

    z-index: 2;

    margin-bottom: 10px;

    font-size: 1.2rem;
}


.card p,
.tool-card p,
.feature-card p {
    position: relative;

    z-index: 2;

    color: var(--text-soft);

    line-height: 1.65;
}


/* =========================================================
   ICON
   ========================================================= */

.icon,
.tool-icon {
    display: flex;

    align-items: center;
    justify-content: center;

    width: 54px;
    height: 54px;

    margin-bottom: 20px;

    border-radius: 16px;

    color: #ffffff;

    background:
        linear-gradient(
            135deg,
            var(--primary),
            var(--blue),
            var(--cyan)
        );

    box-shadow:
        0 12px 30px
        rgba(99,91,255,.22);

    transition:
        transform var(--transition);
}


.card:hover .icon,
.tool-card:hover .tool-icon {
    transform:
        rotate(-5deg)
        scale(1.08);
}


/* =========================================================
   AUTH PAGES
   ========================================================= */

.auth-page {
    min-height: 100vh;

    display: flex;

    align-items: center;

    justify-content: center;

    padding: 30px 20px;

    background:
        radial-gradient(
            circle at 15% 20%,
            rgba(99,91,255,.13),
            transparent 30%
        ),
        radial-gradient(
            circle at 85% 80%,
            rgba(0,207,255,.12),
            transparent 30%
        ),
        #ffffff;
}


.auth-container {
    width: 100%;

    max-width: 450px;

    animation:
        pageEnter 650ms cubic-bezier(.2,.8,.2,1);
}


.auth-card {
    position: relative;

    padding: 42px;

    border-radius:
        28px;

    background:
        rgba(255,255,255,.88);

    border:
        1px solid
        rgba(99,91,255,.16);

    box-shadow:
        0 30px 100px
        rgba(42,49,95,.14);

    backdrop-filter:
        blur(22px);

    -webkit-backdrop-filter:
        blur(22px);

    overflow: hidden;
}


.auth-card::before {
    content: "";

    position: absolute;

    width: 220px;
    height: 220px;

    top: -130px;
    right: -110px;

    border-radius: 50%;

    background:
        linear-gradient(
            135deg,
            var(--primary),
            var(--cyan)
        );

    filter: blur(55px);

    opacity: .15;
}


.auth-card h1,
.auth-card h2 {
    position: relative;

    margin-bottom: 10px;

    font-size: 2rem;

    letter-spacing: -.04em;

    font-weight: 850;
}


.auth-card > p {
    position: relative;

    color: var(--text-soft);

    line-height: 1.6;

    margin-bottom: 28px;
}


/* =========================================================
   FORMS
   ========================================================= */

form {
    display: flex;

    flex-direction: column;

    gap: 17px;
}


label {
    display: block;

    margin-bottom: 7px;

    font-size: .9rem;

    font-weight: 700;

    color: #30364b;
}


input,
textarea,
select {
    width: 100%;

    border:
        1px solid
        rgba(70,78,120,.15);

    border-radius: 13px;

    padding: 14px 15px;

    font: inherit;

    color: var(--text);

    background:
        rgba(247,249,255,.85);

    outline: none;

    transition:
        border-color var(--transition),
        box-shadow var(--transition),
        background var(--transition),
        transform var(--transition);
}


input::placeholder,
textarea::placeholder {
    color: #9aa1b4;
}


input:focus,
textarea:focus,
select:focus {
    background: #ffffff;

    border-color:
        var(--primary);

    box-shadow:
        0 0 0 4px
        rgba(99,91,255,.10),
        0 10px 30px
        rgba(99,91,255,.08);
}


input:focus,
textarea:focus {
    transform:
        translateY(-1px);
}


/* =========================================================
   ERROR / SUCCESS MESSAGES
   ========================================================= */

.error,
.error-message {
    padding: 12px 14px;

    border-radius: 12px;

    color: #b4233c;

    background:
        rgba(255,70,110,.08);

    border:
        1px solid
        rgba(255,70,110,.14);
}


.success,
.success-message {
    padding: 12px 14px;

    border-radius: 12px;

    color: #087a5b;

    background:
        rgba(0,190,140,.08);

    border:
        1px solid
        rgba(0,190,140,.14);
}


/* =========================================================
   DASHBOARD
   ========================================================= */

.dashboard {
    width: min(
        1100px,
        calc(100% - 40px)
    );

    margin: 0 auto;

    padding:
        70px 0;
}


.dashboard-header {
    display: flex;

    align-items: center;

    justify-content: space-between;

    gap: 20px;

    margin-bottom: 35px;
}


.dashboard-title {
    font-size:
        clamp(
            2rem,
            5vw,
            3.6rem
        );

    letter-spacing: -.06em;

    font-weight: 900;
}


.account-card {
    padding: 30px;

    border-radius: 24px;

    background: var(--card);

    border:
        1px solid var(--border);

    box-shadow: var(--shadow);

    backdrop-filter:
        blur(18px);
}


/* =========================================================
   STATUS
   ========================================================= */

.status {
    display: inline-flex;

    align-items: center;

    gap: 8px;

    padding: 7px 11px;

    border-radius: 999px;

    font-size: .82rem;

    font-weight: 750;

    color: #087a5b;

    background:
        rgba(0,190,140,.09);
}


.status::before {
    content: "";

    width: 7px;
    height: 7px;

    border-radius: 50%;

    background: #00b889;

    box-shadow:
        0 0 0 5px
        rgba(0,184,137,.10);

    animation:
        statusPulse 2s infinite;
}


@keyframes statusPulse {
    0%, 100% {
        opacity: 1;
        transform: scale(1);
    }

    50% {
        opacity: .55;
        transform: scale(.8);
    }
}


/* =========================================================
   PAGE TRANSITIONS
   ========================================================= */

.page-transition {
    position: fixed;

    inset: 0;

    z-index: 9999;

    display: flex;

    align-items: center;

    justify-content: center;

    pointer-events: none;

    opacity: 0;

    background:
        linear-gradient(
            135deg,
            #ffffff,
            #f4f6ff
        );

    transition:
        opacity 300ms ease;
}


.page-transition.active {
    opacity: 1;

    pointer-events: all;
}


.page-transition::before {
    content: "";

    width: 42px;
    height: 42px;

    border-radius: 50%;

    border:
        3px solid
        rgba(99,91,255,.12);

    border-top-color:
        var(--primary);

    border-right-color:
        var(--cyan);

    animation:
        transitionSpin .75s linear infinite;
}


@keyframes transitionSpin {
    to {
        transform: rotate(360deg);
    }
}


body.page-ready {
    animation:
        pageReady 550ms cubic-bezier(.2,.8,.2,1);
}


@keyframes pageReady {
    from {
        opacity: 0;

        transform:
            translateY(10px);
    }

    to {
        opacity: 1;

        transform:
            translateY(0);
    }
}


/* =========================================================
   LOADING
   ========================================================= */

.loading {
    display: inline-flex;

    align-items: center;

    gap: 8px;
}


.loading::after {
    content: "";

    width: 16px;
    height: 16px;

    border:
        2px solid
        rgba(255,255,255,.35);

    border-top-color:
        #ffffff;

    border-radius: 50%;

    animation:
        spin .7s linear infinite;
}


@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}


/* =========================================================
   FOOTER
   ========================================================= */

footer {
    padding: 45px 20px;

    text-align: center;

    color: var(--text-soft);

    border-top:
        1px solid
        rgba(99,91,255,.08);
}


/* =========================================================
   SCROLL REVEAL
   ========================================================= */

.reveal {
    opacity: 0;

    transform:
        translateY(24px);

    transition:
        opacity 700ms ease,
        transform 700ms cubic-bezier(.2,.8,.2,1);
}


.reveal.visible {
    opacity: 1;

    transform:
        translateY(0);
}


/* =========================================================
   REDUCED MOTION
   ========================================================= */

@media (
    prefers-reduced-motion: reduce
) {

    *,
    *::before,
    *::after {

        scroll-behavior: auto !important;

        animation-duration:
            .01ms !important;

        animation-iteration-count:
            1 !important;

        transition-duration:
            .01ms !important;

    }

}


/* =========================================================
   TABLET
   ========================================================= */

@media (
    max-width: 800px
) {

    nav {
        width:
            calc(100% - 28px);

        gap: 14px;
    }


    .hero {
        min-height:
            570px;

        padding:
            70px 0;
    }


    section {
        padding:
            70px 0;
    }


    .auth-card {
        padding:
            32px 24px
           .dashboard-header {
        align-items:
            flex-start;

        flex-direction:
            column;
    }

}


/* =========================================================
   MOBILE
   ========================================================= */

@media (
    max-width: 560px
) {

    .container {
        width:
            calc(100% - 28px);
    }


    nav {
        width:
            calc(100% - 24px);

        padding:
            15px 0;
    }


    .logo,
    .brand {
        font-size:
            1.15rem;
    }


    nav a {
        font-size:
            .88rem;
    }


    .hero {
        min-height:
            530px;

        padding:
            55px 0;
    }


    .hero h1 {
        font-size:
            clamp(
                2.7rem,
                15vw,
                4rem
            );
    }


    .hero p {
        font-size:
            .98rem;

        line-height:
            1.65;
    }


    section {
        padding:
            55px 0;
    }


    .grid,
    .tools-grid,
    .cards-grid {
        grid-template-columns:
            1fr;
    }


    .card,
    .tool-card,
    .feature-card {
        padding:
            23px;
    }


    .auth-page {
        padding:
            20px 14px;
    }


    .auth-card {
        padding:
            28px 20px;

        border-radius:
            22px;
    }


    .auth-card h1,
    .auth-card h2 {
        font-size:
            1.7rem;
    }


    button,
    .btn,
    input[type="submit"] {
        width:
            100%;
    }


    .dashboard {
        width:
            calc(100% - 28px);

        padding:
            45px 0;
    }

}


/* =========================================================
   UTILITY
   ========================================================= */

.text-center {
    text-align:
        center;
}


.hidden {
    display:
        none !important;
}


.fade-in {
    animation:
        pageEnter
        650ms
        cubic-bezier(.2,.8,.2,1);
}


/* =========================================================
   PAGE ENTER
   ========================================================= */

@keyframes pageEnter {

    from {
        opacity:
            0;

        transform:
            translateY(18px)
            scale(.985);
    }


    to {
        opacity:
            1;

        transform:
            translateY(0)
            scale(1);
    }

   }
