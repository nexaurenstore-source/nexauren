/*
 * =========================================================
 * NEXAUREN
 * CLOUDFLARE WORKER
 * =========================================================
 *
 * FRONTEND
 *
 * /
 * /login
 * /register
 * /signup
 * /forgot-password
 * /reset-password
 * /dashboard
 * /tools/*
 *
 * API
 *
 * GET  /api
 * GET  /api/health
 *
 * POST /api/register
 * POST /api/login
 * GET  /api/me
 * POST /api/logout
 *
 * D1
 *
 * users
 * sessions
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


/*
 * Login protection.
 *
 * This is intentionally lightweight and uses the
 * Cloudflare Cache API instead of requiring another D1 table.
 *
 * It is only an additional layer.
 *
 * Real authentication still depends on D1 sessions.
 */

const LOGIN_RATE_WINDOW_SECONDS =
    15 * 60;

const LOGIN_RATE_LIMIT =
    10;


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


            /*
             * =================================================
             * CORS / PREFLIGHT
             * =================================================
             */

            if (
                request.method === "OPTIONS"
            ) {

                return handleOptions(
                    request
                );

            }


            /*
             * =================================================
             * API
             * =================================================
             */

            if (
                url.pathname === "/api" ||
                url.pathname.startsWith("/api/")
            ) {

                const response =
                    await handleApiRequest(
                        request,
                        env,
                        url
                    );

                return applySecurityHeaders(
                    response
                );

            }


            /*
             * =================================================
             * FRONTEND
             * =================================================
             */

            const response =
                await handleFrontendRequest(
                    request,
                    env,
                    url
                );

            return applySecurityHeaders(
                response
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
   FRONTEND ROUTER
   ========================================================= */

async function handleFrontendRequest(
    request,
    env,
    url
) {

    /*
     * Only GET and HEAD are frontend requests.
     */

    if (
        request.method !== "GET" &&
        request.method !== "HEAD"
    ) {

        return new Response(
            "Method Not Allowed",
            {
                status: 405,
                headers: {
                    "Allow":
                        "GET, HEAD, OPTIONS"
                }
            }
        );

    }


    const pathname =
        url.pathname;


    /*
     * =========================================================
     * PUBLIC ROUTES
     * =========================================================
     *
     * The landing page remains public.
     *
     * Authentication pages are public.
     *
     * Tools/dashboard are protected.
     */

    const publicRoutes =
        new Set([
            "/",
            "/login",
            "/register",
            "/signup",
            "/forgot-password",
            "/reset-password"
        ]);


    /*
     * =========================================================
     * PUBLIC HTML FILES
     * =========================================================
     */

    const publicHtmlFiles =
        new Set([
            "/pages/login.html",
            "/pages/register.html",
            "/pages/forgot-password.html",
            "/pages/reset-password.html",
            "/pages/signup.html"
        ]);


    /*
     * =========================================================
     * PRETTY URL MAP
     * =========================================================
     */

    const publicRoutesMap = {

        "/login":
            "/pages/login.html",

        "/register":
            "/pages/register.html",

        "/signup":
            "/pages/register.html",

        "/forgot-password":
            "/pages/forgot-password.html",

        "/reset-password":
            "/pages/reset-password.html"

    };


    /*
     * =========================================================
     * PROTECTED PRETTY ROUTES
     * =========================================================
     */

    const protectedRoutes = {

        "/dashboard":
            "/pages/dashboard.html"

    };


    /*
     * =========================================================
     * STATIC RESOURCES
     * =========================================================
     *
     * HTML is deliberately excluded.
     */

    const staticExtensions =
        /\.(?:css|js|mjs|map|png|jpg|jpeg|gif|webp|svg|ico|avif|bmp|woff|woff2|ttf|otf|eot|mp3|wav|ogg|mp4|webm|json|txt)$/i;


    const isStaticResource =
        staticExtensions.test(
            pathname
        ) ||
        pathname.startsWith(
            "/assets/"
        ) ||
        pathname.startsWith(
            "/static/"
        ) ||
        pathname.startsWith(
            "/favicon"
        );


    /*
     * =========================================================
     * PUBLIC PRETTY ROUTES
     * =========================================================
     */

    if (
        publicRoutes.has(
            pathname
        )
    ) {

        const target =
            publicRoutesMap[
                pathname
            ];


        if (target) {

            return fetchAsset(
                request,
                env,
                target
            );

        }


        /*
         * /
         */

        return env.ASSETS.fetch(
            request
        );

    }


    /*
     * =========================================================
     * PUBLIC AUTH HTML FILES
     * =========================================================
     */

    if (
        publicHtmlFiles.has(
            pathname
        )
    ) {

        return env.ASSETS.fetch(
            request
        );

    }


    /*
     * =========================================================
     * STATIC RESOURCES
     * =========================================================
     */

    if (
        isStaticResource
    ) {

        return env.ASSETS.fetch(
            request
        );

    }


    /*
     * =========================================================
     * GLOBAL AUTHENTICATION GATE
     * =========================================================
     *
     * Everything else is protected.
     *
     * This automatically protects future pages:
     *
     * /tools/...
     * /dashboard/...
     * /new-tool
     * /future-page
     */

    const authenticatedUser =
        await requireAuthenticatedUser(
            request,
            env
        );


    /*
     * =========================================================
     * NOT AUTHENTICATED
     * =========================================================
     */

    if (
        !authenticatedUser
    ) {

        return redirectToLogin(
            request,
            url
        );

    }


    /*
     * =========================================================
     * PROTECTED PRETTY ROUTES
     * =========================================================
     */

    const target =
        protectedRoutes[
            pathname
        ];


    if (target) {

        return fetchAsset(
            request,
            env,
            target
        );

    }


    /*
     * =========================================================
     * TRAILING SLASH
     * =========================================================
     */

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
            protectedRoutes[
                withoutSlash
            ];


        if (slashTarget) {

            return fetchAsset(
                request,
                env,
                slashTarget
            );

        }

    }


    /*
     * =========================================================
     * AUTHENTICATED FRONTEND RESOURCE
     * =========================================================
     */

    return env.ASSETS.fetch(
        request
    );

}


