/*
 * =========================================================
 * NEXAUREN
 * CLOUDFLARE WORKER — V1
 *
 * Simples:
 *
 * GET  /api
 * GET  /api/health
 *
 * POST /api/register
 * POST /api/login
 * GET  /api/me
 * POST /api/logout
 *
 * D1:
 * - users
 * - sessions
 * =========================================================
 */

"use strict";


/* =========================================================
   CONFIGURAÇÃO
   ========================================================= */

const SESSION_DURATION_SECONDS =
    60 * 60 * 24 * 7; // 7 dias


const MAX_NAME_LENGTH = 100;

const MAX_EMAIL_LENGTH = 254;

const MIN_PASSWORD_LENGTH = 8;

const MAX_PASSWORD_LENGTH = 200;


/*
 * PBKDF2
 *
 * A senha nunca é armazenada diretamente.
 */

const PBKDF2_ITERATIONS = 100000;


/* =========================================================
   MAIN WORKER
   ========================================================= */

export default {

    async fetch(request, env) {

        try {

            const url =
                new URL(request.url);


            /*
             * CORS
             */

            if (
                request.method === "OPTIONS"
            ) {

                return handleOptions(
                    request
                );

            }


            /*
             * API
             */

            if (
                url.pathname === "/api" ||
                url.pathname.startsWith("/api/")
            ) {

                return await handleApiRequest(
                    request,
                    env,
                    url
                );

            }


            /*
             * FRONTEND
             */

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
    url
) {

    const path =
        url.pathname;


    /*
     * API STATUS
     */

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


    /*
     * HEALTH
     */

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


    /*
     * REGISTER
     */

    if (
        path === "/api/register" &&
        request.method === "POST"
    ) {

        return register(
            request,
            env
        );

    }


    /*
     * LOGIN
     */

    if (
        path === "/api/login" &&
        request.method === "POST"
    ) {

        return login(
            request,
            env
        );

    }


    /*
     * CURRENT USER
     */

    if (
        path === "/api/me" &&
        request.method === "GET"
    ) {

        return getCurrentUser(
            request,
            env
        );

    }


    /*
     * LOGOUT
     */

    if (
        path === "/api/logout" &&
        request.method === "POST"
    ) {

        return logout(
            request,
            env
        );

    }


    /*
     * NOT FOUND
     */

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


    let data;


    /*
     * JSON
     */

    try {

        data =
            await request.json();

    } catch {

        return json(
            {
                success: false,
                message:
                    "Invalid request."
            },
            400,
            request
        );

    }


    /*
     * INPUT
     */

    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {

        return json(
            {
                success: false,
                message:
                    "Invalid request."
            },
            400,
            request
        );

    }


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


    /*
     * NAME
     */

    if (
        !name ||
        name.length > MAX_NAME_LENGTH
    ) {

        return json(
            {
                success: false,
                message:
                    "Please enter a valid name."
            },
            400,
            request
        );

    }


    /*
     * EMAIL
     */

    if (
        !email ||
        email.length > MAX_EMAIL_LENGTH ||
        !isValidEmail(email)
    ) {

        return json(
            {
                success: false,
                message:
                    "Please enter a valid email."
            },
            400,
            request
        );

    }


    /*
     * PASSWORD
     */

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


    /*
     * CHECK EXISTING USER
     */

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
            "User lookup error:",
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


    /*
     * HASH PASSWORD
     */

    let passwordHash;


    try {

        passwordHash =
            await hashPassword(
                password
            );

    } catch (error) {

        console.error(
            "Password hashing error:",
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


    /*
     * USER
     */

    const userId =
        crypto.randomUUID();


    const now =
        Math.floor(
            Date.now() / 1000
        );


    /*
     * INSERT USER
     */

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
            "User creation error:",
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


    /*
     * SUCCESS
     */

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


    let data;


    try {

        data =
            await request.json();

    } catch {

        return json(
            {
                success: false,
                message:
                    "Invalid request."
            },
            400,
            request
        );

    }


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


    /*
     * BASIC VALIDATION
     */

    if (
        !email ||
        !isValidEmail(email) ||
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


    /*
     * FIND USER
     */

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
            "Login database error:",
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


    /*
     * USER NOT FOUND
     */

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


    /*
     * VERIFY PASSWORD
     */

    let validPassword;


    try {

        validPassword =
            await verifyPassword(
                password,
                user.password_hash
            );

    } catch (error) {

        console.error(
            "Password verification error:",
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


    /*
     * CREATE SESSION
     */

    let session;


    try {

        session =
            await createSession(
                env,
                user.id
            );

    } catch (error) {

        console.error(
            "Session creation error:",
            error
        );

        return json(
            {
                success: false,
                message:
                    "Unable to create session."
            },
            500,
            request
        );

    }


    /*
     * COOKIE
     */

    const cookie =
        buildSessionCookie(
            session.token,
            request
        );


    /*
     * SUCCESS
     */

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
            "Set-Cookie":
                cookie
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
   GET CURRENT USER
   ========================================================= */

async function getCurrentUser(
    request,
    env
) {

    if (!env.DB) {

        return json(
            {
                success: false,
                authenticated: false,
                message:
                    "Database is not configured."
            },
            500,
            request
        );

    }


    const token =
        getSessionToken(
            request
        );


    /*
     * NO SESSION
     */

    if (!token) {

        return json(
            {
                success: true,
                authenticated: false
            },
            200,
            request
        );

    }


    /*
     * HASH TOKEN
     */

    let tokenHash;


    try {

        tokenHash =
            await sha256(
                token
            );

    } catch {

        return json(
            {
                success: false,
                authenticated: false,
                message:
                    "Unable to verify session."
            },
            500,
            request
        );

    }


    /*
     * CURRENT TIME
     */

    const now =
        Math.floor(
            Date.now() / 1000
        );


    /*
     * FIND SESSION + USER
     *
     * IMPORTANTE:
     * LIMIT 1
     */

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
                    LIMIT 1
                `)
                .bind(
                    tokenHash,
                    now
                )
                .first();

    } catch (error) {

        console.error(
            "Session lookup error:",
            error
        );

        return json(
            {
                success: false,
                authenticated: false,
                message:
                    "Unable to verify session."
            },
            500,
            request
        );

    }


    /*
     * SESSION INVALID / EXPIRED
     */

    if (!user) {

        return json(
            {
                success: true,
                authenticated: false
            },
            200,
            request,
            {
                "Set-Cookie":
                    clearSessionCookie(
                        request
                    )
            }
        );

    }


    /*
     * AUTHENTICATED
     */

    return json(
        {
            success: true,
            authenticated: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        },
        200,
        request
    );

}


/* =========================================================
   LOGOUT
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
     * Já não existe sessão.
     */

    if (!token) {

        return json(
            {
                success: true,
                message:
                    "Signed out."
            },
            200,
            request,
            {
                "Set-Cookie":
                    clearSessionCookie(
                        request
                    )
            }
        );

    }


    if (env.DB) {

        try {

            const tokenHash =
                await sha256(
                    token
                );


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
                "Logout database error:",
                error
            );

        }

    }


    /*
     * CLEAR COOKIE
     */

    return json(
        {
            success: true,
            message:
                "Signed out successfully."
        },
        200,
        request,
        {
            "Set-Cookie":
                clearSessionCookie(
                    request
                )
        }
    );

}


/* =========================================================
   PASSWORD HASHING
   ========================================================= */

async function hashPassword(
    password
) {

    const salt =
        crypto.getRandomValues(
            new Uint8Array(16)
        );


    const passwordKey =
        await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(
                password
            ),
            {
                name:
                    "PBKDF2"
            },
            false,
            [
                "deriveBits"
            ]
        );


    const derivedBits =
        await crypto.subtle.deriveBits(
            {
                name:
                    "PBKDF2",

                salt,

                iterations:
                    PBKDF2_ITERATIONS,

                hash:
                    "SHA-256"
            },

            passwordKey,

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
   PASSWORD VERIFICATION
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
        parts.length !== 4 ||
        parts[0] !== "pbkdf2"
    ) {

        return false;

    }


    const iterations =
        Number(parts[1]);


    const salt =
        base64UrlToBytes(
            parts[2]
        );


    const expectedHash =
        base64UrlToBytes(
            parts[3]
        );


    if (
        !Number.isInteger(iterations) ||
        iterations <= 0 ||
        !salt ||
        !expectedHash
    ) {

        return false;

    }


    const passwordKey =
        await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(
                password
            ),
            {
                name:
                    "PBKDF2"
            },
            false,
            [
                "deriveBits"
            ]
        );


    const derivedBits =
        await crypto.subtle.deriveBits(
            {
                name:
                    "PBKDF2",

                salt,

                iterations,

                hash:
                    "SHA-256"
            },

            passwordKey,

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
   SESSION COOKIE
   ========================================================= */

function buildSessionCookie(
    token,
    request
) {

    const url =
        new URL(
            request.url
        );


    const secure =
        url.protocol === "https:"
            ? "; Secure"
            : "";


    return [
        `nexauren_session=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${SESSION_DURATION_SECONDS}`,
        secure
    ].join("; ");

}


/* =========================================================
   CLEAR SESSION COOKIE
   ========================================================= */

function clearSessionCookie(
    request
) {

    const url =
        new URL(
            request.url
        );


    const secure =
        url.protocol === "https:"
            ? "; Secure"
            : "";


    return [
        "nexauren_session=",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0",
        secure
    ].join("; ");

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


    return cookies[
        "nexauren_session"
    ] || null;

}


/* =========================================================
   COOKIE PARSER
   ========================================================= */

function parseCookies(
    header
) {

    const cookies = {};


    for (
        const part of header.split(";")
    ) {

        const index =
            part.indexOf("=");


        if (index === -1) {

            continue;

        }


        const key =
            part
                .slice(0, index)
                .trim();


        const value =
            part
                .slice(index + 1)
                .trim();


        if (!key) {

            continue;

        }


        try {

            cookies[key] =
                decodeURIComponent(
                    value
                );

        } catch {

            cookies[key] =
                value;

        }

    }


    return cookies;

}


/* =========================================================
   SHA-256
   ========================================================= */

async function sha256(
    value
) {

    const data =
        new TextEncoder().encode(
            value
        );


    const hash =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );


    return bytesToBase64Url(
        new Uint8Array(
            hash
        )
    );

}


/* =========================================================
   EMAIL VALIDATION
   ========================================================= */

function isValidEmail(
    email
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);

}


/* =========================================================
   CONSTANT-TIME COMPARE
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
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

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
                .replace(/-/g, "+")
                .replace(/_/g, "/");


        while (
            base64.length % 4
        ) {

            base64 += "=";

        }


        const binary =
            atob(base64);


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
   OPTIONS / CORS
   ========================================================= */

function handleOptions(
    request
) {

    const headers =
        corsHeaders(
            request
        );


    return new Response(
        null,
        {
            status: 204,
            headers
        }
    );

}


/* =========================================================
   JSON RESPONSE
   ========================================================= */

function json(
    data,
    status = 200,
    request = null,
    extraHeaders = {}
) {

    const headers =
        new Headers();


    headers.set(
        "Content-Type",
        "application/json; charset=UTF-8"
    );


    headers.set(
        "Cache-Control",
        "no-store"
    );


    headers.set(
        "X-Content-Type-Options",
        "nosniff"
    );


    headers.set(
        "X-Frame-Options",
        "DENY"
    );


    headers.set(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
    );


    const cors =
        corsHeaders(
            request
        );


    for (
        const [key, value]
        of Object.entries(cors)
    ) {

        headers.set(
            key,
            value
        );

    }


    for (
        const [key, value]
        of Object.entries(extraHeaders)
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
   CORS HEADERS
   ========================================================= */

function corsHeaders(
    request
) {

    const headers = {};


    if (!request) {

        return headers;

    }


    const origin =
        request.headers.get(
            "Origin"
        );


    const allowed =
        origin === "https://nexaurenstory.com" ||
        origin === "http://localhost:8787" ||
        origin === "http://127.0.0.1:8787";


    if (allowed) {

        headers[
            "Access-Control-Allow-Origin"
        ] = origin;


        headers[
            "Access-Control-Allow-Credentials"
        ] = "true";


        headers[
            "Access-Control-Allow-Methods"
        ] = "GET, POST, OPTIONS";


        headers[
            "Access-Control-Allow-Headers"
        ] = "Content-Type";


        headers[
            "Vary"
        ] = "Origin";

    }


    return headers;

}
