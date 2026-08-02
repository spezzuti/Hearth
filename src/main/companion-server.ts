import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type {
  ArchiveSnapshot,
  BootstrapData,
  CompanionAccessStatus,
  CoreMethod
} from "../shared/contracts";

const CAPABILITIES = [
  "Current project and Return Pack",
  "Workshop status without terminal output",
  "Recent captures, bounded handoffs, and closed reports",
  "Quick link, idea, or note capture",
  "Reversible idea decisions",
  "Companion conversation"
];

const APP_CSS = `
:root{font-family:"Segoe UI Variable","Segoe UI",system-ui,sans-serif;color:#293b3c;background:#e9e1d6;color-scheme:light}
*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{margin:0;background:radial-gradient(circle at 90% 0,#fff9,transparent 30%),#e9e1d6}
button,input,textarea,select{font:inherit}header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:15px 17px;background:#203837;color:#f7f1e9;box-shadow:0 8px 24px #263b3522}
.brand{display:flex;align-items:center;gap:10px}.mark{display:grid;width:38px;height:38px;place-items:center;font-family:Georgia,serif;font-size:21px;background:#a85535;border-radius:12px}.brand strong,.brand small{display:block}.brand small{margin-top:2px;color:#aebcb6;font-size:10px;letter-spacing:.1em;text-transform:uppercase}
header>span{font-size:11px;color:#b9c8c1}.wrap{width:100%;max-width:760px;margin:auto;padding:18px 14px 54px}.hero{margin-bottom:14px}.eyebrow{margin:0 0 6px;color:#925135;font-size:10px;font-weight:750;letter-spacing:.13em;text-transform:uppercase}.hero h1{margin:0 0 7px;font:500 29px Georgia,serif}.hero p{margin:0;color:#6c716d;font-size:14px;line-height:1.5}
.grid{display:grid;gap:12px}.grid>*{min-width:0}.card{min-width:0;padding:17px;background:#faf7f1;border:1px solid #d7cec3;border-radius:17px;box-shadow:0 9px 28px #493a2c10}.card h2{margin:0 0 10px;font:550 20px Georgia,serif}.card p{line-height:1.5}.card-title{display:flex;align-items:center;justify-content:space-between;gap:10px}.card-title span{padding:5px 8px;color:#5f756c;font-size:10px;font-weight:700;background:#e4ece7;border-radius:999px}.status{display:flex;align-items:center;gap:9px;padding:10px;background:#e4ece7;border-radius:11px}.status strong{min-width:0;overflow-wrap:anywhere}.dot{width:8px;height:8px;flex:0 0 auto;background:#72a27e;border-radius:50%}.meta{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin-top:11px}.meta div{min-width:0;padding:10px;background:#f0ebe4;border-radius:10px}.meta small,.item small{display:block;color:#8d8279;font-size:10px;text-transform:uppercase;letter-spacing:.07em}.meta strong{display:block;margin-top:4px;font-size:13px;overflow-wrap:anywhere}
.item{padding:11px 0;border-top:1px solid #e2d9cf}.item:first-of-type{border-top:0}.item strong{display:block;margin:4px 0;font-size:14px;overflow-wrap:anywhere}.item p{margin:0;color:#626966;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.composer{display:grid;gap:8px}textarea,input,select{width:100%;min-width:0;padding:11px;color:#334241;background:#fffdf9;border:1px solid #d5cabf;border-radius:10px;outline:0}textarea:focus,input:focus{border-color:#a95a3b;box-shadow:0 0 0 3px #a95a3b18}textarea{min-height:76px;resize:vertical}button{min-height:44px;padding:0 15px;color:#fffaf4;font-weight:650;background:#31524e;border:1px solid #23413e;border-radius:10px;cursor:pointer}button:disabled{opacity:.55}.quiet{color:#765949;background:#f4eee7;border-color:#d5c7ba}.actions{display:flex;justify-content:flex-end;gap:8px}.message{max-width:88%;padding:10px 12px;margin:8px 0;background:#eee7df;border-radius:4px 12px 12px}.message.user{margin-left:auto;background:#e2ebe7;border-radius:12px 4px 12px 12px}.message.pending{color:#737b77}.message b{display:block;margin-bottom:4px;color:#8e4e36;font-size:10px;text-transform:uppercase}.message p{margin:0;font-size:14px;overflow-wrap:anywhere}#messages{max-height:360px;overflow-y:auto;padding-right:3px;scroll-behavior:smooth}.empty{color:#81817b;font-size:13px}.notice{padding:10px;margin:0 0 12px;color:#6f5b4e;background:#f1e7dc;border-radius:10px;font-size:12px;line-height:1.45}.attention{padding:12px 14px;margin:0 0 12px;color:#f8efe7;background:#8d4f37;border-radius:12px;box-shadow:0 8px 20px #6e352329}.attention[hidden]{display:none}.attention strong{display:block;margin-bottom:3px;font-size:13px}.attention span{font-size:12px;line-height:1.4}.decision{padding:13px;margin-top:9px;background:#f0ebe4;border:1px solid #e1d6ca;border-radius:12px}.decision:first-child{margin-top:0}.decision-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.decision-head>div{min-width:0}.decision small{display:block;color:#8d8279;font-size:10px;letter-spacing:.07em;text-transform:uppercase}.decision strong{display:block;margin:4px 0 5px;font-size:14px;overflow-wrap:anywhere}.decision p{margin:0;color:#626966;font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.decision-state{flex:0 0 auto;padding:5px 8px;color:#5f756c;font-size:10px;font-weight:700;background:#e1e9e4;border-radius:999px}.choice-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:11px}.choice-row button{min-width:0;min-height:38px;padding:0 7px;color:#55645f;font-size:12px;background:#fffaf4;border-color:#d5c7ba}.choice-row button.active{color:#fffaf4;background:#31524e;border-color:#23413e}.desktop-note{margin-top:10px!important;color:#846657!important;font-size:11px!important}.error{color:#8e3f30}.pair{min-height:100vh;display:grid;place-items:center;padding:20px}.pair .card{width:min(420px,100%)}.pair h1{font:550 28px Georgia,serif}.pair input{text-align:center;font-size:22px;letter-spacing:.2em}
details.secondary-card{padding:0}details.secondary-card summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;list-style:none;cursor:pointer}details.secondary-card summary::-webkit-details-marker{display:none}details.secondary-card summary span:first-child{font:550 18px Georgia,serif}details.secondary-card summary span:last-child{color:#8d8279;font-size:11px}details.secondary-card[open] summary{padding-bottom:9px;border-bottom:1px solid #e7ded4}details.secondary-card>div{padding:5px 16px 14px}
@media(max-width:479px){header{padding:12px 14px}.mark{width:34px;height:34px;border-radius:10px}.wrap{padding:14px 12px 42px}.hero h1{font-size:25px}.hero p{font-size:13px}.notice{font-size:11px}.card{padding:15px;border-radius:15px}.card h2{font-size:19px}.meta{grid-template-columns:1fr}.companion-card{order:4}.actions button{min-width:92px}.choice-row{gap:5px}.choice-row button{font-size:11px}}
@media(min-width:680px){.grid.two{grid-template-columns:1fr 1fr}.wide{grid-column:1/-1}}
`;

