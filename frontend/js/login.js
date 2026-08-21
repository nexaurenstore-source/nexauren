/*
 * =========================================================
 * NEXAUREN
 * LOGIN
 *
 * Responsabilidade:
 * - Validar o formulário
 * - Enviar email e password para /api/login
 * - Mostrar a resposta da API
 *
 * A autenticação real fica no Worker.
 * A senha NÃO é armazenada neste JavaScript.
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
   HELPERS
   ========================================================= */

function clearErrors() {

    emailError.textContent = "";

    passwordError.textContent = "";

    message.textContent = "";

    message.className =
        "auth-message";

}


function showMessage(
    text,
    type = "error"
) {

    message.textContent =
        text;

    message.className =
        `auth-message ${type}`;

}


function setLoading(
    loading
) {

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
        email.length > 254
    ) {

        emailError.textContent =
            "Email is too long.";

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
        password.length > 200
    ) {

        passwordError.textContent =
            "Password is too long.";

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

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify(
                            data
                        )
                }
            );


        /* ---------------------------------------------------
           RESPONSE
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


        /*
         * Não redirecionamos ainda.
         *
         * Primeiro vamos implementar a sessão
         * no Worker.
         *
         * Depois o login poderá redirecionar
         * para a área autenticada.
         */


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

form.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();

        login();

    }
);


/* =========================================================
   INITIAL STATE
   ========================================================= */

clearErrors();
