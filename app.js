(function () {
  "use strict";

  let modoAtual = "farinha";
  let receitaAtual = null;
  let saboresExtras = [];
  let paramsAtuais = {};

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function init() {
    receitaAtual = Object.keys(receitas)[0];
    carregarEstadoDaURL();
    renderSelectReceita();
    renderParams();
    renderVersaoIndicador();
    bindEventos();
    calcular();
  }

  function renderVersaoIndicador() {
    const el = $("#versao-indicador");
    if (!el) return;
    if (!Editor.temCustom(receitaAtual)) {
      el.classList.add("hidden");
      return;
    }
    const versao = Editor.getVersaoAtual(receitaAtual);
    if (!versao) {
      el.classList.add("hidden");
      return;
    }
    const data = new Date(versao.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    el.textContent = `v${versao.versao} · ${versao.descricao} · ${data}`;
    el.classList.remove("hidden");
  }

  function renderSelectReceita() {
    const select = $("#receita-select");
    select.innerHTML = "";
    for (const [id, r] of Object.entries(receitas)) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = r.nome;
      if (id === receitaAtual) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function renderParams() {
    const r = getReceitaAtiva(receitaAtual);
    paramsAtuais = {};
    const container = $("#params-container");
    container.innerHTML = "";
    for (const [key, p] of Object.entries(r.params)) {
      paramsAtuais[key] = p.valor;
      const div = document.createElement("div");
      div.innerHTML = `
        <label for="param-${key}">${p.label}</label>
        <input type="number" id="param-${key}" value="${p.valor}" min="${p.min}" max="${p.max}" step="1" inputmode="numeric">
      `;
      container.appendChild(div);
    }
  }

  function bindEventos() {
    $("#receita-select").addEventListener("change", (e) => {
      receitaAtual = e.target.value;
      EditorUI.setReceitaId(receitaAtual);
      renderParams();
      renderVersaoIndicador();
      atualizarSaborPrincipalNome();
      calcular();
    });

    $$(".modo-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        modoAtual = btn.dataset.modo;
        $$(".modo-btn").forEach((b) => b.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
        $("#input-farinha").classList.toggle("hidden", modoAtual !== "farinha");
        $("#input-quantidade").classList.toggle("hidden", modoAtual !== "quantidade");
        calcular();
      });
    });

    $("#farinha-input").addEventListener("input", calcular);
    $("#principal-qty").addEventListener("input", calcular);

    $("#btn-add-sabor").addEventListener("click", adicionarSaborExtra);

    $(".collapsible-header").addEventListener("click", function () {
      const expanded = this.getAttribute("aria-expanded") === "true";
      this.setAttribute("aria-expanded", !expanded);
      this.nextElementSibling.classList.toggle("hidden", expanded);
    });

    $("#params-container").addEventListener("input", (e) => {
      if (e.target.tagName === "INPUT") {
        const key = e.target.id.replace("param-", "");
        paramsAtuais[key] = parseFloat(e.target.value) || 0;
        calcular();
      }
    });

    $("#btn-copiar").addEventListener("click", copiarLink);
    $("#btn-imagem").addEventListener("click", salvarImagem);
    $("#btn-limpar-checks").addEventListener("click", limparChecks);
    $("#divisor-input").addEventListener("input", calcular);
  }

  function atualizarSaborPrincipalNome() {
    const r = getReceitaAtiva(receitaAtual);
    if (r.saborPrincipal) {
      $("#sabor-principal-nome").textContent = r.saborPrincipal.nome;
    }
  }

  function adicionarSaborExtra() {
    const id = Date.now();
    saboresExtras.push({ id, nome: "", qty: 0 });
    renderSaboresExtras();
    calcular();
  }

  function removerSaborExtra(id) {
    saboresExtras = saboresExtras.filter((s) => s.id !== id);
    renderSaboresExtras();
    calcular();
  }

  function renderSaboresExtras() {
    const container = $("#sabores-extras");
    container.innerHTML = "";
    saboresExtras.forEach((s) => {
      const row = document.createElement("div");
      row.className = "sabor-extra-row";
      row.innerHTML = `
        <input type="text" placeholder="Nome do sabor" value="${s.nome}" data-id="${s.id}" data-field="nome">
        <input type="number" placeholder="Qtd" value="${s.qty || ""}" min="0" step="1" inputmode="numeric" data-id="${s.id}" data-field="qty">
        <button type="button" class="btn-remove" data-id="${s.id}">&times;</button>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const id = parseInt(e.target.dataset.id);
        const field = e.target.dataset.field;
        const sabor = saboresExtras.find((s) => s.id === id);
        if (sabor) {
          sabor[field] = field === "qty" ? parseInt(e.target.value) || 0 : e.target.value;
          calcular();
        }
      });
    });

    container.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        removerSaborExtra(parseInt(e.target.dataset.id));
      });
    });
  }

  function calcular() {
    const r = getReceitaAtiva(receitaAtual);
    const pesoMassa = paramsAtuais.pesoMassa || r.params.pesoMassa.valor;
    const pesoRecheio = paramsAtuais.pesoRecheio || r.params.pesoRecheio.valor;

    let qtdPrincipal, totalEsfihas, farinha;

    if (modoAtual === "farinha") {
      farinha = parseFloat($("#farinha-input").value) || 0;
      const massaTotal = farinha * r.fatorFarinha;
      totalEsfihas = Math.floor(massaTotal / pesoMassa);
      qtdPrincipal = totalEsfihas - saboresExtras.reduce((sum, s) => sum + (s.qty || 0), 0);
      if (qtdPrincipal < 0) qtdPrincipal = 0;
      $("#hint-esfihas").textContent = `≈ ${totalEsfihas} esfihas`;
      $("#principal-qty").value = qtdPrincipal;
      const sobra = massaTotal - (totalEsfihas * pesoMassa);
      const avisoSobra = $("#aviso-sobra");
      if (sobra > 1) {
        const farinhaExata = Math.round((totalEsfihas * pesoMassa) / r.fatorFarinha);
        const farinhaMais = Math.round(((totalEsfihas + 1) * pesoMassa) / r.fatorFarinha);
        avisoSobra.textContent = `Sobra ~${Math.round(sobra)}g de massa. Use ${farinhaExata}g para ${totalEsfihas} exatas ou ${farinhaMais}g para ${totalEsfihas + 1}.`;
        avisoSobra.classList.remove("hidden");
      } else {
        avisoSobra.classList.add("hidden");
      }
    } else {
      qtdPrincipal = parseInt($("#principal-qty").value) || 0;
      const extrasTotal = saboresExtras.reduce((sum, s) => sum + (s.qty || 0), 0);
      totalEsfihas = qtdPrincipal + extrasTotal;
      const massaTotal = totalEsfihas * pesoMassa;
      farinha = massaTotal / r.fatorFarinha;
      const avisoSobra = $("#aviso-sobra");
      if (avisoSobra) avisoSobra.classList.add("hidden");
    }

    const ingredientesMassa = {};
    for (const [key, ing] of Object.entries(r.massa)) {
      ingredientesMassa[key] = {
        nome: ing.nome,
        valor: farinha * ing.fator,
        unidade: ing.unidade,
      };
    }

    let ingredientesRecheio = null;
    if (r.saborPrincipal && r.saborPrincipal.ingredientes && qtdPrincipal > 0) {
      const totalRecheio = qtdPrincipal * pesoRecheio;
      ingredientesRecheio = {};
      for (const [key, ing] of Object.entries(r.saborPrincipal.ingredientes)) {
        ingredientesRecheio[key] = {
          nome: ing.nome,
          valor: totalRecheio * ing.fator,
          unidade: ing.unidade,
        };
      }
    }

    renderResultados(totalEsfihas, qtdPrincipal, ingredientesMassa, ingredientesRecheio, r);
    renderChecklist(ingredientesMassa, ingredientesRecheio);
    atualizarURL();
  }

  function formatarValor(valor, unidade) {
    if (valor >= 1000) {
      const converted = valor / 1000;
      const newUnit = unidade === "g" ? "kg" : "L";
      return `${converted.toFixed(2).replace(".", ",")} ${newUnit}`;
    }
    if (valor < 10) {
      return `${valor.toFixed(1).replace(".", ",")} ${unidade}`;
    }
    return `${Math.round(valor)} ${unidade}`;
  }

  function renderResultados(total, qtdPrincipal, massa, recheio, receita) {
    const divisor = parseInt($("#divisor-input").value) || 1;

    let resumoHtml = `<div class="resumo-total">${total} esfihas no total</div>`;
    const saboresInfo = [];
    if (qtdPrincipal > 0) {
      saboresInfo.push(`${qtdPrincipal} ${receita.saborPrincipal.nome}`);
    }
    saboresExtras.filter((s) => s.qty > 0).forEach((s) => {
      saboresInfo.push(`${s.qty} ${s.nome || "Sem nome"}`);
    });
    if (saboresInfo.length > 0) {
      resumoHtml += `<div class="resumo-sabores">${saboresInfo.join(" · ")}</div>`;
    }
    if (divisor > 1) {
      resumoHtml += `<div class="resultado-divisor">Dividido em ${divisor} vezes (${Math.ceil(total / divisor)} esfihas por vez)</div>`;
    }
    $("#resultado-resumo").innerHTML = resumoHtml;

    const massaHtml = Object.values(massa)
      .map(
        (i) => `<div class="ingrediente-row">
        <span class="nome">${i.nome}</span>
        <span class="leader"></span>
        <span class="valor">${formatarValor(i.valor / divisor, i.unidade)}</span>
      </div>`
      )
      .join("");
    const massaTitle = divisor > 1 ? `Massa <span style="font-weight:400;text-transform:none">(por vez)</span>` : "Massa";
    $("#resultado-massa").innerHTML = `<h3>${massaTitle}</h3>${massaHtml}`;

    if (recheio) {
      const recheioHtml = Object.values(recheio)
        .map(
          (i) => `<div class="ingrediente-row">
          <span class="nome">${i.nome}</span>
          <span class="leader"></span>
          <span class="valor">${formatarValor(i.valor / divisor, i.unidade)}</span>
        </div>`
        )
        .join("");
      const recheioQtd = Math.ceil(qtdPrincipal / divisor);
      const recheioTitle = divisor > 1
        ? `Recheio de ${receita.saborPrincipal.nome} (${recheioQtd} un. por vez)`
        : `Recheio de ${receita.saborPrincipal.nome} (${qtdPrincipal} un.)`;
      $("#resultado-recheio").innerHTML = `<h3>${recheioTitle}</h3>${recheioHtml}`;
    } else {
      $("#resultado-recheio").innerHTML = "";
    }

    if (saboresExtras.length > 0) {
      const extrasHtml = saboresExtras
        .filter((s) => s.qty > 0)
        .map(
          (s) => `<div class="ingrediente-row">
          <span class="nome">${s.nome || "Sem nome"}</span>
          <span class="leader"></span>
          <span class="valor">${s.qty} un.</span>
        </div>`
        )
        .join("");
      if (extrasHtml) {
        $("#resultado-extras").innerHTML = `<h3>Outros sabores</h3>${extrasHtml}`;
      } else {
        $("#resultado-extras").innerHTML = "";
      }
    } else {
      $("#resultado-extras").innerHTML = "";
    }
  }

  function atualizarURL() {
    const params = new URLSearchParams();
    params.set("r", receitaAtual);
    params.set("m", modoAtual);

    if (modoAtual === "farinha") {
      params.set("f", $("#farinha-input").value);
    } else {
      params.set("carne", $("#principal-qty").value);
    }

    if (saboresExtras.length > 0) {
      const extrasStr = saboresExtras
        .filter((s) => s.nome && s.qty > 0)
        .map((s) => `${s.nome}:${s.qty}`)
        .join(",");
      if (extrasStr) params.set("s", extrasStr);
    }

    const r = getReceitaAtiva(receitaAtual);
    if (paramsAtuais.pesoMassa !== r.params.pesoMassa.valor) {
      params.set("pm", paramsAtuais.pesoMassa);
    }
    if (paramsAtuais.pesoRecheio !== r.params.pesoRecheio.valor) {
      params.set("pr", paramsAtuais.pesoRecheio);
    }

    const newURL = `${window.location.pathname}?${params.toString()}`;
    history.replaceState(null, "", newURL);
  }

  function carregarEstadoDaURL() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("r")) return;

    receitaAtual = params.get("r") || Object.keys(receitas)[0];
    modoAtual = params.get("m") || "farinha";

    if (params.has("f")) {
      $("#farinha-input").value = params.get("f");
    }
    if (params.has("carne")) {
      $("#principal-qty").value = params.get("carne");
    }

    if (params.has("s")) {
      const extras = params.get("s").split(",");
      saboresExtras = extras.map((e) => {
        const [nome, qty] = e.split(":");
        return { id: Date.now() + Math.random(), nome, qty: parseInt(qty) || 0 };
      });
      renderSaboresExtras();
    }

    if (params.has("pm")) {
      paramsAtuais.pesoMassa = parseFloat(params.get("pm"));
    }
    if (params.has("pr")) {
      paramsAtuais.pesoRecheio = parseFloat(params.get("pr"));
    }

    $$(".modo-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.modo === modoAtual ? "true" : "false");
    });
    $("#input-farinha").classList.toggle("hidden", modoAtual !== "farinha");
    $("#input-quantidade").classList.toggle("hidden", modoAtual !== "quantidade");
  }

  function copiarLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      mostrarToast("Link copiado!");
    }).catch(() => {
      mostrarToast("Não foi possível copiar");
    });
  }

  async function salvarImagem() {
    const el = $("#resultados");
    if (typeof html2canvas === "undefined") {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      script.onload = () => gerarImagem(el);
      document.head.appendChild(script);
    } else {
      gerarImagem(el);
    }
  }

  function gerarImagem(el) {
    const dataStr = new Date().toLocaleDateString("pt-BR");
    const resumoTotal = el.querySelector(".resumo-total").textContent;
    const resumoSaboresEl = el.querySelector(".resumo-sabores");
    const resumoSabores = resumoSaboresEl ? resumoSaboresEl.textContent.trim() : "";

    const wrapper = document.createElement("div");
    wrapper.style.cssText = `padding:24px;background:#FFF9F3;border-radius:12px;width:400px;font-family:-apple-system,sans-serif;color:#4A2C17`;
    wrapper.innerHTML = `
      <div style="font-size:18px;font-weight:700;margin-bottom:4px">Calculadora de Receitas</div>
      <div style="font-size:13px;color:#6B4A32;margin-bottom:16px">${receitas[receitaAtual].nome} — ${dataStr}</div>
      <div style="background:#4D7C3A;color:#fff;padding:10px 12px;border-radius:8px;text-align:center;margin-bottom:16px">
        <div style="font-weight:700;font-size:15px">${resumoTotal}</div>
        <div style="font-size:12px;opacity:0.9;margin-top:4px">${resumoSabores}</div>
      </div>
      ${el.querySelector("#resultado-massa").outerHTML}
      ${el.querySelector("#resultado-recheio").outerHTML}
      ${el.querySelector("#resultado-extras").outerHTML}
    `;
    document.body.appendChild(wrapper);

    html2canvas(wrapper, { scale: 2, backgroundColor: "#FFF9F3" }).then((canvas) => {
      document.body.removeChild(wrapper);
      const link = document.createElement("a");
      link.download = `receita-${receitaAtual}-${dataStr.replace(/\//g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      mostrarToast("Imagem salva!");
    });
  }

  function renderChecklist(ingredientesMassa, ingredientesRecheio) {
    const container = $("#checklist-items");
    const checks = carregarChecks();
    let html = "";

    html += `<div class="checklist-group-title">Massa</div>`;
    for (const [key, ing] of Object.entries(ingredientesMassa)) {
      const id = `massa-${key}`;
      const checked = checks[id] ? "checked" : "";
      const cls = checks[id] ? "checklist-item checked" : "checklist-item";
      html += `<div class="${cls}">
        <input type="checkbox" id="chk-${id}" data-key="${id}" ${checked}>
        <label for="chk-${id}">
          <span class="item-nome">${ing.nome}</span>
          <span class="item-valor">${formatarValor(ing.valor, ing.unidade)}</span>
        </label>
      </div>`;
    }

    if (ingredientesRecheio) {
      html += `<div class="checklist-group-title">Recheio</div>`;
      for (const [key, ing] of Object.entries(ingredientesRecheio)) {
        const id = `recheio-${key}`;
        const checked = checks[id] ? "checked" : "";
        const cls = checks[id] ? "checklist-item checked" : "checklist-item";
        html += `<div class="${cls}">
          <input type="checkbox" id="chk-${id}" data-key="${id}" ${checked}>
          <label for="chk-${id}">
            <span class="item-nome">${ing.nome}</span>
            <span class="item-valor">${formatarValor(ing.valor, ing.unidade)}</span>
          </label>
        </div>`;
      }
    }

    container.innerHTML = html;

    container.querySelectorAll("input[type=checkbox]").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        const key = e.target.dataset.key;
        const item = e.target.closest(".checklist-item");
        item.classList.toggle("checked", e.target.checked);
        salvarCheck(key, e.target.checked);
      });
    });
  }

  function carregarChecks() {
    try {
      return JSON.parse(localStorage.getItem("checklist_" + receitaAtual)) || {};
    } catch { return {}; }
  }

  function salvarCheck(key, valor) {
    const checks = carregarChecks();
    if (valor) { checks[key] = true; }
    else { delete checks[key]; }
    localStorage.setItem("checklist_" + receitaAtual, JSON.stringify(checks));
  }

  function limparChecks() {
    localStorage.removeItem("checklist_" + receitaAtual);
    $$("#checklist-items input[type=checkbox]").forEach((chk) => {
      chk.checked = false;
      chk.closest(".checklist-item").classList.remove("checked");
    });
    mostrarToast("Marcações limpas!");
  }

  function mostrarToast(msg) {
    let toast = $(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  window.mostrarToast = mostrarToast;
  window.appRecalcular = function () {
    renderParams();
    calcular();
  };

  document.addEventListener("DOMContentLoaded", function () {
    init();
    EditorUI.init(receitaAtual);
  });
})();