const APP_JS = `
const $=s=>document.querySelector(s);const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c]));
async function api(path,options={}){const response=await fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(response.status===401){location.reload();throw new Error("Pair with Hearth again.");}if(!response.ok)throw new Error(data.error||"Hearth did not respond.");return data}
function item(label,title,copy){return '<div class="item"><small>'+esc(label)+'</small><strong>'+esc(title)+'</strong><p>'+esc(copy)+'</p></div>'}
function message(role,text,extra=""){return '<div class="message '+(role==="user"?"user ":"")+extra+'"><b>'+(role==="user"?"You":"Companion")+'</b><p>'+esc(text)+'</p></div>'}
function scrollMessages(){const list=$("#messages");list.scrollTop=list.scrollHeight}
function ideaDecision(x){const choices=[["pursuing","Pursue"],["resting","Let rest"],["let-go","Let go"]];return '<article class="decision"><div class="decision-head"><div><small>Idea</small><strong>'+esc(x.title||x.text)+'</strong><p>'+esc(x.projectName||"Not connected to a project")+'</p></div><span class="decision-state">'+esc(x.ideaState==="pursuing"?"Pursuing":x.ideaState==="let-go"?"Let go":"Resting")+'</span></div><div class="choice-row">'+choices.map(c=>'<button type="button" data-idea-id="'+esc(x.id)+'" data-state="'+c[0]+'" class="'+(x.ideaState===c[0]?"active":"")+'" aria-pressed="'+(x.ideaState===c[0])+'">'+c[1]+'</button>').join("")+'</div></article>'}
function handoffDecision(x){return '<article class="decision"><div class="decision-head"><div><small>'+esc(x.kind)+'</small><strong>'+esc(x.title)+'</strong><p>'+esc(x.summary)+'</p></div><span class="decision-state">'+esc(x.status)+'</span></div><p class="desktop-note">'+esc(x.detail)+'</p></article>'}
async function load(){try{const s=await api("/api/snapshot");const attention=$("#attention");attention.hidden=!s.workshop.requiresInput;if(s.workshop.requiresInput){attention.innerHTML="<strong>Workshop needs a look</strong><span>"+esc(s.workshop.summary)+"</span>";document.title="Workshop needs you · Hearth"}else{document.title="Hearth Companion"}$("#project").innerHTML='<div class="status"><span class="dot"></span><strong>'+esc(s.project.name)+'</strong></div><div class="meta"><div><small>Workshop</small><strong>'+esc(s.workshop.summary)+'</strong></div><div><small>Next</small><strong>'+esc(s.returnPack.recommendedNextAction)+'</strong></div></div>';$("#return").innerHTML=item("Where you left off",s.returnPack.whereYouLeftOff,s.returnPack.sessionState);const decisions=(s.decisions.handoff?[handoffDecision(s.decisions.handoff)]:[]).concat(s.decisions.ideas.map(ideaDecision));$("#decision-count").textContent=decisions.length?decisions.length+" here":"Clear";$("#decisions").innerHTML=decisions.length?decisions.join(""):'<p class="empty">Nothing needs a decision right now.</p>';$("#reports").innerHTML=s.reports.length?s.reports.map(x=>item(x.status,x.title,x.summary)).join(""):'<p class="empty">No closed reports yet.</p>';$("#kept").innerHTML=s.captures.length?s.captures.map(x=>item(x.kind,x.title||x.text,x.projectName||"")).join(""):'<p class="empty">Nothing recent.</p>';$("#companion-provider").textContent=s.provider.active==="claude-code"?(s.provider.model||"Claude Code"):"Local fallback";$("#messages").innerHTML=s.messages.map(x=>message(x.role,x.text)).join("");scrollMessages()}catch(e){$("#project").innerHTML='<p class="error">'+esc(e.message)+'</p>'}}
function enterSends(field,form){field.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();form.requestSubmit()}})}
$("#decisions").addEventListener("click",async e=>{const b=e.target.closest("button[data-idea-id]");if(!b)return;const buttons=[...b.closest(".choice-row").querySelectorAll("button")];buttons.forEach(x=>x.disabled=true);try{await api("/api/idea-state",{method:"POST",body:JSON.stringify({captureId:b.dataset.ideaId,state:b.dataset.state})});await load()}catch(x){alert(x.message)}finally{buttons.forEach(x=>x.disabled=false)}});
$("#capture-form").addEventListener("submit",async e=>{e.preventDefault();const b=$("#capture-button"),text=$("#capture-text").value.trim();if(!text)return;b.disabled=true;try{await api("/api/capture",{method:"POST",body:JSON.stringify({text,kind:$("#capture-kind").value})});$("#capture-text").value="";await load()}catch(x){alert(x.message)}finally{b.disabled=false}});
$("#chat-form").addEventListener("submit",async e=>{e.preventDefault();const b=$("#chat-button"),text=$("#chat-text").value.trim();if(!text)return;b.disabled=true;$("#chat-text").value="";$("#messages").insertAdjacentHTML("beforeend",message("user",text)+message("assistant","Thinking…","pending"));scrollMessages();try{await api("/api/companion",{method:"POST",body:JSON.stringify({text})});await load()}catch(x){alert(x.message);await load()}finally{b.disabled=false}});
enterSends($("#capture-text"),$("#capture-form"));enterSends($("#chat-text"),$("#chat-form"));load();setInterval(load,15000);
`;

