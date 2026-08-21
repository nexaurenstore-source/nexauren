/*
 * =========================================================
 * NEXAUREN
 * LOGIN
 *
 * Responsabilidade:
 * - Validar formulário
 * - Enviar email/password para /api/login
 * - Guardar a sessão através do cookie HttpOnly
 * - Mostrar mensagens ao utilizador
 *
 * NÃO contém:
 * - SQL
 * - Password hashing
 * - Criação de sessão
 *
 * Tudo isso fica no Worker.
 * =========================================================
 */


/* =========================================================
   ELEMENTS
   ========================================================= */

const form =
    document.getElementById(
        "login-form"
    );

const emailInput =
    document.getElementById(
        "email"
    );

const passwordInput =
    document.getElementById(
        "password"
    );

const loginButton =
    document.getElementById(
        "login-button"
    );

const message =
    document.getElementById(
        "login-message"
    );

const emailError =
    document.getElementById(
        "email-error"
    );

const passwordError =
    document.getElementById(
        "password-error"
    );


/* =========================================================
   SAFETY CHECK
   ========================================================= */

if (!form) {

    console.error(
        "Nexauren: login form not found."
    );

}


/* =========================================================
   CLEAR ERRORS
   ========================================================= */

function clearErrors() {

    if (emailError) {
        emailError.textContent = "";
    }

    if (passwordError) {
        passwordError.textContent = "";
    }

    if (message) {

        message.textContent = "";

        message.className =
            "auth-message";

    }

}


/* =========================================================
   MESSAGE
   ========================================================= */

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


/* =========================================================
   LOADING
   ========================================================= */

function setLoading(
    loading
) {

    if (!loginButton) {
        return;
    }

    loginButton.disabled =
        loading;

    if (loading) {

        loginButton.textContent =
            "Signing in...";

    } else {

        loginButton.textContent =
            "Sign in";

    }

}


/* =========================================================
   VALIDATION
   ========================================================= */

function validateForm() {

    let valid = true;


    const email =
        emailInput.value
            .trim()
            .toLowerCase();

    const password =
        passwordInput.value;


    /* -------------------------------------------------------
       EMAIL
       ------------------------------------------------------- */

    if (!email) {

        emailError.textContent =
            "Please enter your email.";

        valid = false;

    } else if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email
        )
    ) {

        emailError.textContent =
            "Please enter a valid email.";

        valid = false;

    }


    /* -------------------------------------------------------
       PASSWORD
       ------------------------------------------------------- */

    if (!password) {

        passwordError.textContent =
            "Please enter your password.";

        valid = false;

    } else if (
        password.length < 8
    ) {

        passwordError.textContent =
            "Password must contain at least 8 characters.";

        valid = false;

    }


    return valid;

}


/* =========================================================
   LOGIN
   ========================================================= */

async function login() {

    clearErrors();


    /* -------------------------------------------------------
       VALIDATE
       ------------------------------------------------------- */

    if (
        !validateForm()
    ) {

        return;

    }


    /* -------------------------------------------------------
       DATA
       ------------------------------------------------------- */

    const data = {

        email:
            emailInput.value
                .trim()
                .toLowerCase(),

        password:
            passwordInput.value

    };


    setLoading(true);


    try {

        /* ---------------------------------------------------
           API REQUEST
           --------------------------------------------------- */

        const response =
            await fetch(
                "/api/login",
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            data
                        )
                }
            );


        /* ---------------------------------------------------
           READ RESPONSE
           --------------------------------------------------- */

        let result;

        try {

            result =
                await response.json();

        } catch {

            result = {
                success: false,
                message:
                    "The server returned an invalid response."
            };

        }


        /* ---------------------------------------------------
           ERROR
           --------------------------------------------------- */

        if (
            !response.ok ||
            !result.success
        ) {

            showMessage(
                result.message ||
                "Unable to sign in.",
                "error"
            );

            return;

        }


        /* ---------------------------------------------------
           SUCCESS
           --------------------------------------------------- */

        showMessage(
            "Signed in successfully.",
            "success"
        );


        /* ---------------------------------------------------
           CLEAR PASSWORD
           --------------------------------------------------- */

        passwordInput.value = "";


        /* ---------------------------------------------------
           REDIRECT
           ---------------------------------------------------

           The Worker creates the session cookie.

           After successful authentication,
           the user can enter the dashboard.

        */

        setTimeout(
            function () {

                window.location.href =
                    "../dashboard.html";

            },
            500
        );


    } catch (error) {

        console.error(
            "Login request failed:",
            error
        );


        showMessage(
            "Unable to connect to Nexauren. Please try again.",
            "error"
        );


    } finally {

        setLoading(false);

    }

}


/* =========================================================
   FORM SUBMIT
   ========================================================= */

if (form) {

    form.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            login();

        }
    );

}


/* =========================================================
   INITIAL STATE
   ========================================================= */

clearErrors();
