/*
 * =========================================================
 * NEXAUREN
 * CLOUDFLARE WORKER
 *
 * AUTHENTICATION CORE
 *
 * Inclui:
 *
 * - GET  /api
 * - GET  /api/health
 * - POST /api/register
 * - POST /api/login
 * - GET  /api/me
 * - POST /api/logout
 *
 * D1:
 *
 * - users
 * - sessions
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
   SESSION
   ========================================================= */

/*
 * 7 dias.
 */

const SESSION_DURATION_SECONDS =
    60 * 60 * 24 * 7;


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
               CORS
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


    /* =======================================================
       API
       ======================================================= */

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


    /* =======================================================
       HEALTH
       ======================================================= */

    if (
        path === "/api/health" &&
        request.method === "GET"
    ) {

        return json(
            {
                success: true,
                service:
                    "Nexauren API",
                status:
                    "online"
            },
            200,
            request
        );

    }


    /* =======================================================
       REGISTER
       ======================================================= */

    if (
        path === "/api/register" &&
        request.method === "POST"
    ) {

        return await register(
            request,
            env
        );

    }


    /* =======================================================
       LOGIN
       ======================================================= */

    if (
        path === "/api/login" &&
        request.method === "POST"
    ) {

        return await login(
            request,
            env
        );

    }


    /* =======================================================
       CURRENT USER
       ======================================================= */

    if (
        path === "/api/me" &&
        request.method === "GET"
    ) {

        return await getCurrentUser(
            request,
            env
        );

    }


    /* =======================================================
       LOGOUT
       ======================================================= */

    if (
        path === "/api/logout" &&
        request.method === "POST"
    ) {

        return await logout(
            request,
            env
        );

    }


    /* =======================================================
       UNKNOWN ENDPOINT
       ======================================================= */

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

    let data;


    /* -------------------------------------------------------
       JSON
       ------------------------------------------------------- */

    try {

        data =
            await request.json();

    } catch {

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
       BODY
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
       NAME
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
       EMAIL
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
       PASSWORD
       ------------------------------------------------------- */

    if (
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
       DATABASE
       ------------------------------------------------------- */

    if (!env.DB) {

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
       EXISTING USER
       ------------------------------------------------------- */

    try {

        const existingUser =
            await env.DB
                .prepare(`
                    SELECT id
                    FROM users
                    WHERE email = ?
                    LIMIT 1
                `)
                .bind(email)
                .first();


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

    } catch (error) {

        console.error(
            "User lookup failed:",
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
       USER
       ------------------------------------------------------- */

    const userId =
        crypto.randomUUID();


    const now =
        Math.floor(
            Date.now() / 1000
        );


    /* -------------------------------------------------------
       INSERT
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
                name,
                email
            }
        },
        201,
        request
    );

}


/* =========================================================
   LOGIN
   ========================================================= */

async function login(
    request,
    env
) {

    let data;


    /* -------------------------------------------------------
       JSON
       ------------------------------------------------------- */

    try {

        data =
            await request.json();

    } catch {

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
       INPUT
       ------------------------------------------------------- */

    const email =
        String(
            data?.email ?? ""
        )
        .trim()
        .toLowerCase();


    const password =
        String(
            data?.password ?? ""
        );


    /* -------------------------------------------------------
       VALIDATION
       ------------------------------------------------------- */

    if (
        !email ||
        !isValidEmail(email)
    ) {

        return json(
            {
                success: false,
                message:
                    "Invalid email or password."
            },
            401,
            request
        );

    }


    if (
        !password
    ) {

        return json(
            {
                success: false,
                message:
                    "Invalid email or password."
            },
            401,
            request
        );

    }


    /* -------------------------------------------------------
       DATABASE
       ------------------------------------------------------- */

    if (!env.DB) {

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
       FIND USER
       ------------------------------------------------------- */

    let user;


    try {

        user =
            await env.DB
                .prepare(`
                    SELECT
                        id,
                        name,
                        email,
                        password_hash
                    FROM users
                    WHERE email = ?
                    LIMIT 1
                `)
                .bind(email)
                .first();

    } catch (error) {

        console.error(
            "Login database lookup failed:",
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
       USER NOT FOUND
       ------------------------------------------------------- */

    if (!user) {

        return json(
            {
                success: false,
                message:
                    "Invalid email or password."
            },
            401,
            request
        );

    }


    /* -------------------------------------------------------
       VERIFY PASSWORD
       ------------------------------------------------------- */

    let validPassword;


    try {

        validPassword =
            await verifyPassword(
                password,
                user.password_hash
            );

    } catch (error) {

        console.error(
            "Password verification failed:",
            error
        );

        return json(
            {
                success: false,
                message:
                    "Unable to sign in."
            },
            500,
            request
        );

    }


    if (!validPassword) {

        return json(
            {
                success: false,
                message:
                    "Invalid email or password."
            },
            401,
            request
        );

    }


    /* -------------------------------------------------------
       CREATE SESSION
       ------------------------------------------------------- */

    const session =
        await createSession(
            env,
            user.id
        );


    /* -------------------------------------------------------
       COOKIE
       ------------------------------------------------------- */

    const cookie =
        buildSessionCookie(
            session.token
        );


    /* -------------------------------------------------------
       SUCCESS
       ------------------------------------------------------- */

    return json(
        {
            success: true,
            message:
                "Signed in successfully.",
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        },
        200,
        request,
        {
            "Set-Cookie": cookie
        }
    );

}


/* =========================================================
   CREATE SESSION
   ========================================================= */

async function createSession(
    env,
    userId
) {

    /*
     * Token secreto enviado ao navegador.
     *
     * Apenas o hash será armazenado no D1.
     */

    const tokenBytes =
        crypto.getRandomValues(
            new Uint8Array(32)
        );


    const token =
        bytesToBase64Url(
            tokenBytes
        );


    const tokenHash =
        await sha256(
            token
        );


    const sessionId =
        crypto.randomUUID();


    const now =
        Math.floor(
            Date.now() / 1000
        );


    const expiresAt =
        now +
        SESSION_DURATION_SECONDS;


    await env.DB
        .prepare(`
            INSERT INTO sessions (
                id,
                user_id,
                token_hash,
                expires_at,
                created_at
            )
            VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
            sessionId,
            userId,
            tokenHash,
            expiresAt,
            now
        )
        .run();


    return {
        id: sessionId,
        token,
        expiresAt
    };

}


/* =========================================================
   GET /api/me
   ========================================================= */

async function getCurrentUser(
    request,
    env
) {

    const token =
        getSessionToken(
            request
        );


    if (!token) {

        return json(
            {
                success: false,
                authenticated: false
            },
            401,
            request
        );

    }


    const tokenHash =
        await sha256(
            token
        );


    const now =
        Math.floor(
            Date.now() / 1000
        );


    let user;


    try {

        user =
            await env.DB
                .prepare(`
                    SELECT
                        users.id,
                        users.name,
                        users.email,
                        sessions.id AS session_id,
                        sessions.expires_at
                    FROM sessions
                    INNER JOIN users
                        ON users.id = sessions.user_id
                    WHERE
                        sessions.token_hash = ?
                        AND sessions.expires_at > ?
                    L                    IMIT 1
                `)
                .bind(
                    tokenHash,
                    now
                )
                .first();

    } catch (error) {

        console.error(
            "Session lookup failed:",
            error
        );

        return json(
            {
                success: false,
                message:
                    "Unable to verify session."
            },
            500,
            request
        );

    }


    /* -------------------------------------------------------
       SESSION INVALID / EXPIRED
       ------------------------------------------------------- */

    if (!user) {

        return json(
            {
                success: false,
                authenticated: false
            },
            401,
            request
        );

    }


    /* -------------------------------------------------------
       SUCCESS
       ------------------------------------------------------- */

    return json(
        {
            success: true,
            authenticated: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            session: {
                expiresAt:
                    user.expires_at
            }
        },
        200,
        request
    );

}


/* =========================================================
   POST /api/logout
   ========================================================= */

async function logout(
    request,
    env
) {

    const token =
        getSessionToken(
            request
        );


    /*
     * Mesmo sem sessão, limpamos o cookie.
     */

    if (!token) {

        return json(
            {
                success: true,
                message:
                    "Logged out successfully."
            },
            200,
            request,
            {
                "Set-Cookie":
                    clearSessionCookie()
            }
        );

    }


    const tokenHash =
        await sha256(
            token
        );


    /* -------------------------------------------------------
       DELETE SESSION
       ------------------------------------------------------- */

    try {

        await env.DB
            .prepare(`
                DELETE FROM sessions
                WHERE token_hash = ?
            `)
            .bind(
                tokenHash
            )
            .run();

    } catch (error) {

        console.error(
            "Logout failed:",
            error
        );

        return json(
            {
                success: false,
                message:
                    "Unable to log out."
            },
            500,
            request
        );

    }


    /* -------------------------------------------------------
       CLEAR COOKIE
       ------------------------------------------------------- */

    return json(
        {
            success: true,
            message:
                "Logged out successfully."
        },
        200,
        request,
        {
            "Set-Cookie":
                clearSessionCookie()
        }
    );

}


/* =========================================================
   GET SESSION TOKEN
   ========================================================= */

function getSessionToken(
    request
) {

    const cookieHeader =
        request.headers.get(
            "Cookie"
        );


    if (!cookieHeader) {

        return null;

    }


    const cookies =
        parseCookies(
            cookieHeader
        );


    return cookies.nexauren_session ||
        null;

}


/* =========================================================
   PARSE COOKIES
   ========================================================= */

function parseCookies(
    cookieHeader
) {

    const cookies = {};


    const parts =
        cookieHeader.split(";");


    for (
        const part of parts
    ) {

        const index =
            part.indexOf("=");


        if (index === -1) {

            continue;

        }


        const name =
            part
                .slice(0, index)
                .trim();


        const value =
            part
                .slice(index + 1)
                .trim();


        if (!name) {

            continue;

        }


        try {

            cookies[name] =
                decodeURIComponent(
                    value
                );

        } catch {

            cookies[name] =
                value;

        }

    }


    return cookies;

}


/* =========================================================
   SESSION COOKIE
   ========================================================= */

function buildSessionCookie(
    token
) {

    return [
        "nexauren_session=" +
            encodeURIComponent(token),

        "Path=/",

        "HttpOnly",

        "Secure",

        "SameSite=Lax",

        `Max-Age=${SESSION_DURATION_SECONDS}`
    ].join("; ");

}


/* =========================================================
   CLEAR SESSION COOKIE
   ========================================================= */

function clearSessionCookie() {

    return [
        "nexauren_session=",

        "Path=/",

        "HttpOnly",

        "Secure",

        "SameSite=Lax",

        "Max-Age=0"
    ].join("; ");

}


/* =========================================================
   SHA-256
   ========================================================= */

async function sha256(
    value
) {

    const encoder =
        new TextEncoder();


    const data =
        encoder.encode(
            value
        );


    const hashBuffer =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );


    return bytesToBase64Url(
        new Uint8Array(
            hashBuffer
        )
    );

}


/* =========================================================
   VERIFY PASSWORD
   ========================================================= */

async function verifyPassword(
    password,
    storedHash
) {

    if (
        typeof storedHash !== "string"
    ) {

        return false;

    }


    const parts =
        storedHash.split("$");


    if (
        parts.length !== 4
    ) {

        return false;

    }


    const algorithm =
        parts[0];


    const iterations =
        Number(
            parts[1]
        );


    const salt =
        base64UrlToBytes(
            parts[2]
        );


    const expectedHash =
        base64UrlToBytes(
            parts[3]
        );


    if (
        algorithm !== "pbkdf2" ||
        !Number.isInteger(iterations) ||
        iterations <= 0 ||
        !salt ||
        !expectedHash
    ) {

        return false;

    }


    const encoder =
        new TextEncoder();


    const passwordBytes =
        encoder.encode(
            password
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
                salt: salt,
                iterations: iterations,
                hash: "SHA-256"
            },
            key,
            expectedHash.length * 8
        );


    const actualHash =
        new Uint8Array(
            derivedBits
        );


    return constantTimeEqual(
        actualHash,
        expectedHash
    );

}


/* =========================================================
   CONSTANT-TIME COMPARISON
   ========================================================= */

function constantTimeEqual(
    a,
    b
) {

    if (
        !(a instanceof Uint8Array) ||
        !(b instanceof Uint8Array)
    ) {

        return false;

    }


    if (
        a.length !== b.length
    ) {

        return false;

    }


    let difference = 0;


    for (
        let i = 0;
        i < a.length;
        i++
    ) {

        difference |=
            a[i] ^ b[i];

    }


    return difference === 0;

}


/* =========================================================
   BASE64URL → BYTES
   ========================================================= */

function base64UrlToBytes(
    value
) {

    try {

        let base64 =
            value
                .replace(
                    /-/g,
                    "+"
                )
                .replace(
                    /_/g,
                    "/"
                );


        while (
            base64.length % 4 !== 0
        ) {

            base64 += "=";

        }


        const binary =
            atob(
                base64
            );


        const bytes =
            new Uint8Array(
                binary.length
            );


        for (
            let i = 0;
            i < binary.length;
            i++
        ) {

            bytes[i] =
                binary.charCodeAt(i);

        }


        return bytes;

    } catch {

        return null;

    }

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
            status: status,
            headers: headers
        }
    );

}


/* =========================================================
   BYTES → BASE64URL
   ========================================================= */

function bytesToBase64Url(
    bytes
) {

    let binary = "";


    for (
        const byte of bytes
    ) {

        binary +=
            String.fromCharCode(
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