/* =========================================================
   FETCH FRONTEND ASSET
   ========================================================= */

function fetchAsset(
    request,
    env,
    pathname
) {

    const assetURL =
        new URL(
            pathname,
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


/* =========================================================
   REDIRECT TO LOGIN
   ========================================================= */

function redirectToLogin(
    request,
    url
) {

    const loginURL =
        new URL(
            "/login",
            request.url
        );


    /*
     * Preserve original destination.
     */

    const next =
        url.pathname +
        url.search;


    /*
     * Prevent absurdly large next parameters.
     */

    if (
        next.length <= 2000
    ) {

        loginURL.searchParams.set(
            "next",
            next
        );

    }


    const headers =
        new Headers();


    headers.set(
        "Location",
        loginURL.toString()
    );


    headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
    );


    headers.set(
        "Pragma",
        "no-cache"
    );


    /*
     * If the browser sent an invalid session,
     * remove it.
     */

    const token =
        getSessionToken(
            request
        );


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
     * =======================================================
     * API STATUS
     * =======================================================
     */

    if (
        path === "/api"
    ) {

        if (
            request.method !== "GET"
        ) {

            return methodNotAllowed(
                "GET"
            );

        }


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
     * =======================================================
     * HEALTH
     * =======================================================
     */

    if (
        path === "/api/health"
    ) {

        if (
            request.method !== "GET"
        ) {

            return methodNotAllowed(
                "GET"
            );

        }


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
     * =======================================================
     * REGISTER
     * =======================================================
     */

    if (
        path === "/api/register"
    ) {

        if (
            request.method !== "POST"
        ) {

            return methodNotAllowed(
                "POST"
            );

        }


        return register(
            request,
            env
        );

    }


    /*
     * =======================================================
     * LOGIN
     * =======================================================
     */

    if (
        path === "/api/login"
    ) {

        if (
            request.method !== "POST"
        ) {

            return methodNotAllowed(
                "POST"
            );

        }


        return login(
            request,
            env
        );

    }


    /*
     * =======================================================
     * CURRENT USER
     * =======================================================
     */

    if (
        path === "/api/me"
    ) {

        if (
            request.method !== "GET"
        ) {

            return methodNotAllowed(
                "GET"
            );

        }


        return getCurrentUser(
            request,
            env
        );

    }


    /*
     * =======================================================
     * LOGOUT
     * =======================================================
     */

    if (
        path === "/api/logout"
    ) {

        if (
            request.method !== "POST"
        ) {

            return methodNotAllowed(
                "POST"
            );

        }


        return logout(
            request,
            env
        );

    }


    /*
     * =======================================================
     * FUTURE PROTECTED APIs
     * =======================================================
     *
     * IMPORTANT:
     *
     * Any future API added below this section must use:
     *
     * requireAuthenticatedUser()
     *
     * before doing anything private.
     *
     * Example:
     *
     * if (path === "/api/tools/example") {
     *
     *     const user =
     *         await requireAuthenticatedUser(
     *             request,
     *             env
     *         );
     *
     *     if (!user) {
     *         return unauthorized(request);
     *     }
     *
     *     ...
     * }
     */


    /*
     * =======================================================
     * API NOT FOUND
     * =======================================================
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


    /*
     * NAME
     */

    if (
        !name ||
        name.length >
        MAX_NAME_LENGTH
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
        email.length >
        MAX_EMAIL_LENGTH ||
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
        password.length <
        MIN_PASSWORD_LENGTH ||
        password.length >
        MAX_PASSWORD_LENGTH
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
     * CREATE USER
     */

    const userId =
        crypto.randomUUID();


    const now =
        Math.floor(
            Date.now() / 1000
        );


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


    return json(
        {
            success: true,
            message:
                "Account created successfully.",

            user: {
                id:
                    userId,

                name:
                    name,

                email:
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


    /*
     * -------------------------------------------------------
     * RATE LIMIT
     * -------------------------------------------------------
     */

    const rateLimit =
        await checkLoginRateLimit(
            request
        );


    if (!rateLimit.allowed) {

        return json(
            {
                success: false,
                message:
                    "Too many login attempts. Please try again later."
            },
            429,
            request,
            {
                "Retry-After":
                    String(
                        rateLimit.retryAfter
                    )
            }
        );

    }


    /*
     * -------------------------------------------------------
     * READ BODY
     * -------------------------------------------------------
     */

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
     * -------------------------------------------------------
     * VALIDATION
     * -------------------------------------------------------
     */

    if (
        !email ||
        email.length >
            MAX_EMAIL_LENGTH ||
        !isValidEmail(email) ||
        !password ||
        password.length >
            MAX_PASSWORD_LENGTH
    ) {

        await recordLoginFailure(
            request
        );


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
     * -------------------------------------------------------
     * FIND USER
     * -------------------------------------------------------
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


    /*
     * -------------------------------------------------------
     * USER NOT FOUND
     * -------------------------------------------------------
     */

    if (!user) {

        await recordLoginFailure(
            request
        );


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
     * -------------------------------------------------------
     * VERIFY PASSWORD
     * -------------------------------------------------------
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

        await recordLoginFailure(
            request
        );


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
     * -------------------------------------------------------
     * SUCCESS
     * -------------------------------------------------------
     */

    await clearLoginFailures(
        request
    );


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
                id:
                    user.id,

                name:
                    user.name,

                email:
                    user.email
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

    /*
     * Generate cryptographically secure
     * random session token.
     */

    const tokenBytes =
        crypto.getRandomValues(
            new Uint8Array(32)
        );


    const token =
        bytesToBase64Url(
            tokenBytes
        );


    /*
     * Only the SHA-256 hash is stored
     * inside D1.
     */

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
   CENTRAL AUTHENTICATION
   =========================================================
 *
 * Esta é a função principal de autenticação.
 *
 * Qualquer página ou API privada pode utilizá-la.
 */

async function requireAuthenticatedUser(
    request,
    env
) {

    if (!env.DB) {

        return null;

    }


    const token =
        getSessionToken(
            request
        );


    if (!token) {

        return null;

    }


    try {

        return await findSession(
            env,
            token
        );

    } catch (error) {

        console.error(
            "Authentication lookup error:",
            error
        );

        return null;

    }

}


/* =========================================================
   UNAUTHORIZED
   ========================================================= */

function unauthorized(
    request
) {

    return json(
        {
            success: false,
            authenticated: false,
            message:
                "Authentication required."
        },
        401,
        request
    );

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


    const user =
        await requireAuthenticatedUser(
            request,
            env
        );


    /*
     * No session.
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
     * Authenticated.
     */

    return json(
        {
            success: true,

            authenticated: true,

            user: {

                id:
                    user.id,

                name:
                    user.name,

                email:
                    user.email

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
                    ON users.id =
                       sessions.user_id

                WHERE sessions.token_hash = ?
                  AND sessions.expires_at > ?

                LIMIT 1
            `)
            .bind(
                tokenHash,
                now
            )
            .first();


    /*
     * Session does not exist or expired.
     */

    if (!result) {

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
                "Session cleanup error:",
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


    /*
     * Remove session from D1.
     */

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


    /*
     * Remove browser cookie.
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


    return [
        "pbkdf2_sha256",

        PBKDF2_ITERATIONS,

        bytesToBase64Url(
            salt
        ),

        bytesToBase64Url(
            hash
        )

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
        typeof storedHash !==
        "string"
    ) {

        return false;

    }


    const parts =
        storedHash.split(
            "$"
        );


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
        !Number.isInteger(
            iterations
        ) ||
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
   BYTES -> BASE64URL
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


    return btoa(
        binary
    )
        .replace(
            /\+/g,
            "-"
        )
        .replace(
            /\//g,
            "_"
        )
        .replace(
            /=+$/g,
            ""
        );

}


/* =========================================================
   BASE64URL -> BYTES
   ========================================================= */

function base64UrlToBytes(
    value
) {

    try {

        const normalized =
            String(value)
                .replace(
                    /-/g,
                    "+"
                )
                .replace(
                    /_/g,
                    "/"
                );


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


    /*
     * O token original tem 32 bytes,
     * codificados em Base64URL.
     */

    if (
        token.length < 40 ||
        token.length > 100
    ) {

        return null;

    }


    /*
     * Apenas caracteres Base64URL.
     */

    if (
        !/^[A-Za-z0-9_-]+$/.test(
            token
        )
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
   SESSION COOKIE
   ========================================================= */

function buildSessionCookie(
    token,
    request
) {

    const parts = [

        `nexauren_session=${encodeURIComponent(token)}`,

        "Path=/",

        "HttpOnly",

        "Secure",

        "SameSite=Lax",

        `Max-Age=${SESSION_DURATION_SECONDS}`

    ];


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

    return [
        "nexauren_session=",
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Max-Age=0",
        "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    ].join(
        "; "
    );

}


/* =========================================================
   EMAIL VALIDATION
   ========================================================= */

function isValidEmail(
    email
) {

    if (
        typeof email !==
        "string"
    ) {

        return false;

    }


    if (
        email.length < 3 ||
        email.length >
            MAX_EMAIL_LENGTH
    ) {

        return false;

    }


    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
            email
        );

}


/* =========================================================
   SAFE NEXT URL
   ========================================================= */

function getSafeNext(
    value
) {

    if (
        typeof value !==
        "string"
    ) {

        return "/dashboard";

    }


    if (
        !value ||
        value.length > 2000
    ) {

        return "/dashboard";

    }


    /*
     * Apenas URLs internas.
     *
     * Bloqueia:
     *
     * https://...
     * http://...
     * //evil.com
     * \evil.com
     */

    if (
        !value.startsWith("/") ||
        value.startsWith("//") ||
        value.includes("\\")
    ) {

        return "/dashboard";

    }


    return value;

}


/* =========================================================
   METHOD NOT ALLOWED
   ========================================================= */

function methodNotAllowed(
    allowed
) {

    return new Response(
        JSON.stringify(
            {
                success: false,
                message:
                    "Method not allowed."
            }
        ),
        {
            status: 405,

            headers: {

                "Content-Type":
                    "application/json; charset=utf-8",

                "Allow":
                    `${allowed}, OPTIONS`,

                "Cache-Control":
                    "no-store"

            }

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
        "application/json; charset=utf-8"
    );


    headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
    );


    headers.set(
        "Pragma",
        "no-cache"
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
            status:
                status,

            headers:
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
         * Somente o mesmo domínio.
         */

        if (
            originURL.origin !==
            requestURL.origin
        ) {

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
            "Access-Control-Max-Age"
        ] =
            "86400";


        headers[
            "Vary"
        ] =
            "Origin";

    } catch {

        return {};

    }


    return headers;

}


/* =========================================================
   OPTIONS / PREFLIGHT
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


    headers.set(
        "Cache-Control",
        "no-store"
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
   SECURITY HEADERS
   ========================================================= */

function applySecurityHeaders(
    response
) {

    if (!response) {

        return response;

    }


    const headers =
        new Headers(
            response.headers
        );


    /*
     * MIME sniffing.
     */

    headers.set(
        "X-Content-Type-Options",
        "nosniff"
    );


    /*
     * Clickjacking.
     */

    headers.set(
        "X-Frame-Options",
        "DENY"
    );


    /*
     * Referrer.
     */

    headers.set(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
    );


    /*
     * Browser permissions.
     */

    headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()"
    );


    /*
     * Cross-origin protection.
     */

    headers.set(
        "Cross-Origin-Opener-Policy",
        "same-origin"
    );


    /*
     * API responses devem
     * permanecer sem cache.
     */

    const contentType =
        headers.get(
            "Content-Type"
        ) || "";


    if (
        contentType.includes(
            "application/json"
        )
    ) {

        headers.set(
            "Cache-Control",
            "no-store, no-cache, must-revalidate"
        );

    }


    return new Response(
        response.body,
        {
            status:
                response.status,

            statusText:
                response.statusText,

            headers:
                headers
        }
    );

}


/* =========================================================
   LOGIN RATE LIMIT KEY
   ========================================================= */

function getLoginRateKey(
    request
) {

    const ip =
        request.headers.get(
            "CF-Connecting-IP"
        ) ||
        request.headers.get(
            "x-forwarded-for"
        ) ||
        "unknown";


    return (
        "https://nexauren-login-rate-limit/" +
        encodeURIComponent(
            ip
        )
    );

}


/* =========================================================
   GET LOGIN RATE RECORD
   ========================================================= */

async function getLoginRateRecord(
    request
) {

    try {

        const key =
            getLoginRateKey(
                request
            );


        const response =
            await caches.default.match(
                key
            );


        if (!response) {

            return {
                count: 0,
                expiresAt: 0
            };

        }


        const data =
            await response.json();


        if (
            !data ||
            typeof data.count !==
                "number" ||
            typeof data.expiresAt !==
                "number"
        ) {

            return {
                count: 0,
                expiresAt: 0
            };

        }


        if (
            data.expiresAt <=
            Date.now()
        ) {

            return {
                count: 0,
                expiresAt: 0
            };

        }


        return data;

    } catch {

        return {
            count: 0,
            expiresAt: 0
        };

    }

}


/* =========================================================
   SAVE LOGIN RATE RECORD
   ========================================================= */

async function saveLoginRateRecord(
    request,
    record
) {

    try {

        const key =
            getLoginRateKey(
                request
            );


        const response =
            new Response(
                JSON.stringify(
                    record
                ),
                {
                    headers: {

                        "Content-Type":
                            "application/json",

                        "Cache-Control":
                            `max-age=${LOGIN_RATE_WINDOW_SECONDS}`

                    }
                }
            );


        await caches.default.put(
            key,
            response
        );

    } catch {

        /*
         * Rate limit é apenas uma
         * camada adicional de segurança.
         */

    }

}


/* =========================================================
   CHECK LOGIN RATE LIMIT
   ========================================================= */

async function checkLoginRateLimit(
    request
) {

    const record =
        await getLoginRateRecord(
            request
        );


    if (
        record.count >=
        LOGIN_RATE_LIMIT
    ) {

        const retryAfter =
            Math.max(
                1,

                Math.ceil(
                    (
                        record.expiresAt -
                        Date.now()
                    ) / 1000
                )
            );


        return {

            allowed:
                false,

            retryAfter:
                retryAfter

        };

    }


    return {

        allowed:
            true,

        retryAfter:
            0

    };

}


/* =========================================================
   RECORD LOGIN FAILURE
   ========================================================= */

async function recordLoginFailure(
    request
) {

    const now =
        Date.now();


    const existing =
        await getLoginRateRecord(
            request
        );


    let expiresAt =
        existing.expiresAt;


    let count =
        existing.count;


    if (
        !expiresAt ||
        expiresAt <= now
    ) {

        expiresAt =
            now +
            (
                LOGIN_RATE_WINDOW_SECONDS *
                1000
            );

        count =
            0;

    }


    count += 1;


    await saveLoginRateRecord(
        request,
        {
            count:
                count,

            expiresAt:
                expiresAt
        }
    );

}


/* =========================================================
   CLEAR LOGIN FAILURES
   ========================================================= */

async function clearLoginFailures(
    request
) {

    try {

        const key =
            getLoginRateKey(
                request
            );


        await caches.default.delete(
            key
        );

    } catch {

        /*
         * Nenhuma ação adicional necessária.
         */

    }

}


/* =========================================================
   END OF NEXAUREN WORKER
   ========================================================= */
                
