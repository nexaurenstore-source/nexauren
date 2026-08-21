/*
 * =========================================================
 * NEXAUREN
 * CLOUDFLARE WORKER
 *
 * MVP — AUTENTICATION CORE
 *
 * Nesta etapa:
 * - Frontend
 * - Cloudflare Worker
 * - D1
 * - API
 * - Registro de contas
 *
 * Ainda NÃO temos:
 * - Créditos
 * - Planos
 * - PayPal
 * - Marketplace
 * - Pagamentos
 * =========================================================
 */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const ALLOWED_ORIGIN =
    "https://nexaurenstory.com";


/* =========================================================
   INPUT LIMITS
   ========================================================= */

const MAX_NAME_LENGTH = 100;

const MAX_EMAIL_LENGTH = 254;

const MIN_PASSWORD_LENGTH = 8;

const MAX_PASSWORD_LENGTH = 200;


/* =========================================================
   PASSWORD HASHING
   ========================================================= */

const PBKDF2_ITERATIONS = 100000;


/* =========================================================
   MAIN WORKER
   ========================================================= */

export default {

    async fetch(
        request,
        env,
        ctx
    ) {

        try {

            const url =
                new URL(request.url);


            /* -------------------------------------------------
               CORS PREFLIGHT
               ------------------------------------------------- */

            if (
                request.method === "OPTIONS"
            ) {

                return handleOptions(
                    request
                );

            }


            /* -------------------------------------------------
               API
               ------------------------------------------------- */

            if (
                url.pathname === "/api" ||
                url.pathname.startsWith("/api/")
            ) {

                return await handleApiRequest(
                    request,
                    env,
                    ctx,
                    url
                );

            }


            /* -------------------------------------------------
               FRONTEND
               ------------------------------------------------- */

            return env.ASSETS.fetch(
                request
            );


        } catch (error) {

            console.error(
                "Nexauren Worker Error:",
                error
            );


            return json(
                {
                    success: false,
                    message:
                        "Internal server error."
                },
                500,
                request
            );

        }

    }

};


/* =========================================================
   API ROUTER
   ========================================================= */

async function handleApiRequest(
    request,
    env,
    ctx,
    url
) {

    const path =
        url.pathname;


    /* -------------------------------------------------------
       API HEALTH CHECK
       ------------------------------------------------------- */

    if (
        path === "/api" &&
        request.method === "GET"
    ) {

        return json(
            {
                success: true,
                message:
                    "Nexauren API is running."
            },
            200,
            request
        );

    }


    /* -------------------------------------------------------
       API HEALTH CHECK
       ------------------------------------------------------- */

    if (
        path === "/api/health" &&
        request.method === "GET"
    ) {

        return json(
            {
                success: true,
                service: "Nexauren API",
                status: "online"
            },
            200,
            request
        );

    }


    /* -------------------------------------------------------
       REGISTER
       ------------------------------------------------------- */

    if (
        path === "/api/register" &&
        request.method === "POST"
    ) {

        return await register(
            request,
            env
        );

    }


    /* -------------------------------------------------------
       UNKNOWN API ENDPOINT
       ------------------------------------------------------- */

    return json(
        {
            success: false,
            message:
                "API endpoint not found."
        },
        404,
        request
    );

}


/* =========================================================
   REGISTER
   ========================================================= */

