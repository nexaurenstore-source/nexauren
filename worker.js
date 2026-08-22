/*
 * =========================================================
 * NEXAUREN
 * CLOUDFLARE WORKER
 * =========================================================
 *
 * API:
 *
 * GET  /api
 * GET  /api/health
 *
 * POST /api/register
 * POST /api/login
 * GET  /api/me
 * POST /api/logout
 *
 * FRONTEND ROUTES:
 *
 * /
 * /login
 * /register
 * /forgot-password
 * /dashboard
 *
 * D1:
 * - users
 * - sessions
 *
 * =========================================================
 */

"use strict";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const SESSION_DURATION_SECONDS =
    60 * 60 * 24 * 7;


const MAX_NAME_LENGTH =
    100;


const MAX_EMAIL_LENGTH =
    254;


const MIN_PASSWORD_LENGTH =
    8;


const MAX_PASSWORD_LENGTH =
    200;


const PBKDF2_ITERATIONS =
    100000;


/* =========================================================
   MAIN WORKER
   ========================================================= */

export default {

    async fetch(request, env) {

        try {

            const url =
                new URL(
                    request.url
                );


            /* =================================================
               CORS / PREFLIGHT
               ================================================= */

            if (
                request.method === "OPTIONS"
            ) {

                return handleOptions(
                    request
                );

            }


            /* =================================================
               API
               ================================================= */

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


            /* =================================================
               FRONTEND ROUTES
               ================================================= */

            return await handleFrontendRequest(
                request,
                env,
                url
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
/* =========================================================
   FRONTEND ROUTER
   ========================================================= */

async function handleFrontendRequest(
    request,
    env,
    url
) {
    /*
     * Only handle normal browser requests.
     */

    if (
        request.method !== "GET" &&
        request.method !== "HEAD"
    ) {
        return env.ASSETS.fetch(request);
    }

    const pathname = url.pathname;

    /*
     * Public routes
     * These routes can be accessed without authentication.
     */
    const publicRoutes = [
        "/",
        "/login",
        "/register",
        "/signup",
        "/forgot-password",
        "/reset-password"
    ];

    const isPublicRoute =
        publicRoutes.includes(pathname);

    /*
     * Static files should also remain accessible.
     */
    const isStaticFile =
        pathname.startsWith("/assets/") ||
        pathname.startsWith("/static/") ||
        pathname.startsWith("/favicon") ||
        pathname.includes(".");

    /*
     * Allow public pages and static resources.
     */
    if (isPublicRoute || isStaticFile) {
        return env.ASSETS.fetch(request);
    }

    /*
     * Get authentication cookie.
     */
    const cookieHeader =
        request.headers.get("Cookie") || "";

    /*
     * Example:
     * session=<token>
     */
    const sessionMatch =
        cookieHeader.match(
            /(?:^|;\s*)session=([^;]+)/
        );

    const sessionToken =
        sessionMatch?.[1];

    /*
     * No session -> send user to login.
     */
    if (!sessionToken) {
        const loginURL = new URL(
            "/login",
            request.url
        );

        loginURL.searchParams.set(
            "redirect",
            pathname
        );

        return Response.redirect(
            loginURL.toString(),
            302
        );
    }

    /*
     * IMPORTANT:
     * Here we must validate the session
     * against your authentication system.
     *
     * Do NOT trust only the existence of
     * the cookie.
     */

    const user = await validateSession(
        sessionToken,
        env
    );

    /*
     * Invalid/expired session.
     */
    if (!user) {
        const loginURL = new URL(
            "/login",
            request.url
        );

        loginURL.searchParams.set(
            "redirect",
            pathname
        );

        return Response.redirect(
            loginURL.toString(),
            302
        );
    }

    /*
     * Authenticated user.
     */
    return env.ASSETS.fetch(request);
}


/*
 * Validate the session.
 *
 * This function must be connected to
 * your real authentication/database system.
 */
async function validateSession(
    token,
    env
) {
    if (!token) {
        return null;
    }

    /*
     * Example using Cloudflare KV.
     *
     * If your project uses another system
     * such as D1, we should replace this.
     */
    const sessionData =
        await env.SESSIONS.get(
            `session:${token}`,
            "json"
        );

    if (!sessionData) {
        return null;
    }

    /*
     * Optional expiration check.
     */
    if (
        sessionData.expiresAt &&
        Date.now() >= sessionData.expiresAt
    ) {
        await env.SESSIONS.delete(
            `session:${token}`
        );

        return null;
    }

    return sessionData;
       }


    /* =====================================================
       PROTECTED TOOLS
       =====================================================

       Every route under /tools/ requires
       a valid authenticated session.

       Examples:

       /tools/
       /tools/image/
       /tools/image/compressor/
       /tools/image/resizer/
       /tools/pdf/
       /tools/pdf/compressor/

    ===================================================== */

    const isProtectedTool =
        pathname === "/tools" ||
        pathname.startsWith("/tools/");


    if (isProtectedTool) {

        const token =
            getSessionToken(
                request
            );


        let authenticatedUser =
            null;


        /*
         * Validate session.
         */

        if (token) {

            try {

                authenticatedUser =
                    await findSession(
                        env,
                        token
                    );

            } catch (error) {

                console.error(
                    "Tool session validation error:",
                    error
                );

            }

        }


        /*
         * No valid session.
         *
         * Redirect to login.
         */

        if (!authenticatedUser) {

            const loginUrl =
                new URL(
                    "/login",
                    request.url
                );


            /*
             * Remember the original
             * destination.
             */

            loginUrl.searchParams.set(
                "next",
                pathname + url.search
            );


            const headers =
                new Headers();


            headers.set(
                "Location",
                loginUrl.toString()
            );


            /*
             * Do not cache authentication
             * redirects.
             */

            headers.set(
                "Cache-Control",
                "no-store"
            );


            /*
             * If the user had an invalid
             * session cookie, remove it.
             */

            if (token) {

                headers.set(
                    "Set-Cookie",
                    clearSessionCookie(
                        request
                    )
                );

            }


            return new Response(
                null,
                {
                    status: 302,
                    headers
                }
            );

        }

    }


    /* =====================================================
       BEAUTIFUL ROUTES
       ===================================================== */

    const routes = {

        "/login":
            "/pages/login.html",

        "/register":
            "/pages/register.html",

        "/forgot-password":
            "/pages/forgot-password.html",

        "/dashboard":
            "/pages/dashboard.html"

    };


    const target =
        routes[pathname];


    if (target) {

        const assetURL =
            new URL(
                target,
                request.url
            );


        const assetRequest =
            new Request(
                assetURL.toString(),
                request
            );


        return env.ASSETS.fetch(
            assetRequest
        );

    }


    /* =====================================================
       TRAILING SLASH ROUTES
       ===================================================== */

    if (
        pathname.length > 1 &&
        pathname.endsWith("/")
    ) {

        const withoutSlash =
            pathname.slice(
                0,
                -1
            );


        const slashTarget =
            routes[withoutSlash];


        if (slashTarget) {

            const assetURL =
                new URL(
                    slashTarget,
                    request.url
                );


            const assetRequest =
                new Request(
                    assetURL.toString(),
                    request
                );


            return env.ASSETS.fetch(
                assetRequest
            );

        }

    }


    /* =====================================================
       NORMAL ASSETS
       =====================================================

       CSS
       JavaScript
       Images
       Favicon
       HTML
       Other static assets
    ===================================================== */

    return env.ASSETS.fetch(
        request
    );

                   }
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


    /* =====================================================
       API STATUS
       ===================================================== */

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


    /* =====================================================
       HEALTH
       ===================================================== */

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


    /* =====================================================
       REGISTER
       ===================================================== */

    if (
        path === "/api/register" &&
        request.method === "POST"
    ) {

        return register(
            request,
            env
        );

    }


    /* =====================================================
       LOGIN
       ===================================================== */

    if (
        path === "/api/login" &&
        request.method === "POST"
    ) {

        return login(
            request,
            env
        );

    }


    /* =====================================================
       CURRENT USER
       ===================================================== */

    if (
        path === "/api/me" &&
        request.method === "GET"
    ) {

        return getCurrentUser(
            request,
            env
        );

    }


    /* =====================================================
       LOGOUT
       ===================================================== */

    if (
        path === "/api/logout" &&
        request.method === "POST"
    ) {

        return logout(
            request,
            env
        );

    }


    /* =====================================================
       API NOT FOUND
       ===================================================== */

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


    /* =====================================================
       NAME
       ===================================================== */

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


    /* =====================================================
       EMAIL
       ===================================================== */

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


    /* =====================================================
       PASSWORD
       ===================================================== */

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


    /* =====================================================
       CHECK EXISTING USER
       ===================================================== */

    try {

        const existingUser =
            await env.DB
                .prepare(`
                    SELECT id
                    FROM users
                    WHERE email = ?
                    LIMIT 1
                `)
                .bind(
                    email
                )
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


    /* =====================================================
       HASH PASSWORD
       ===================================================== */

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


    /* =====================================================
       USER
       ===================================================== */

    const userId =
        crypto.randomUUID();


    const now =
        Math.floor(
            Date.now() / 1000
        );


    /* =====================================================
       INSERT USER
       ===================================================== */

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


    /* =====================================================
       SUCCESS
       ===================================================== */

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
                .bind(
                    email
                )
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


    const cookie =
        buildSessionCookie(
            session.token,
            request
        );


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
        id:
            sessionId,

        token:
            token,

        expiresAt:
            expiresAt
    };

}


/* =========================================================
   CURRENT USER
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


        let sessionData;


    try {

        sessionData =
            await findSession(
                env,
                token
            );

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


    if (!sessionData) {

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


    return json(
        {
            success: true,
            authenticated: true,
            user: {
                id:
                    sessionData.id,

                name:
                    sessionData.name,

                email:
                    sessionData.email
            }
        },
        200,
        request
    );

}


/* =========================================================
   FIND SESSION
   ========================================================= */

async function findSession(
    env,
    token
) {

    const tokenHash =
        await sha256(
            token
        );


    const now =
        Math.floor(
            Date.now() / 1000
        );


    const result =
        await env.DB
            .prepare(`
                SELECT
                    sessions.id AS session_id,
                    sessions.user_id AS user_id,
                    sessions.expires_at AS expires_at,
                    users.id AS id,
                    users.name AS name,
                    users.email AS email
                FROM sessions
                INNER JOIN users
                    ON users.id = sessions.user_id
                WHERE sessions.token_hash = ?
                  AND sessions.expires_at > ?
                LIMIT 1
            `)
            .bind(
                tokenHash,
                now
            )
            .first();


    if (!result) {

        /*
         * Remove expired session if one exists.
         */

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
                "Expired session cleanup error:",
                error
            );

        }


        return null;

    }


    return result;

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout(
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


    const token =
        getSessionToken(
            request
        );


    if (token) {

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
                "Logout error:",
                error
            );


            return json(
                {
                    success: false,
                    message:
                        "Unable to sign out."
                },
                500,
                request
            );

        }

    }


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


    const key =
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

                salt:
                    salt,

                iterations:
                    PBKDF2_ITERATIONS,

                hash:
                    "SHA-256"
            },
            key,
            256
        );


    const hash =
        new Uint8Array(
            derivedBits
        );


    /*
     * Format:
     *
     * pbkdf2_sha256$iterations$salt$hash
     */

    return [
        "pbkdf2_sha256",
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
        algorithm !==
        "pbkdf2_sha256"
    ) {

        return false;

    }


    if (
        !Number.isInteger(iterations) ||
        iterations < 10000 ||
        iterations > 1000000
    ) {

        return false;

    }


    if (
        !salt.length ||
        !expectedHash.length
    ) {

        return false;

    }


    const key =
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

                salt:
                    salt,

                iterations:
                    iterations,

                hash:
                    "SHA-256"
            },
            key,
            expectedHash.length * 8
        );


    const actualHash =
        new Uint8Array(
            derivedBits
        );


    return timingSafeEqual(
        actualHash,
        expectedHash
    );

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


    const digest =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );


    return bytesToBase64Url(
        new Uint8Array(
            digest
        )
    );

}


