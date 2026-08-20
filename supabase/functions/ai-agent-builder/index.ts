// QuickApp AI — "Create AI Agent" submit endpoint.
//
// Turns a plain-language objective into a validated custom workflow config
// built ONLY from the six existing deterministic analysis blocks, then stores
// it in public.ai_workflows using the caller's RLS-scoped client (so the
// admin-only insert policy remains the single source of truth).
import { createClient } from "npm:@supabase/supabase-js@2";
import { streamChat, TogetherError } from "../_shared/together/togetherClient.ts";
import { parseWorkflowConfig } from "../ai-workflow-run/customWorkflow.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const BLOCK_SPEC = `- declining_retailers — params: windowDays (7-180), topN (3-15)
- top_retailers — params: windowDays (7-180), topN (3-15)
- pending_dues — params: minAmount (0-100000), topN (3-15)
- beat_coverage — params: coverageDays (7-90), stopsPerDay (5-60)
- product_mix — params: windowDays (7-180), topN (3-10)
- visit_productivity — params: windowDays (7-90)`;

/** Keyword fallback — used when the AI is unavailable or replies unusably. */
function fallbackBlockType(objective: string): string {
  const o = objective.toLowerCase();
  if (/pending|due|collect/.test(o)) return "pending_dues";
  if (/churn|declin|drop|quiet/.test(o)) return "declining_retailers";
  if (/product|pitch|mix|sku/.test(o)) return "product_mix";
  if (/coverage|beat|plan/.test(o)) return "beat_coverage";
  if (/visit|productivity|strike/.test(o)) return "visit_productivity";
  return "top_retailers";
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "method_not_allowed", "Use POST");

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "unauthorized", "Missing bearer token");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    const userId = (claims as any)?.claims?.sub as string | undefined;
    if (claimsError || !userId) return jsonError(401, "unauthorized", "Invalid session");

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_system_admin", {
      _user_id: userId,
    });
    if (adminError || isAdmin !== true) {
      return jsonError(403, "admin_only", "Only administrators can create AI agents");
    }

    const body = await req.json().catch(() => ({}));
    const sourceModule = String((body as any)?.sourceModule ?? "").slice(0, 120);
    const sourceLabel = String((body as any)?.sourceLabel ?? sourceModule).slice(0, 120);
    const destModule = String((body as any)?.destModule ?? "").slice(0, 120);
    const destLabel = String((body as any)?.destLabel ?? destModule).slice(0, 120);
    const objective = String((body as any)?.objective ?? "").trim().slice(0, 2000);
    const tables: string[] = Array.isArray((body as any)?.tables)
      ? (body as any).tables.map((t: unknown) => String(t).slice(0, 80)).slice(0, 30)
      : [];

    if (!sourceModule || !destModule || !objective) {
      return jsonError(400, "invalid_request", "sourceModule, destModule and objective are required");
    }

    let aiName = `${sourceLabel} Agent`;
    let aiDescription = `AI agent for ${sourceLabel}, created from the Agent Builder.`;
    let config = parseWorkflowConfig({
      version: 1,
      blocks: [{ type: fallbackBlockType(objective), params: {} }],
      narration: { focus: objective.slice(0, 500), tone: "encouraging" },
    });
    let usedAi = false;

    const apiKey = Deno.env.get("TOGETHER_API_KEY");
    if (apiKey) {
      try {
        const stream = await streamChat({
          apiKey,
          signal: req.signal,
          messages: [
            {
              role: "system",
              content:
                "You configure a QuickApp AI agent. You may ONLY select from these fixed " +
                "deterministic analysis blocks — never invent queries, tables or data sources:\n" +
                `${BLOCK_SPEC}\n\n` +
                "Choose 1 to 3 blocks with parameters (inside the stated bounds) that best " +
                "fulfil the user's objective. Reply with STRICT JSON only, no markdown, in " +
                'exactly this shape: {"name":"...","description":"...","blocks":[{"type":"...",' +
                '"params":{...}}],"focus":"<=500 chars narration focus derived from the objective",' +
                '"tone":"encouraging"|"direct"|"formal"}',
            },
            {
              role: "user",
              content:
                `Module the agent works on: ${sourceLabel} (${sourceModule})\n` +
                `Output is displayed in: ${destLabel} (${destModule})\n` +
                `Tables available in that module: ${tables.length ? tables.join(", ") : "none mapped"}\n` +
                `Objective: ${objective}`,
            },
          ],
        });
        const text = await stream.fullText;
        const parsed = extractJson(text) as any;
        const candidate = parseWorkflowConfig({
          version: 1,
          blocks: parsed?.blocks,
          narration: {
            focus: String(parsed?.focus ?? objective).slice(0, 500),
            tone: parsed?.tone,
          },
        });
        config = candidate;
        if (typeof parsed?.name === "string" && parsed.name.trim()) {
          aiName = parsed.name.trim().slice(0, 120);
        }
        if (typeof parsed?.description === "string" && parsed.description.trim()) {
          aiDescription = parsed.description.trim().slice(0, 400);
        }
        usedAi = true;
      } catch (err) {
        const detail = err instanceof TogetherError ? `${err.code}: ${err.message}` : String(err);
        console.log("[ai-agent-builder] AI selection failed, using fallback —", detail);
      }
    }

    const description = `${aiDescription} · Works on ${sourceLabel} → shows in ${destLabel}.`;

    const { data: inserted, error: insertError } = await supabase
      .from("ai_workflows")
      .insert({
        name: aiName,
        description,
        config: config as any,
        created_by: userId,
        is_active: true,
      })
      .select("id, name, description")
      .single();

    if (insertError) {
      if (/row-level security/i.test(insertError.message ?? "")) {
        return jsonError(403, "admin_only", "Only administrators can create AI agents");
      }
      return jsonError(500, "insert_failed", insertError.message ?? "Could not create the agent");
    }

    return new Response(
      JSON.stringify({
        kind: "agent_created",
        workflow: {
          id: (inserted as any).id,
          name: (inserted as any).name,
          description: (inserted as any).description,
        },
        blocks: config.blocks.map((b) => b.type),
        usedAi,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[ai-agent-builder] failed", message);
    return jsonError(500, "execution_failed", message);
  }
});
