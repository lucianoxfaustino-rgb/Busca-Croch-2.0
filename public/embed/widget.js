// public/embed/widget.js
(function(){
  var API_BASE = "https://SEU-APP.vercel.app"; // ← TROQUE PELA SUA URL VERCEL (https)

  function h(tag, attrs, children){
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k){ el.setAttribute(k, attrs[k]); });
    (children||[]).forEach(function(c){ if (typeof c==="string") el.insertAdjacentHTML("beforeend", c); else el.appendChild(c); });
    return el;
  }

  function start(){
    var root = document.getElementById("widget-aulas-croche");
    if (!root) return;

    var wrap = h("div", { style:"max-width:820px;margin:20px auto;padding:16px;border:1px solid #eee;border-radius:12px" }, []);
    var title = h("h3", { style:"margin:0 0 10px" }, ["Aulas de Crochê no YouTube"]);
    var hint  = h("p", { style:"margin:6px 0 14px;color:#555" }, ['Ex.: "bolsa boho ponto pipoca", "sousplat redondo".']);
    var row   = h("div", { style:"display:flex;gap:8;flex-wrap:wrap" }, []);
    var input = h("input", { id:"yt-q", placeholder:"Digite o que procura…", style:"flex:1;min-width:240px;padding:10px 12px;border:1px solid #ddd;border-radius:8px" }, []);
    var btn   = h("button", { id:"yt-buscar", style:"padding:10px 14px;border-radius:8px" }, ["Buscar vídeos"]);
    row.appendChild(input); row.appendChild(btn);

    var erro  = h("div", { id:"yt-erro", style:"color:#b00;margin-top:10px;display:none" }, []);
    var lista = h("ul", { id:"yt-lista", style:"list-style:none;padding:0;margin:16px 0;display:grid;gap:12" }, []);
    var moreW = h("div", { style:"text-align:center" }, []);
    var mais  = h("button", { id:"yt-mais", style:"display:none;padding:10px 14px;border-radius:8px" }, ["Carregar mais"]);
    moreW.appendChild(mais);

    wrap.appendChild(title); wrap.appendChild(hint); wrap.appendChild(row); wrap.appendChild(erro); wrap.appendChild(lista); wrap.appendChild(moreW);
    root.appendChild(wrap);

    var nextPageToken, currentQ = "";

    async function buscar(append){
      try{
        if (!append){
          currentQ = (input.value||"").trim();
          nextPageToken = undefined;
          lista.innerHTML = "";
        }
        if (!currentQ){
          erro.textContent = "Digite um termo para buscar.";
          erro.style.display = "block";
          return;
        }
        erro.style.display = "none";
        btn.disabled = true; mais.disabled = true; btn.textContent = "Buscando...";

        var body = { query: currentQ };
        if (append && nextPageToken) body.pageToken = nextPageToken;

        var resp = await fetch(API_BASE + "/api/search", {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify(body)
        });
        var data = await resp.json().catch(function(){ return { error:"Resposta inválida da API" }; });
        if (!resp.ok) throw new Error(data && data.error || "Falha ao buscar.");

        var items = data.results || [];
        if (!append && !items.length){
          lista.innerHTML = '<li style="color:#666">Nenhum resultado encontrado.</li>';
        } else {
          var html = items.map(function(v){
            return '<li style="border:1px solid #eee;border-radius:12px;padding:12px;display:flex;gap:12px;align-items:center">'
              + (v.thumb ? '<img src="'+v.thumb+'" width="160" height="90" style="border-radius:8px;object-fit:cover">' : '')
              + '<div style="flex:1"><div style="font-weight:600;margin-bottom:6px">'+v.title+'</div>'
              + '<a href="'+v.url+'" target="_blank" rel="noopener">Abrir no YouTube</a></div></li>';
          }).join('');
          lista.insertAdjacentHTML("beforeend", html);
        }
        nextPageToken = data.nextPageToken;
        mais.style.display = nextPageToken ? "inline-block" : "none";
      } catch(e){
        erro.textContent = (e && e.message) ? e.message : "Erro ao buscar.";
        erro.style.display = "block";
        if (window && window.console) console.error("Widget erro:", e);
      } finally {
        btn.disabled = false; mais.disabled = false; btn.textContent = "Buscar vídeos";
      }
    }

    btn.addEventListener("click", function(){ buscar(false); });
    mais.addEventListener("click", function(){ buscar(true); });
    input.addEventListener("keydown", function(e){ if (e.key === "Enter") buscar(false); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