const APP_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hearth Companion</title><link rel="stylesheet" href="/app.css"></head><body><header><div class="brand"><span class="mark">H</span><div><strong>Hearth</strong><small>companion</small></div></div><span>Private access</span></header><main class="wrap"><section class="hero"><p class="eyebrow">Away from the desk</p><h1>The useful parts of home.</h1><p>Your place to check in, keep a thought, or talk something through.</p></section><p id="attention" class="attention" role="status" hidden></p><p class="notice">No terminal, project files, edits, or execution controls live here.</p><div class="grid two"><section class="card"><h2>Right now</h2><div id="project"></div></section><section class="card"><h2>Return point</h2><div id="return"></div></section><section class="card wide"><div class="card-title"><h2>Decisions</h2><span id="decision-count">Checking…</span></div><div id="decisions"></div></section><section class="card wide"><h2>Keep something</h2><form id="capture-form" class="composer"><select id="capture-kind" aria-label="Capture type"><option value="auto">Choose from the text</option><option value="idea">Idea</option><option value="note">Note</option><option value="link">Link</option></select><textarea id="capture-text" maxlength="12000" placeholder="Paste a link, or use @idea, @note, and #tags…"></textarea><div class="actions"><button id="capture-button">Keep it</button></div></form></section><section class="card wide companion-card"><div class="card-title"><h2>Companion</h2><span id="companion-provider">Checking…</span></div><div id="messages"></div><form id="chat-form" class="composer"><textarea id="chat-text" maxlength="8000" placeholder="Talk it through…"></textarea><div class="actions"><button id="chat-button">Send</button></div></form></section><details class="card secondary-card"><summary><span>Recent reports</span><span>Open</span></summary><div id="reports"></div></details><details class="card secondary-card"><summary><span>Recently kept</span><span>Open</span></summary><div id="kept"></div></details></div></main><script src="/app.js" defer></script></body></html>`;

function json(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

function text(response: ServerResponse, type: string, body: string): void {
  response.writeHead(200, {
    "Content-Type": `${type}; charset=utf-8`,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  });
  response.end(body);
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 16_384) throw new Error("Request is too large.");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
}

export class CompanionServer {
  private server: Server | null = null;
  private state: CompanionAccessStatus["state"] = "off";
  private detail = "Companion access is off.";
  private port: number | null = null;
  private pairingCode: string | null = null;
  private pairingExpiresAt: number | null = null;
  private pairingFailures = 0;
  private pairingBlockedUntil = 0;
  private sessionToken = randomBytes(32).toString("base64url");

  constructor(
    private readonly invoke: (method: CoreMethod, payload: unknown) => Promise<unknown>,
    private readonly requestedPort = 47_831
  ) {}

  status(): CompanionAccessStatus {
    return {
      enabled: this.state === "ready" || this.state === "starting",
      state: this.state,
      localUrl: this.port ? `http://127.0.0.1:${this.port}` : null,
      pairingCode:
        this.pairingExpiresAt && this.pairingExpiresAt > Date.now()
          ? this.pairingCode
          : null,
      pairingExpiresAt: this.pairingExpiresAt
        ? new Date(this.pairingExpiresAt).toISOString()
        : null,
      detail: this.detail,
      capabilities: CAPABILITIES
    };
  }

  async start(): Promise<CompanionAccessStatus> {
    if (this.server) return this.status();
    this.state = "starting";
    this.rotate();
    const server = createServer(
      { maxHeaderSize: 16_384, requestTimeout: 15_000, headersTimeout: 10_000 },
      (request, response) => void this.handle(request, response)
    );
    server.maxHeadersCount = 64;
    server.keepAliveTimeout = 5_000;
    server.timeout = 20_000;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.requestedPort, "127.0.0.1", () => resolve());
    }).catch((reason) => {
      this.state = "failed";
      this.detail =
        reason instanceof Error ? reason.message : "Companion access could not start.";
      server.close();
      throw reason;
    });
    this.server = server;
    this.port = (server.address() as AddressInfo).port;
    this.state = "ready";
    this.detail =
      "The Companion service itself remains bound to this PC.";
    return this.status();
  }

  async stop(): Promise<CompanionAccessStatus> {
    const server = this.server;
    this.server = null;
    this.port = null;
    this.state = "off";
    this.detail = "Companion access is off.";
    this.pairingCode = null;
    this.pairingExpiresAt = null;
    this.sessionToken = randomBytes(32).toString("base64url");
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    return this.status();
  }

  rotate(): CompanionAccessStatus {
    if (this.state === "off") throw new Error("Turn Companion access on first.");
    this.sessionToken = randomBytes(32).toString("base64url");
    this.pairingCode = randomInt(100_000, 1_000_000).toString();
    this.pairingExpiresAt = Date.now() + 10 * 60_000;
    this.pairingFailures = 0;
    this.pairingBlockedUntil = 0;
    return this.status();
  }

  private authenticated(request: IncomingMessage): boolean {
    const cookie = request.headers.cookie ?? "";
    const match = /(?:^|;\s*)hearth_companion=([^;]+)/.exec(cookie);
    if (!match) return false;
    const candidate = Buffer.from(match[1]!, "utf8");
    const expected = Buffer.from(this.sessionToken, "utf8");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }

  private async snapshot(): Promise<unknown> {
    const [bootstrap, archive] = (await Promise.all([
      this.invoke("bootstrap", {}),
      this.invoke("getArchive", {})
    ])) as [BootstrapData, ArchiveSnapshot];
    const proposal = bootstrap.makerProposal;
    const handoff = proposal && proposal.status !== "discarded"
      ? {
          id: proposal.id,
          kind: proposal.executionResult ? "Execution report" : "Workshop handoff",
          title: proposal.instruction.slice(0, 160),
          summary: (
            proposal.executionResult?.decision ||
            proposal.rationale ||
            proposal.riskSummary ||
            "This handoff is waiting at the desktop."
          ).slice(0, 600),
          status: proposal.executionResult
            ? "Ready to review"
            : proposal.status === "draft"
              ? "Draft"
              : "In Workshop",
          detail: proposal.executionResult
            ? `The report covers ${proposal.executionResult.changedFiles.length} changed item${
                proposal.executionResult.changedFiles.length === 1 ? "" : "s"
              }, ${proposal.executionResult.validation.length} validation note${
                proposal.executionResult.validation.length === 1 ? "" : "s"
              }, and ${proposal.executionResult.concerns.length} concern${
                proposal.executionResult.concerns.length === 1 ? "" : "s"
              }. Review, Critic handoff, and closing stay on the desktop.`
            : proposal.status === "draft"
              ? "You can read the plan here. Editing, approval, and passing it to Claude Code stay on the desktop."
              : "Claude Code owns this handoff in Workshop. The phone can watch, but it cannot type, approve, or execute."
        }
      : null;
    return {
      project: {
        id: bootstrap.workspace.selectedProject.id,
        name: bootstrap.workspace.selectedProject.name
      },
      returnPack: bootstrap.returnPack,
      workshop: {
        state: bootstrap.terminal.observation.state,
        summary: bootstrap.terminal.observation.summary,
        requiresInput: bootstrap.terminal.observation.requiresInput
      },
      captures: bootstrap.captures
        .filter((item) => !item.archived)
        .slice(0, 8)
        .map((item) => ({
          id: item.id,
          kind: item.kind,
          text: item.text,
          title: item.title,
          projectName: item.projectName,
          createdAt: item.createdAt
        })),
      decisions: {
        ideas: bootstrap.captures
          .filter((item) => item.kind === "idea" && !item.archived)
          .slice(0, 6)
          .map((item) => ({
            id: item.id,
            text: item.text.slice(0, 600),
            title: item.title?.slice(0, 160) ?? null,
            projectName: item.projectName,
            ideaState: item.ideaState ?? "resting",
            updatedAt: item.updatedAt
          })),
        handoff
      },
      reports: archive.items
        .filter((item) => item.kind === "handoff")
        .slice(0, 8)
        .map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          status: item.status,
          createdAt: item.createdAt
        })),
      provider: {
        active: bootstrap.runtime.provider.active,
        state: bootstrap.runtime.provider.state,
        name: bootstrap.runtime.provider.name,
        model: bootstrap.runtime.provider.models.companion,
        detail: bootstrap.runtime.provider.detail
      },
      messages: bootstrap.conversations.companion.slice(-20)
    };
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/app.css") {
        text(response, "text/css", APP_CSS);
        return;
      }
      if (request.method === "GET" && url.pathname === "/app.js") {
        text(response, "text/javascript", APP_JS);
        return;
      }
      if (request.method === "POST" && url.pathname === "/pair") {
        const value = await body(request);
        if (this.pairingBlockedUntil > Date.now()) {
          json(response, 429, {
            error: "Pairing is paused after too many attempts. Make a new code on the desktop."
          });
          return;
        }
        if (
          !this.pairingCode ||
          !this.pairingExpiresAt ||
          this.pairingExpiresAt <= Date.now() ||
          value.code !== this.pairingCode
        ) {
          this.pairingFailures += 1;
          if (this.pairingFailures >= 5) {
            this.pairingBlockedUntil = Date.now() + 5 * 60_000;
          }
          json(response, 401, { error: "That pairing code is not valid." });
          return;
        }
        this.pairingFailures = 0;
        this.pairingCode = null;
        this.pairingExpiresAt = null;
        response.setHeader(
          "Set-Cookie",
          `hearth_companion=${this.sessionToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${
            request.headers["tailscale-user-login"] ||
            request.headers["x-forwarded-proto"] === "https"
              ? "; Secure"
              : ""
          }`
        );
        json(response, 200, { paired: true });
        return;
      }
      if (!this.authenticated(request)) {
        if (request.method === "GET" && url.pathname === "/") {
          text(
            response,
            "text/html",
            `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><title>Pair Hearth</title></head><body><main class="pair"><section class="card"><p class="eyebrow">Hearth Companion</p><h1>Pair this screen</h1><p>Enter the temporary code shown on the desktop. It expires after ten minutes.</p><form id="pair" class="composer"><input id="code" aria-label="Pairing code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"><button>Pair</button></form><p id="error" class="error"></p></section></main><script src="/pair.js"></script></body></html>`
          );
          return;
        }
        if (request.method === "GET" && url.pathname === "/pair.js") {
          text(
            response,
            "text/javascript",
            `document.querySelector("#pair").addEventListener("submit",async e=>{e.preventDefault();const r=await fetch("/pair",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:document.querySelector("#code").value})});if(r.ok)location.reload();else document.querySelector("#error").textContent=(await r.json()).error});`
          );
          return;
        }
        json(response, 401, { error: "Pair with Hearth on the desktop first." });
        return;
      }
      if (request.method === "GET" && url.pathname === "/") {
        text(response, "text/html", APP_HTML);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/snapshot") {
        json(response, 200, await this.snapshot());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/capture") {
        const value = await body(request);
        if (
          typeof value.text !== "string" ||
          !value.text.trim() ||
          value.text.length > 12_000 ||
          !["auto", "idea", "note", "link"].includes(String(value.kind))
        ) {
          json(response, 400, { error: "Capture a link, idea, or note within Hearth's limit." });
          return;
        }
        const result = await this.invoke("saveCapture", {
          text: value.text,
          ...(value.kind === "auto" ? {} : { kind: value.kind })
        });
        json(response, 200, result);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/idea-state") {
        const value = await body(request);
        if (
          typeof value.captureId !== "string" ||
          !value.captureId ||
          value.captureId.length > 128 ||
          !["resting", "pursuing", "let-go"].includes(String(value.state))
        ) {
          json(response, 400, { error: "Choose a valid idea and decision." });
          return;
        }
        json(
          response,
          200,
          await this.invoke("updateCapture", {
            captureId: value.captureId,
            patch: { ideaState: value.state }
          })
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/companion") {
        const value = await body(request);
        if (
          typeof value.text !== "string" ||
          !value.text.trim() ||
          value.text.length > 8_000
        ) {
          json(response, 400, { error: "Write a message within Hearth's limit." });
          return;
        }
        json(
          response,
          200,
          await this.invoke("sendAgentMessage", {
            agent: "companion",
            text: value.text
          })
        );
        return;
      }
      json(response, 404, { error: "That Companion capability does not exist." });
    } catch (reason) {
      json(response, 500, {
        error: reason instanceof Error ? reason.message : "Companion access failed."
      });
    }
  }
}
