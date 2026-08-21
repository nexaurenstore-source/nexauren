/**
 * Nexauren
 * Cloudflare Worker
 *
 * V1 — Frontend delivery only
 *
 * Neste momento:
 * - Serve o frontend
 * - Não possui D1
 * - Não possui autenticação
 * - Não possui pagamentos
 * - Não possui créditos
 * - Não possui APIs comerciais
 */

export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);

            /*
             * Serve os arquivos estáticos do frontend.
             */
            return await env.ASSETS.fetch(request);

        } catch (error) {
            console.error("Nexauren Worker error:", error);

            return new Response(
                "Internal Server Error",
                {
                    status: 500,
                    headers: {
                        "Content-Type": "text/plain; charset=UTF-8"
                    }
                }
            );
        }
    }
};