async function register(
    request,
    env
) {

    /* -------------------------------------------------------
       READ REQUEST BODY
       ------------------------------------------------------- */

    let data;

    try {

        data =
            await request.json();

    } catch (error) {

        return json(
            {
                success: false,
                message:
                    "Invalid JSON."
            },
            400,
            request
        );

    }


    /* -------------------------------------------------------
       VALIDATE BODY
       ------------------------------------------------------- */

    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {

        return json(
            {
                success: false,
                message:
                    "Invalid request body."
            },
            400,
            request
        );

    }


    /* -------------------------------------------------------
       READ INPUT
       ------------------------------------------------------- */

    const name =
        String(
            data.name ?? ""
        ).trim();


    const email =
        String(
            data.email ?? ""
        )
        .trim()
        .toLowerCase();


    const password =
        String(
            data.password ?? ""
        );


    /* -------------------------------------------------------
       NAME VALIDATION
       ------------------------------------------------------- */

    if (
        !name ||
        name.length > MAX_NAME_LENGTH
    ) {

        return json(
            {
                success: false,
                message:
                    "Invalid name."
            },
            400,
            request
        );

    }


    /* -------------------------------------------------------
       EMAIL VALIDATION
       ------------------------------------------------------- */

    if (
        !email ||
        email.length > MAX_EMAIL_LENGTH ||
        !isValidEmail(email)
    ) {

        return json(
            {
                success: false,
                message:
                    "Invalid email."
            },
            400,
            request
        );

    }


    /* -------------------------------------------------------
       PASSWORD VALIDATION
       ------------------------------------------------------- */

    if (
        !password ||
        password.length < MIN_PASSWORD_LENGTH ||
        password.length > MAX_PASSWORD_LENGTH
    ) {

        return json(
            {
                success: false,
                message:
                    "Password must contain between 8 and 200 characters."
            },
            400,
            request
        );

    }


    /* -------------------------------------------------------
       CHECK DATABASE
       ------------------------------------------------------- */

    if (!env.DB) {

        console.error(
            "D1 binding DB is missing."
        );

        return json(
            {
                success: false,
                message:
                    "Database is not configured."
            },
            500,
            request
        );

    }


    /* -------------------------------------------------------
       CHECK EXISTING USER
       ------------------------------------------------------- */

    let existingUser;

    try {

        existingUser =
            await env.DB
                .prepare(`
                    SELECT id
                    FROM users
                    WHERE email = ?
                    LIMIT 1
                `)
                .bind(email)
                .first();

    } catch (error) {

        console.error(
            "Database lookup failed:",
            error
        );

        return json(
            {
                success: false,
                message:
                    "Unable to access the database."
            },
            500,
            request
        );

    }


    /* -------------------------------------------------------
       EXISTING ACCOUNT
       ------------------------------------------------------- */

    if (existingUser) {

        return json(
            {
                success: false,
                message:
                    "An account with this email already exists."
            },
            409,
            request
        );

    }


    /* -------------------------------------------------------
       HASH PASSWORD
       ------------------------------------------------------- */

    let passwordHash;

    try {

        passwordHash =
            await hashPassword(
                password
            );

    } catch (error) {

        console.error(
            "Password hashing failed:",
            error
        );

        return json(
            {
                success: false,
                message:
                    "Unable to create account."
            },
            500,
            request
        );

    }


    /* -------------------------------------------------------
       CREATE USER ID
       ------------------------------------------------------- */

    const userId =
        crypto.randomUUID();


    /* -------------------------------------------------------
       TIMESTAMP
       ------------------------------------------------------- */

    const now =
        Math.floor(
            Date.now() / 1000
        );


    /* -------------------------------------------------------
       INSERT USER
       ------------------------------------------------------- */

    try {

        await env.DB
            .prepare(`
                INSERT INTO users (
                    id,
                    name,
                    email,
                    password_hash,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `)
            .bind(
                userId,
                name,
                email,
                passwordHash,
                now,
                now
            )
            .run();

    } catch (error) {

        console.error(
            "User creation failed:",
            error
        );

        return json(
            {
                success: false,
                message:
                    "Unable to create account."
            },
            500,
            request
        );

    }


    /* -------------------------------------------------------
       SUCCESS
       ------------------------------------------------------- */

    return json(
        {
            success: true,
            message:
                "Account created successfully.",
            user: {
                id: userId,
                name: name,
                email: email
            }
        },
        201,
        request
    );

}


/* =========================================================
   PASSWORD HASH
   ========================================================= */

