 */
const ALLOWED_ORIGIN = "https://nexaurenstory.com";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 200;
const MIN_PASSWORD_LENGTH = 8;

const REGISTER_WINDOW_SECONDS = 60 * 60;
const REGISTER_MAX_ATTEMPTS = 5;


/* =========================================================
   MAIN
   ========================================================= */

export default {
    async fetch(request, env, ctx) {

        try {

            const url = new URL(request.url);


            /* -------------------------------------------------
               CORS / PREFLIGHT
               ------------------------------------------------- */

            if (request.method === "OPTIONS") {
                return handleOptions(request);
            }


            /* -------------------------------------------------
               API
               ------------------------------------------------- */

            if (url.pathname.startsWith("/api/")) {

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

            return env.ASSETS.fetch(request);

        } catch (error) {

            console.error(
                "Worker error:",
                error
            );

            return json(
                {
                    success: false,
                    message: "Internal server error."
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

    const path = url.pathname;


    /* -------------------------------------------------------
       HEALTH CHECK
       ------------------------------------------------------- */

    if (
        path === "/api" &&
        request.method === "GET"
    ) {

        return json(
            {
                success: true,
                message: "Nexauren API is running."
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

        return register(
            request,
            env
        );

    }


    /* -------------------------------------------------------
       UNKNOWN ENDPOINT
       ------------------------------------------------------- */

    return json(
        {
            success: false,
            message: "API endpoint not found."
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

    /*
     * Rate limiting.
     *
     * O IP é usado apenas para limitar tentativas.
     */

    const ip = getClientIp(request);

    const allowed =
        await checkRateLimit(
            env,
            `register:${ip}`,
            REGISTER_MAX_ATTEMPTS,
            REGISTER_WINDOW_SECONDS
        );

    if (!allowed) {

        return json(
            {
                success: false,
                message:
                    "Too many registration attempts. Please try again later."
            },
            429,
            request
        );

    }


    /* -------------------------------------------------------
       READ JSON
       ------------------------------------------------------- */

    let data;

    try {

        data = await request.json();

    } catch {

        return json(
            {
                success: false,
                message: "Invalid JSON."
            },
            400,
            request
        );

    }


    if (
        !data ||
        typeof data !== "object"
    ) {

        return json(
            {
                success: false,
                message: "Invalid request body."
            },
            400,
            request
        );

    }


    /* -------------------------------------------------------
       INPUT
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
                message: "Invalid name."
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
                message: "Invalid email."
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


    if (existingUser) {

        return json(
            {
                success: false,
                message:
                    "Unable to create account."
            },
            409,
            request
        );

    }


    /* -------------------------------------------------------
       PASSWORD HASH
       ------------------------------------------------------- */

    let passwordHash;

    try {

        passwordHash =
            await hashPassword(password);

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
       IDs / TIMESTAMP
       ------------------------------------------------------- */

    const userId =
        generateId();


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

        /*
         * A UNIQUE constraint on users.email
         * protects against duplicate accounts
         * even if two requests arrive at the
         * same time.
         */

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
                name,
                email
            }
        },
        201,
        request
    );

}


/* =========================================================
   PASSWORD HASHING
   ========================================================= */

/*
 * PBKDF2 is available through the Web Crypto API.
 *
 * We generate a unique random salt for every password.
 *
 * Stored format:
 *
 * pbkdf2$iterations$salt$hash
 */

const PBKDF2_ITERATIONS = 100000;


async function hashPassword(password) {

    const encoder =
        new TextEncoder();


    const passwordBytes =
        encoder.encode(password);


    const salt =
        crypto.getRandomValues(
            new Uint8Array(16)
        );


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


    const derivedBits =
        await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt,
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

function isValidEmail(email) {

    /*
     * Deliberately simple validation.
     *
     * The email provider is responsible
     * for actual email delivery.
     */

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );

}


/* =========================================================
   ID GENERATOR
   ========================================================= */

function generateId() {

    return crypto.randomUUID();

}


/* =========================================================
   IP
   ========================================================= */

function getClientIp(request) {

    return (
        request.headers.get(
            "CF-Connecting-IP"
        ) ||
        request.headers.get(
            "X-Forwarded-For"
        ) ||
        "unknown"
    );

}


/* =========================================================
   RATE LIMIT
   ========================================================= */

/*
 * This is a simple D1-backed rate limiter.
 *
 * It requires a table called:
 *
 * rate_limits
 *
 * We are NOT creating that table in this stage.
 *
 * Therefore, until the rate-limit table exists,
 * registration continues normally.
 *
 * We will add proper rate limiting later,
 * after the authentication core works.
 */

async function checkRateLimit(
    env,
    key,
    maxAttempts,
    windowSeconds
) {

    /*
     * MVP:
     * Do not block registration because the
     * optional rate-limit table does not exist.
     *
     * Cloudflare's own protection can be used
     * while we finish the authentication system.
     */

    return true;

}


/* =========================================================
   CORS
   ========================================================= */

function handleOptions(request) {

    const origin =
        request.headers.get(
            "Origin"
        );


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

function corsHeaders(request) {

    const origin =
        request.headers.get(
            "Origin"
        );


    const headers =
        new Headers();


    /*
     * Only allow the Nexauren site.
     */

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


    headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );


    headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );


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
            status,
            headers
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
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

                    }