/* =========================================================
   CONSTANT-TIME COMPARISON
   ========================================================= */

function timingSafeEqual(
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
        a.length !==
        b.length
    ) {

        return false;

    }


    let difference =
        0;


    for (
        let index = 0;
        index < a.length;
        index++
    ) {

        difference |=
            a[index] ^
            b[index];

    }


    return difference === 0;

}


/* =========================================================
   BASE64URL
   ========================================================= */

function bytesToBase64Url(
    bytes
) {

    let binary =
        "";


    for (
        let index = 0;
        index < bytes.length;
        index++
    ) {

        binary +=
            String.fromCharCode(
                bytes[index]
            );

    }


    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

}


/* =========================================================
   BASE64URL TO BYTES
   ========================================================= */

function base64UrlToBytes(
    value
) {

    try {

        const normalized =
            String(value)
                .replace(/-/g, "+")
                .replace(/_/g, "/");


        const padding =
            normalized.length % 4;


        const padded =
            padding
                ? normalized +
                  "=".repeat(
                      4 - padding
                  )
                : normalized;


        const binary =
            atob(
                padded
            );


        const bytes =
            new Uint8Array(
                binary.length
            );


        for (
            let index = 0;
            index < binary.length;
            index++
        ) {

            bytes[index] =
                binary.charCodeAt(
                    index
                );

        }


        return bytes;

    } catch {

        return new Uint8Array();

    }

}


