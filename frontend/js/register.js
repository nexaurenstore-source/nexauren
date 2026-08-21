/*
 * =========================================================
 * NEXAUREN
 * REGISTER
 *
 * Responsabilidade:
 * - Validar o formulário
 * - Enviar os dados para /api/register
 * - Mostrar o resultado ao utilizador
 *
 * NÃO contém:
 * - SQL
 * - Password hashing
 * - Acesso direto ao D1
 *
 * Tudo isso fica no Worker.
 * =========================================================
 */


/* =========================================================
   ELEMENTS
   ========================================================= */

const form =
    document.getElementById(
        "register-form"
    );

const nameInput =
    document.getElementById(
        "name"
    );

const emailInput =
    document.getElementById(
        "email"
    );

const passwordInput =
    document.getElementById(
        "password"
    );

const confirmPasswordInput =
    document.getElementById(
        "confirm-password"
    );

const registerButton =
    document.getElementById(
        "register-button"
    );

const message =
    document.getElementById(
        "register-message"
    );


/* =========================================================
   ERRORS
   ========================================================= */

const nameError =
    document.getElementById(
        "name-error"
    );

const emailError =
    document.getElementById(
        "email-error"
    );

const passwordError =
    document.getElementById(
        "password-error"
    );

const confirmPasswordError =
    document.getElementById(
        "confirm-password-error"
    );


/* =========================================================
   SAFETY CHECK
   ========================================================= */

if (!form) {

    console.error(
        "Nexauren: register form not found."
    );

}


/* =========================================================
   HELPERS
   ========================================================= */

function clearErrors() {

    nameError.textContent = "";

    emailError.textContent = "";

    passwordError.textContent = "";

    confirmPasswordError.textContent = "";

    message.textContent = "";

    message.className =
        "auth-message";

}


function showMessage(
    text,
    type = "error"
) {

    message.textContent = text;

    message.className =
        `auth-message ${type}`;

}


function setLoading(
    loading
) {

    registerButton.disabled =
        loading;

    if (loading) {

        registerButton.textContent =
            "Creating account...";

    } else {

        registerButton.textContent =
            "Create account";

    }

}


/* =========================================================
   CLIENT VALIDATION
   ========================================================= */

function validateForm() {

    let valid = true;


    const name =
        nameInput.value.trim();

    const email =
        emailInput.value
            .trim()
            .toLowerCase();

    const password =
        passwordInput.value;

    const confirmPassword =
        confirmPasswordInput.value;


    /* -------------------------------------------------------
       NAME
       ------------------------------------------------------- */

    if (!name) {

        nameError.textContent =
            "Please enter your name.";

        valid = false;

    } else if (
        name.length > 100
    ) {

        nameError.textContent =
            "Name is too long.";

        valid = false;

    }


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

    if (
        password.length < 8
    ) {

        passwordError.textContent =
            "Password must contain at least 8 characters.";

        valid = false;

    } else if (
        password.length > 200
    ) {

        passwordError.textContent =
            "Password is too long.";

        valid = false;

    }


    /* -------------------------------------------------------
       CONFIRM PASSWORD
       ------------------------------------------------------- */

    if (
        confirmPassword !== password
    ) {

        confirmPasswordError.textContent =
            "Passwords do not match.";

        valid = false;

    }


    return valid;

}


/* =========================================================
   REGISTER
   ========================================================= */

async function register() {

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

        name:
            nameInput.value.trim(),

        email:
            emailInput.value
                .trim()
                .toLowerCase(),

        password:
            passwordInput.value

    };


    /* -------------------------------------------------------
       LOADING
       ------------------------------------------------------- */

    setLoading(true);


    try {

        /* ---------------------------------------------------
           API REQUEST
           --------------------------------------------------- */

        const response =
            await fetch(
                "/api/register",
                {
                    method: "POST",

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
                "Unable to create account.",
                "error"
            );

            return;

        }


        /* ---------------------------------------------------
           SUCCESS
           --------------------------------------------------- */

        showMessage(
            "Account created successfully.",
            "success"
        );


        /* ---------------------------------------------------
           CLEAR PASSWORDS
           --------------------------------------------------- */

        passwordInput.value = "";

        confirmPasswordInput.value = "";


        /* ---------------------------------------------------
           OPTIONAL REDIRECT
           ---------------------------------------------------

           We do not automatically redirect yet.

           Authentication/login will be implemented
           in the next stage.

        */


    } catch (error) {

        console.error(
            "Registration request failed:",
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

        register();

    }
);


/* =========================================================
   LIVE PASSWORD CHECK
   ========================================================= */

confirmPasswordInput.addEventListener(
    "input",
    function () {

        if (
            confirmPasswordInput.value ===
            passwordInput.value
        ) {

            confirmPasswordError.textContent =
                "";

        }

    }
);


/* =========================================================
   INITIAL STATE
   ========================================================= */

clearErrors();
