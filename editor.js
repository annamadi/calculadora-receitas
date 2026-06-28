/**
 * editor.js — Edição de receitas com histórico de versões
 * Carrega ANTES de app.js, expondo funções globais.
 */

const Editor = (function () {
  "use strict";

  const STORAGE_PREFIX = "receita_custom_";

  function getStorageKey(receitaId) {
    return STORAGE_PREFIX + receitaId;
  }

  function carregarDados(receitaId) {
    try {
      const raw = localStorage.getItem(getStorageKey(receitaId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function salvarDados(receitaId, dados) {
    try {
      localStorage.setItem(getStorageKey(receitaId), JSON.stringify(dados));
    } catch {
      console.warn("localStorage cheio ou indisponível");
    }
  }

  function getReceitaAtiva(receitaId) {
    const dados = carregarDados(receitaId);
    if (dados && dados.atual) {
      return dados.atual;
    }
    return receitas[receitaId];
  }

  function getVersaoAtual(receitaId) {
    const dados = carregarDados(receitaId);
    if (!dados || !dados.historico || dados.historico.length === 0) return null;
    return dados.historico[0];
  }

  function getHistorico(receitaId) {
    const dados = carregarDados(receitaId);
    if (!dados || !dados.historico) return [];
    return dados.historico;
  }

  function recalcularFatorFarinha(massa) {
    let soma = 0;
    for (const [key, ing] of Object.entries(massa)) {
      soma += ing.fator;
    }
    return soma;
  }

  function gerarDiff(receitaAnterior, receitaNova) {
    const diffs = [];

    if (receitaAnterior.massa && receitaNova.massa) {
      for (const [key, ing] of Object.entries(receitaNova.massa)) {
        const anterior = receitaAnterior.massa[key];
        if (!anterior) {
          diffs.push(`+ ${ing.nome}`);
        } else if (anterior.fator !== ing.fator) {
          const pctAnt = (anterior.fator * 100).toFixed(1);
          const pctNov = (ing.fator * 100).toFixed(1);
          diffs.push(`${ing.nome}: ${pctAnt}% → ${pctNov}%`);
        }
      }
      for (const key of Object.keys(receitaAnterior.massa)) {
        if (!receitaNova.massa[key]) {
          diffs.push(`- ${receitaAnterior.massa[key].nome}`);
        }
      }
    }

    if (receitaAnterior.saborPrincipal && receitaNova.saborPrincipal) {
      const ingAnt = receitaAnterior.saborPrincipal.ingredientes || {};
      const ingNov = receitaNova.saborPrincipal.ingredientes || {};
      for (const [key, ing] of Object.entries(ingNov)) {
        const ant = ingAnt[key];
        if (!ant) {
          diffs.push(`+ ${ing.nome} (recheio)`);
        } else if (ant.fator !== ing.fator) {
          const pctAnt = (ant.fator * 100).toFixed(1);
          const pctNov = (ing.fator * 100).toFixed(1);
          diffs.push(`${ing.nome}: ${pctAnt}% → ${pctNov}%`);
        }
      }
      for (const key of Object.keys(ingAnt)) {
        if (!ingNov[key]) {
          diffs.push(`- ${ingAnt[key].nome} (recheio)`);
        }
      }
    }

    if (receitaAnterior.params && receitaNova.params) {
      for (const [key, p] of Object.entries(receitaNova.params)) {
        const ant = receitaAnterior.params[key];
        if (ant && ant.valor !== p.valor) {
          diffs.push(`${p.label}: ${ant.valor} → ${p.valor}`);
        }
      }
    }

    return diffs;
  }

  function salvarVersao(receitaId, novaReceita, descricao) {
    const dados = carregarDados(receitaId) || { atual: null, historico: [] };
    const receitaAnterior = dados.atual || receitas[receitaId];

    novaReceita.fatorFarinha = recalcularFatorFarinha(novaReceita.massa);

    const versaoNum = dados.historico.length > 0
      ? dados.historico[0].versao + 1
      : 2;

    const diff = gerarDiff(receitaAnterior, novaReceita);

    const entrada = {
      versao: versaoNum,
      data: new Date().toISOString(),
      descricao: descricao,
      diff: diff,
      nota: "",
      receita: JSON.parse(JSON.stringify(novaReceita)),
    };

    dados.historico.unshift(entrada);
    dados.atual = JSON.parse(JSON.stringify(novaReceita));

    salvarDados(receitaId, dados);
    return entrada;
  }

  function restaurarVersao(receitaId, idx) {
    const dados = carregarDados(receitaId);
    if (!dados || !dados.historico[idx]) return false;

    dados.atual = JSON.parse(JSON.stringify(dados.historico[idx].receita));
    salvarDados(receitaId, dados);
    return true;
  }

  function desfazer(receitaId) {
    const dados = carregarDados(receitaId);
    if (!dados || !dados.historico || dados.historico.length < 2) {
      return resetar(receitaId);
    }
    dados.historico.shift();
    dados.atual = dados.historico.length > 0
      ? JSON.parse(JSON.stringify(dados.historico[0].receita))
      : null;

    if (!dados.atual) {
      localStorage.removeItem(getStorageKey(receitaId));
    } else {
      salvarDados(receitaId, dados);
    }
    return true;
  }

  function resetar(receitaId) {
    localStorage.removeItem(getStorageKey(receitaId));
    return true;
  }

  function salvarNota(receitaId, idx, nota) {
    const dados = carregarDados(receitaId);
    if (!dados || !dados.historico[idx]) return false;
    dados.historico[idx].nota = nota;
    salvarDados(receitaId, dados);
    return true;
  }

  function exportarJSON(receitaId) {
    const dados = carregarDados(receitaId);
    if (!dados) return null;

    const json = JSON.stringify(dados, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const file = new File([blob], `receita-${receitaId}.json`, { type: "application/json" });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        title: `Receita: ${receitas[receitaId].nome}`,
        files: [file],
      }).catch(() => {
        downloadBlob(blob, file.name);
      });
    } else {
      downloadBlob(blob, file.name);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copiarJSON(receitaId) {
    const dados = carregarDados(receitaId);
    if (!dados) return Promise.reject("Sem dados");
    const json = JSON.stringify(dados, null, 2);
    return navigator.clipboard.writeText(json);
  }

  function importarJSON(receitaId, fileOrText) {
    return new Promise((resolve, reject) => {
      const processar = (text) => {
        try {
          const dados = JSON.parse(text);
          if (!validarEstrutura(dados)) {
            reject("Formato inválido");
            return;
          }
          salvarDados(receitaId, dados);
          resolve(dados);
        } catch {
          reject("JSON inválido");
        }
      };

      if (typeof fileOrText === "string") {
        processar(fileOrText);
      } else {
        const reader = new FileReader();
        reader.onload = () => processar(reader.result);
        reader.onerror = () => reject("Erro ao ler arquivo");
        reader.readAsText(fileOrText);
      }
    });
  }

  function validarEstrutura(dados) {
    if (!dados || typeof dados !== "object") return false;
    if (!dados.atual || !dados.atual.massa) return false;
    if (!dados.historico || !Array.isArray(dados.historico)) return false;
    return true;
  }

  function temCustom(receitaId) {
    return carregarDados(receitaId) !== null;
  }

  return {
    getReceitaAtiva,
    getVersaoAtual,
    getHistorico,
    salvarVersao,
    restaurarVersao,
    desfazer,
    resetar,
    salvarNota,
    exportarJSON,
    copiarJSON,
    importarJSON,
    temCustom,
    recalcularFatorFarinha,
    gerarDiff,
  };
})();

function getReceitaAtiva(receitaId) {
  return Editor.getReceitaAtiva(receitaId);
}

/**
 * EditorUI — UI de edição e histórico
 */
const EditorUI = (function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  let displayMode = "percent"; // "percent" or "grams"
  let receitaId = null;
  let rascunho = null;

  function init(id) {
    receitaId = id;
    bindEventos();
  }

  function setReceitaId(id) {
    receitaId = id;
  }

  function bindEventos() {
    const btnEditar = $("#btn-editar");
    const btnHistorico = $("#btn-historico");
    const btnFecharEditor = $("#btn-fechar-editor");
    const btnFecharHistorico = $("#btn-fechar-historico");
    const btnSalvarVersao = $("#btn-salvar-versao");
    const btnDesfazer = $("#btn-desfazer");
    const btnResetar = $("#btn-resetar");
    const btnExportar = $("#btn-exportar");
    const btnCopiarJSON = $("#btn-copiar-json");
    const inputImportar = $("#input-importar");
    const btnAddMassa = $("#btn-add-ing-massa");
    const btnAddRecheio = $("#btn-add-ing-recheio");

    if (btnEditar) btnEditar.addEventListener("click", toggleEditor);
    if (btnHistorico) btnHistorico.addEventListener("click", toggleHistorico);
    if (btnFecharEditor) btnFecharEditor.addEventListener("click", fecharEditor);
    if (btnFecharHistorico) btnFecharHistorico.addEventListener("click", fecharHistorico);
    if (btnSalvarVersao) btnSalvarVersao.addEventListener("click", pedirDescricao);
    if (btnDesfazer) btnDesfazer.addEventListener("click", executarDesfazer);
    if (btnResetar) btnResetar.addEventListener("click", executarResetar);
    if (btnExportar) btnExportar.addEventListener("click", () => Editor.exportarJSON(receitaId));
    if (btnCopiarJSON) btnCopiarJSON.addEventListener("click", copiarJSON);
    if (inputImportar) inputImportar.addEventListener("change", handleImportar);
    if (btnAddMassa) btnAddMassa.addEventListener("click", () => adicionarIngrediente("massa"));
    if (btnAddRecheio) btnAddRecheio.addEventListener("click", () => adicionarIngrediente("recheio"));

    const displayBtns = document.querySelectorAll(".display-btn");
    displayBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        displayBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        displayMode = btn.dataset.display;
        renderEditorInputs();
      });
    });
  }

  function toggleEditor() {
    const panel = $("#editor-panel");
    if (!panel.classList.contains("hidden")) {
      fecharEditor();
    } else {
      abrirEditor();
    }
  }

  function toggleHistorico() {
    const panel = $("#historico-panel");
    if (!panel.classList.contains("hidden")) {
      fecharHistorico();
    } else {
      abrirHistorico();
    }
  }

  function abrirEditor() {
    const r = Editor.getReceitaAtiva(receitaId);
    rascunho = JSON.parse(JSON.stringify(r));
    const panel = $("#editor-panel");
    panel.classList.remove("hidden");
    moverPainelParaCima(panel);
    atualizarBotoesAtivos();
    renderEditorInputs();
    renderEditorParams();
  }

  function fecharEditor() {
    $("#editor-panel").classList.add("hidden");
    rascunho = null;
    atualizarBotoesAtivos();
  }

  function renderEditorInputs() {
    if (!rascunho) return;
    const massaHint = displayMode === "percent" ? "(% relativo à farinha)" : "(g por 1kg de farinha)";
    const recheioHint = displayMode === "percent" ? "(% do peso total)" : "(g por 1kg de recheio)";
    const massaH3 = $("#editor-massa h3");
    const recheioH3 = $("#editor-recheio h3");
    if (massaH3) massaH3.innerHTML = `Massa <span class="editor-hint">${massaHint}</span>`;
    if (recheioH3) recheioH3.innerHTML = `Recheio <span class="editor-hint">${recheioHint}</span>`;
    renderGrupoMassa();
    renderGrupoRecheio();
  }

  function renderGrupoMassa() {
    const container = $("#editor-massa-items");
    let html = "";
    for (const [key, ing] of Object.entries(rascunho.massa)) {
      if (key === "farinha") continue;
      const valor = displayMode === "percent"
        ? (ing.fator * 100).toFixed(1)
        : (ing.fator * 1000).toFixed(0);
      const sufixo = displayMode === "percent" ? "%" : ing.unidade;
      html += `
        <div class="editor-ing-row" data-key="${key}" data-grupo="massa">
          <input type="text" value="${ing.nome}" data-field="nome" placeholder="Nome">
          <input type="number" value="${valor}" data-field="fator" step="${displayMode === 'percent' ? '0.1' : '1'}" min="0">
          <span class="unit-label">${sufixo}</span>
          <button type="button" class="btn-icon-action btn-remover-ing" title="Remover">✕</button>
        </div>`;
    }
    container.innerHTML = html;
    bindIngredienteEventos(container, "massa");
  }

  function renderGrupoRecheio() {
    const container = $("#editor-recheio-items");
    if (!rascunho.saborPrincipal) {
      container.innerHTML = "<p>Sem recheio definido</p>";
      return;
    }
    let html = "";
    for (const [key, ing] of Object.entries(rascunho.saborPrincipal.ingredientes)) {
      const valor = displayMode === "percent"
        ? (ing.fator * 100).toFixed(1)
        : (ing.fator * 1000).toFixed(0);
      const sufixo = displayMode === "percent" ? "%" : ing.unidade;
      html += `
        <div class="editor-ing-row" data-key="${key}" data-grupo="recheio">
          <input type="text" value="${ing.nome}" data-field="nome" placeholder="Nome">
          <input type="number" value="${valor}" data-field="fator" step="${displayMode === 'percent' ? '0.1' : '1'}" min="0">
          <span class="unit-label">${sufixo}</span>
          <button type="button" class="btn-icon-action btn-remover-ing" title="Remover">✕</button>
        </div>`;
    }
    container.innerHTML = html;
    bindIngredienteEventos(container, "recheio");
  }

  function renderEditorParams() {
    const container = $("#editor-params-items");
    if (!rascunho.params) return;
    let html = "";
    for (const [key, p] of Object.entries(rascunho.params)) {
      html += `
        <div class="param-item" data-key="${key}">
          <label>${p.label}</label>
          <input type="number" value="${p.valor}" min="${p.min}" max="${p.max}" data-field="param">
        </div>`;
    }
    container.innerHTML = html;
    container.querySelectorAll("input[data-field='param']").forEach((inp) => {
      inp.addEventListener("input", () => {
        const key = inp.closest("[data-key]").dataset.key;
        rascunho.params[key].valor = parseFloat(inp.value) || rascunho.params[key].valor;
      });
    });
  }

  function bindIngredienteEventos(container, grupo) {
    container.querySelectorAll(".editor-ing-row").forEach((row) => {
      const key = row.dataset.key;
      const nomeInput = row.querySelector("[data-field='nome']");
      const fatorInput = row.querySelector("[data-field='fator']");
      const btnRemover = row.querySelector(".btn-remover-ing");

      nomeInput.addEventListener("input", () => {
        const ing = getIngrediente(grupo, key);
        if (ing) ing.nome = nomeInput.value;
      });

      fatorInput.addEventListener("input", () => {
        const ing = getIngrediente(grupo, key);
        if (!ing) return;
        const v = parseFloat(fatorInput.value) || 0;
        if (displayMode === "percent") {
          ing.fator = v / 100;
        } else {
          ing.fator = v / 1000;
        }
      });

      btnRemover.addEventListener("click", () => {
        if (grupo === "massa") {
          delete rascunho.massa[key];
        } else {
          delete rascunho.saborPrincipal.ingredientes[key];
        }
        renderEditorInputs();
      });
    });
  }

  function getIngrediente(grupo, key) {
    if (grupo === "massa") return rascunho.massa[key];
    return rascunho.saborPrincipal.ingredientes[key];
  }

  function adicionarIngrediente(grupo) {
    const btnId = grupo === "massa" ? "#btn-add-ing-massa" : "#btn-add-ing-recheio";
    const btn = $(btnId);
    if (!btn) return;

    if (btn.previousElementSibling && btn.previousElementSibling.classList.contains("novo-ing-form")) {
      return;
    }

    const form = document.createElement("div");
    form.className = "novo-ing-form";
    form.innerHTML = `
      <div class="editor-ing-row novo-ing-row">
        <input type="text" class="novo-ing-nome" placeholder="Nome do ingrediente">
        <select class="novo-ing-unidade">
          <option value="g">g</option>
          <option value="ml">ml</option>
        </select>
        <button type="button" class="btn-confirmar-ing" title="Confirmar">✓</button>
        <button type="button" class="btn-cancelar-ing" title="Cancelar">✕</button>
      </div>`;
    btn.before(form);

    const nomeInput = form.querySelector(".novo-ing-nome");
    nomeInput.focus();

    form.querySelector(".btn-confirmar-ing").addEventListener("click", () => {
      const nome = nomeInput.value.trim();
      if (!nome) {
        nomeInput.focus();
        return;
      }
      const unidade = form.querySelector(".novo-ing-unidade").value;
      const id = "ing_" + Date.now();
      const novoIng = { nome, fator: 0, unidade };
      if (grupo === "massa") {
        rascunho.massa[id] = novoIng;
      } else {
        rascunho.saborPrincipal.ingredientes[id] = novoIng;
      }
      form.remove();
      renderEditorInputs();
    });

    form.querySelector(".btn-cancelar-ing").addEventListener("click", () => {
      form.remove();
    });

    nomeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") form.querySelector(".btn-confirmar-ing").click();
      if (e.key === "Escape") form.remove();
    });
  }

  function pedirDescricao() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-content">
        <h3>O que mudou?</h3>
        <input type="text" id="modal-descricao" placeholder="Ex: Aumentei a hidratação">
        <div class="modal-btns">
          <button type="button" class="modal-btn-secondary" id="modal-cancelar">Cancelar</button>
          <button type="button" class="modal-btn-primary" id="modal-confirmar">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const inp = overlay.querySelector("#modal-descricao");
    inp.focus();

    overlay.querySelector("#modal-cancelar").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#modal-confirmar").addEventListener("click", () => {
      const desc = inp.value.trim() || "Edição sem descrição";
      Editor.salvarVersao(receitaId, rascunho, desc);
      overlay.remove();
      fecharEditor();
      if (typeof window.appRecalcular === "function") {
        window.appRecalcular();
      }
      renderVersaoIndicador();
    });

    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        overlay.querySelector("#modal-confirmar").click();
      }
    });
  }

  function executarDesfazer() {
    if (!confirm("Reverter para a versão anterior?")) return;
    Editor.desfazer(receitaId);
    fecharEditor();
    if (typeof window.appRecalcular === "function") {
      window.appRecalcular();
    }
    renderVersaoIndicador();
  }

  function executarResetar() {
    if (!confirm("Restaurar a receita original? Todas as edições serão perdidas.")) return;
    Editor.resetar(receitaId);
    fecharEditor();
    if (typeof window.appRecalcular === "function") {
      window.appRecalcular();
    }
    renderVersaoIndicador();
  }

  function copiarJSON() {
    Editor.copiarJSON(receitaId).then(() => {
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast("JSON copiado!");
      }
    }).catch(() => {
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast("Erro ao copiar");
      }
    });
  }

  function handleImportar(e) {
    const file = e.target.files[0];
    if (!file) return;
    Editor.importarJSON(receitaId, file).then(() => {
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast("Receita importada!");
      }
      fecharEditor();
      if (typeof window.appRecalcular === "function") {
        window.appRecalcular();
      }
      renderVersaoIndicador();
    }).catch((err) => {
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast("Erro: " + err);
      }
    });
    e.target.value = "";
  }

  // Histórico

  function abrirHistorico() {
    const lista = Editor.getHistorico(receitaId);
    const container = $("#historico-lista");
    const panel = $("#historico-panel");
    if (lista.length === 0) {
      container.innerHTML = "<p style='color:var(--walnut-light);font-size:0.9rem;'>Nenhuma edição ainda.</p>";
      panel.classList.remove("hidden");
      moverPainelParaCima(panel);
      atualizarBotoesAtivos();
      return;
    }

    let html = "";
    lista.forEach((item, idx) => {
      const data = new Date(item.data).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"
      });
      const isAtiva = idx === 0;
      const diffHtml = item.diff && item.diff.length > 0
        ? `<div class="historico-diff">${item.diff.join(" · ")}</div>`
        : "";
      const notaHtml = item.nota
        ? `<div class="historico-nota">📝 ${item.nota}</div>`
        : "";

      html += `
        <div class="historico-item ${isAtiva ? 'historico-ativa' : ''}" data-idx="${idx}">
          <div class="historico-item-header">
            <span class="historico-versao">v${item.versao}${isAtiva ? ' (atual)' : ''}</span>
            <span class="historico-data">${data}</span>
          </div>
          <div class="historico-descricao">${item.descricao}</div>
          ${diffHtml}
          ${notaHtml}
          <input type="text" class="historico-nota-input" placeholder="Nota pós-preparo..." value="${item.nota || ''}" data-idx="${idx}">
          <div class="historico-acoes">
            ${!isAtiva ? `<button type="button" class="btn-restaurar" data-idx="${idx}">Restaurar</button>` : ""}
            <button type="button" class="btn-salvar-nota" data-idx="${idx}">Salvar nota</button>
          </div>
        </div>`;
    });

    container.innerHTML = html;
    bindHistoricoEventos(container);
    panel.classList.remove("hidden");
    moverPainelParaCima(panel);
    atualizarBotoesAtivos();
  }

  function bindHistoricoEventos(container) {
    container.querySelectorAll(".btn-restaurar").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        if (!confirm("Restaurar esta versão?")) return;
        Editor.restaurarVersao(receitaId, idx);
        fecharHistorico();
        if (typeof window.appRecalcular === "function") {
          window.appRecalcular();
        }
        renderVersaoIndicador();
      });
    });

    container.querySelectorAll(".btn-salvar-nota").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        const input = container.querySelector(`.historico-nota-input[data-idx="${idx}"]`);
        Editor.salvarNota(receitaId, idx, input.value.trim());
        if (typeof window.mostrarToast === "function") {
          window.mostrarToast("Nota salva!");
        }
      });
    });
  }

  function fecharHistorico() {
    $("#historico-panel").classList.add("hidden");
    atualizarBotoesAtivos();
  }

  function renderVersaoIndicador() {
    const el = $("#versao-indicador");
    if (!el) return;
    if (!Editor.temCustom(receitaId)) {
      el.classList.add("hidden");
      return;
    }
    const versao = Editor.getVersaoAtual(receitaId);
    if (!versao) {
      el.classList.add("hidden");
      return;
    }
    const data = new Date(versao.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    el.textContent = `v${versao.versao} · ${versao.descricao} · ${data}`;
    el.classList.remove("hidden");
  }

  function moverPainelParaCima(panel) {
    const container = panel.parentElement;
    const receitaCard = container.querySelector(".card:first-child");
    if (receitaCard && receitaCard.nextElementSibling !== panel) {
      receitaCard.after(panel);
    }
  }

  function atualizarBotoesAtivos() {
    const btnEditar = $("#btn-editar");
    const btnHistorico = $("#btn-historico");
    const editorAberto = !$("#editor-panel").classList.contains("hidden");
    const historicoAberto = !$("#historico-panel").classList.contains("hidden");

    if (btnEditar) btnEditar.classList.toggle("btn-active", editorAberto);
    if (btnHistorico) btnHistorico.classList.toggle("btn-active", historicoAberto);
  }

  return {
    init,
    setReceitaId,
    renderVersaoIndicador,
  };
})();