/* =========================================================
   SESSION COOKIE
   ========================================================= */

function buildSessionCookie(
    token,
    request
) {

    const secure =
        isSecureRequest(
            request
        );


    const parts = [
        `nexauren_session=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${SESSION_DURATION_SECONDS}`
    ];


    if (secure) {

        parts.push(
            "Secure"
        );

    }


    return parts.join(
        "; "
    );

}


/* =========================================================
   CLEAR SESSION COOKIE
   ========================================================= */

function clearSessionCookie(
    request
) {

    const secure =
        isSecureRequest(
            request
        );


    const parts = [
        "nexauren_session=",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0",
        "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    ];


    if (secure) {

        parts.push(
            "Secure"
        );

    }


    return parts.join(
        "; "
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


    const token =
        cookies.nexauren_session;


    if (
        !token ||
        typeof token !== "string"
    ) {

        return null;

    }


    return token;

}


/* =========================================================
   PARSE COOKIES
   ========================================================= */

function parseCookies(
    header
) {

    const cookies = {};


    String(header)
        .split(";")
        .forEach(
            part => {

                const index =
                    part.indexOf("=");


                if (
                    index === -1
                ) {

                    return;

                }


                const name =
                    part
                        .slice(
                            0,
                            index
                        )
                        .trim();


                const value =
                    part
                        .slice(
                            index + 1
                        )
                        .trim();


                if (!name) {

                    return;

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
        );


    return cookies;

}


/* =========================================================
   SECURE REQUEST
   ========================================================= */

function isSecureRequest(
    request
) {

    try {

        return (
            new URL(
                request.url
            ).protocol ===
            "https:"
        );

    } catch {

        return true;

    }

}


/* =========================================================
   EMAIL VALIDATION
   ========================================================= */

function isValidEmail(
    email
) {

    if (
        typeof email !== "string"
    ) {

        return false;

    }


    if (
        email.length < 3 ||
        email.length > MAX_EMAIL_LENGTH
    ) {

        return false;

    }


    /*
     * Deliberately simple validation.
     * Full email validation is not practical
     * with a regular expression.
     */

    const pattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    return pattern.test(
        email
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
        "application/json; charset=utf-8"
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
        "Referrer-Policy",
        "same-origin"
    );


    const cors =
        getCorsHeaders(
            request
        );


    Object.entries(
        cors
    ).forEach(
        ([key, value]) => {

            headers.set(
                key,
                value
            );

        }
    );


    Object.entries(
        extraHeaders || {}
    ).forEach(
        ([key, value]) => {

            headers.set(
                key,
                value
            );

        }
    );


    return new Response(
        JSON.stringify(
            data
        ),
        {
            status,
            headers
        }
    );

}


/* =========================================================
   CORS
   ========================================================= */

function getCorsHeaders(
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


    if (!origin) {

        return headers;

    }


    let allowed = false;


    try {

        const requestURL =
            new URL(
                request.url
            );


        const originURL =
            new URL(
                origin
            );


        /*
         * Only allow the same origin by default.
         *
         * This prevents random external websites
         * from using the authentication API.
         */

        allowed =
            originURL.origin ===
            requestURL.origin;

    } catch {

        allowed = false;

    }


    if (!allowed) {

        return headers;

    }


    headers[
        "Access-Control-Allow-Origin"
    ] =
        origin;


    headers[
        "Access-Control-Allow-Credentials"
    ] =
        "true";


    headers[
        "Access-Control-Allow-Methods"
    ] =
        "GET, POST, OPTIONS";


    headers[
        "Access-Control-Allow-Headers"
    ] =
        "Content-Type";


    headers[
        "Vary"
    ] =
        "Origin";


    return headers;

}


/* =========================================================
   OPTIONS
   ========================================================= */

function handleOptions(
    request
) {

    const headers =
        new Headers();


    const cors =
        getCorsHeaders(
            request
        );


    Object.entries(
        cors
    ).forEach(
        ([key, value]) => {

            headers.set(
                key,
                value
            );

        }
    );


    headers.set(
        "Access-Control-Max-Age",
        "86400"
    );


    return new Response(
        null,
        {
            status: 204,
            headers
        }
    );

               }