async function hashPassword(
    password
) {

    const encoder =
        new TextEncoder();


    const passwordBytes =
        encoder.encode(
            password
        );


    /* -------------------------------------------------------
       RANDOM SALT
       ------------------------------------------------------- */

    const salt =
        crypto.getRandomValues(
            new Uint8Array(16)
        );


    /* -------------------------------------------------------
       IMPORT PASSWORD
       ------------------------------------------------------- */

    const key =
        await crypto.subtle.importKey(
            "raw",
            passwordBytes,
            {
                name: "PBKDF2"
            },
            false,
            [
                "deriveBits"
            ]
        );


    /* -------------------------------------------------------
       DERIVE HASH
       ------------------------------------------------------- */

    const derivedBits =
        await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt: salt,
                iterations:
                    PBKDF2_ITERATIONS,
                hash: "SHA-256"
            },
            key,
            256
        );


    const hash =
        new Uint8Array(
            derivedBits
        );


    /* -------------------------------------------------------
       STORAGE FORMAT
       -------------------------------------------------------

       pbkdf2$iterations$salt$hash

       Example:

       pbkdf2$100000$xxxxx$xxxxx
    */

    return [
        "pbkdf2",
        PBKDF2_ITERATIONS,
        bytesToBase64Url(salt),
        bytesToBase64Url(hash)
    ].join("$");

}


/* =========================================================
   EMAIL VALIDATION
   ========================================================= */

function isValidEmail(
    email
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );

}


/* =========================================================
   CORS OPTIONS
   ========================================================= */

function handleOptions(
    request
) {

    const origin =
        request.headers.get(
            "Origin"
        );


    /* -------------------------------------------------------
       Reject unknown origins
       ------------------------------------------------------- */

    if (
        origin &&
        origin !== ALLOWED_ORIGIN
    ) {

        return new Response(
            null,
            {
                status: 403
            }
        );

    }


    return new Response(
        null,
        {
            status: 204,
            headers:
                corsHeaders(request)
        }
    );

}


/* =========================================================
   CORS HEADERS
   ========================================================= */

function corsHeaders(
    request
) {

    const origin =
        request.headers.get(
            "Origin"
        );


    const headers =
        new Headers();


    /* -------------------------------------------------------
       Allowed origin
       ------------------------------------------------------- */

    if (
        origin === ALLOWED_ORIGIN
    ) {

        headers.set(
            "Access-Control-Allow-Origin",
            ALLOWED_ORIGIN
        );

        headers.set(
            "Access-Control-Allow-Credentials",
            "true"
        );

    }


    /* -------------------------------------------------------
       Methods
       ------------------------------------------------------- */

    headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );


    /* -------------------------------------------------------
       Headers
       ------------------------------------------------------- */

    headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );


    /* -------------------------------------------------------
       Cache
       ------------------------------------------------------- */

    headers.set(
        "Vary",
        "Origin"
    );


    return headers;

}


/* =========================================================
   JSON RESPONSE
   ========================================================= */

function json(
    data,
    status = 200,
    request,
    extraHeaders = {}
) {

    const headers =
        corsHeaders(request);


    headers.set(
        "Content-Type",
        "application/json; charset=utf-8"
    );


    headers.set(
        "Cache-Control",
        "no-store"
    );


    /* -------------------------------------------------------
       Extra headers
       ------------------------------------------------------- */

    for (
        const [
            key,
            value
        ] of Object.entries(
            extraHeaders
        )
    ) {

        headers.set(
            key,
            value
        );

    }


    return new Response(
        JSON.stringify(data),
        {
            status: status,
            headers: headers
        }
    );

}


/* =========================================================
   BASE64URL
   ========================================================= */

function bytesToBase64Url(
    bytes
) {

    let binary = "";


    for (
        const byte of bytes
    ) {

        binary += String.fromCharCode(
            byte
        );

    }


    return btoa(binary)
        .replace(
            /\+/g,
            "-"
        )
        .replace(
            /\//g,
            "_"
        )
        .replace(
            /=+$/,
            ""
        );

        }
