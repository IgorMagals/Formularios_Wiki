/* app.js — estado, alertas e navegação
   Parte do formulário de telemetria. Ver a ordem de carga no index.html.
   Quem chama iniciar() é o acesso.js, depois de validar o código. */

'use strict';

/* ==================================================================== *
 * ESTADO
 *
 *   placas   da base da CORPVS: placa, descrição, câmbio e grupo
 *   grupos   cada um com a configuração inteira (modelo, faixas, campos,
 *            alertas) — ver frota.js
 *   regras   do ranking, da empresa inteira — ver regras.js
 * ==================================================================== */
function grupoNovo(nome) {
  var audio = {};
  ALERTAS.forEach(function (a) { audio[a[0]] = true; });
  return {
    nome: nome || '',
    modelo: '',               // id em MODELOS; vazio = padrão genérico
    b: FAIXAS_PADRAO.slice(),
    f: Object.assign({}, PADRAO),
    audio: audio
  };
}

var S = null;          // montado em iniciar(), a partir da base do cliente
var ACESSO = null;     // { codigo, cliente, placas } — vem do acesso.js
var arrastando = -1;

/** O grupo em edição. Tudo que é de configuração passa por aqui. */
function A() {
  return S.grupos[S.ativo] || S.grupos[0];
}

/**
 * Junta a base que veio do servidor com o rascunho salvo no navegador.
 *
 * A BASE manda nas placas: placa que saiu da frota some, placa nova
 * aparece. O RASCUNHO manda no que o cliente já escolheu — câmbio e grupo
 * de cada placa, os grupos e as regras — mas só o rascunho DESTE código:
 * código novo é formulário novo. Rascunhos de códigos anteriores são
 * apagados aqui, para não sobrar configuração velha no navegador.
 */
function carregar(base) {
  var salvo = null, chave = chaveRascunho(base.codigo);
  try {
    salvo = JSON.parse(localStorage.getItem(chave));
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf(PREFIXO_RASCUNHO) === 0 && k !== chave) localStorage.removeItem(k);
    });
  } catch (e) {}
  salvo = salvo || {};

  var grupos = (Array.isArray(salvo.grupos) && salvo.grupos.length ? salvo.grupos : [grupoNovo()])
    .map(function (g) {
      var molde = grupoNovo();
      return Object.assign(molde, g, {
        audio: Object.assign(molde.audio, g.audio || {}),
        f: Object.assign({}, PADRAO, g.f || {}),
        b: Array.isArray(g.b) && g.b.length === FAIXAS_PADRAO.length ? g.b : molde.b
      });
    });

  var antes = {};
  (salvo.placas || []).forEach(function (p) { antes[p.placa] = p; });
  var placas = base.placas.map(function (p) {
    var a = antes[p.placa] || {};
    var grupo = a.grupo | 0;
    return {
      placa: p.placa,
      descricao: p.descricao || '',
      cambio: a.cambio === 'manual' || a.cambio === 'auto' ? a.cambio : '',   // nunca deduzido
      grupo: grupo >= 0 && grupo < grupos.length ? grupo : 0
    };
  });

  return {
    responsavel: salvo.responsavel || '',
    email: salvo.email || '',
    observacoes: salvo.observacoes || '',
    pagina: salvo.pagina | 0 || 1,
    ativo: Math.min(Math.max(0, salvo.ativo | 0), grupos.length - 1),
    camera: salvo.camera || '',
    regras: salvo.regras && typeof salvo.regras === 'object' ? salvo.regras : {},
    grupos: grupos,
    placas: placas
  };
}

function salvar() {
  if (ACESSO.enviado) return;   // depois do envio confirmado, nada volta para o navegador
  try { localStorage.setItem(chaveRascunho(ACESSO.codigo), JSON.stringify(S)); } catch (e) {}
}

/* ==================================================================== *
 * AUXILIARES
 * ==================================================================== */
function $(id) { return document.getElementById(id); }

function cria(tag, classe, texto) {
  var el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

/** Grupos que vão no envio: os que têm placa. */
function gruposComPlacas() {
  return S.grupos.map(function (g, i) { return i; })
    .filter(function (i) { return placasDoGrupo(i).length > 0; });
}

/**
 * O que impede o envio, em português, na ordem das etapas.
 * Junto, e não um erro de cada vez: quem preencheu merece saber tudo o
 * que falta numa olhada só.
 */
function pendenciasDoEnvio() {
  var faltas = [];
  if (!S.responsavel.trim()) faltas.push('Informe o Responsável (etapa 1).');
  if (!EMAIL_VALIDO.test(S.email.trim())) faltas.push('Informe um e-mail válido (etapa 1).');

  var sem = S.placas.filter(function (p) { return !p.cambio; }).map(function (p) { return p.placa; });
  if (sem.length) {
    faltas.push('Marque manual ou automático (etapa 1): ' +
      (sem.length > 4 ? sem.slice(0, 4).join(', ') + ' e mais ' + (sem.length - 4) : sem.join(', ')) + '.');
  }

  var varios = gruposComPlacas().length > 1;
  gruposComPlacas().forEach(function (i) {
    var g = S.grupos[i];
    var onde = varios ? rotuloGrupo(g, i) + ': ' : '';
    Object.keys(LIMITES).forEach(function (k) {
      var erro = criticaCampo(k, g.f[k]);
      if (erro) {
        faltas.push(onde + rotuloDe(k) + ': ' + erro + ' Permitido: ' +
          LIMITES[k].min + ' a ' + LIMITES[k].max + '.');
      }
    });
  });

  regrasLigadas().forEach(function (r) {
    var erro = criticaRegra(regraDe(r[0]));
    if (erro) faltas.push('Ranking, ' + r[1] + ': ' + erro + ' (etapa 4).');
  });

  return faltas;
}

/** Tudo que depende do grupo ativo, redesenhado de uma vez. */
function redesenhaTudo() {
  desenhaGrupos();
  desenhaBlocos();
  desenhaBarra();
  desenhaFaixas();
  aplicaAutomaticos();
}

/**
 * Campos e alertas que só existem em câmbio manual.
 * Desliga de verdade só quando TODAS as placas do grupo são automáticas —
 * com grupo misto o campo continua valendo para as manuais, e na saída
 * cada placa automática vai sem esses valores.
 */
function aplicaAutomaticos() {
  var ps = placasDoGrupo(S.ativo);
  var n = ps.filter(function (p) { return p.cambio === 'auto'; }).length;
  var todos = n > 0 && n === ps.length;

  document.querySelectorAll('[data-so-manual="1"]').forEach(function (medida) {
    var input = medida.querySelector('input');
    input.disabled = todos;
    medida.dataset.desligado = todos ? '1' : '0';
    var dica = medida.parentNode.querySelector('.dica');
    if (!dica) return;
    // Campo com valor fora do intervalo está mostrando o erro ali: a dica
    // de câmbio automático não pode apagar a mensagem que pede correção.
    if (medida.parentNode.classList.contains('campo--erro')) return;
    if (todos) {
      dica.textContent = 'Desativado: todas as placas deste grupo são automáticas';
      dica.classList.add('dica--alerta');
    } else if (n > 0) {
      dica.textContent = 'Não se aplica a ' + n + ' automática' + (n > 1 ? 's' : '');
      dica.classList.add('dica--alerta');
    } else {
      dica.textContent = dica.dataset.original || '';
      dica.classList.remove('dica--alerta');
    }
  });

  desenhaAlertas(n);
}

/* ==================================================================== *
 * ALERTAS SONOROS
 * ==================================================================== */
function desenhaAlertas(automaticas) {
  var lista = $('listaAlertas');
  lista.textContent = '';

  ALERTAS.forEach(function (a) {
    var chave = a[0], rotulo = a[1], nota = a[2], soManual = a[3];
    var ligado = !!A().audio[chave];

    var b = cria('button', 'alerta');
    b.type = 'button';
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(ligado));

    var rot = cria('div', 'alerta__rot');
    rot.appendChild(cria('b', null, rotulo));
    var complemento = soManual && automaticas > 0
      ? (nota ? nota + ' · ' : '') + 'não toca em automáticos'
      : nota;
    rot.appendChild(cria('span', null, complemento || ''));
    b.appendChild(rot);
    b.appendChild(cria('span', 'chave'));

    b.addEventListener('click', function () {
      A().audio[chave] = !A().audio[chave];
      salvar();
      b.setAttribute('aria-checked', String(A().audio[chave]));
    });

    lista.appendChild(b);
  });
}

function ligaTodosAlertas(valor) {
  ALERTAS.forEach(function (a) { A().audio[a[0]] = valor; });
  salvar();
  aplicaAutomaticos();
}

/* ==================================================================== *
 * NAVEGAÇÃO E LIGAÇÕES
 * ==================================================================== */
var ETAPAS = 4;

function mostraPagina(n) {
  S.pagina = n;
  salvar();
  for (var i = 1; i <= ETAPAS; i++) $('pagina' + i).hidden = n !== i;

  // O grupo em edição só faz sentido nas etapas que configuram grupo.
  var deGrupo = n === 2 || n === 3;
  $('cartaoGrupo').hidden = !deGrupo;
  $('editando').hidden = !deGrupo;

  if (n === 1) desenhaPlacas();
  if (deGrupo) redesenhaTudo();
  if (n === 4) desenhaRegras();

  document.querySelectorAll('.aba').forEach(function (aba) {
    aba.setAttribute('aria-current', String(Number(aba.dataset.ir) === n));
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function ligaTexto(id, chave) {
  var el = $(id);
  el.value = S[chave];
  el.addEventListener('input', function () { S[chave] = el.value; salvar(); });
}

/** Ligações que não dependem do cliente: feitas uma vez só. */
function ligaControles() {
  ligaTexto('responsavel', 'responsavel');
  ligaTexto('email', 'email');
  ligaTexto('observacoes', 'observacoes');

  // E-mail conferido ao sair do campo, não a cada tecla: reclamar de
  // "fulano@" enquanto a pessoa ainda digita é brigar com quem preenche.
  $('email').addEventListener('blur', function () {
    var dica = $('dicaEmail');
    var valor = S.email.trim();
    var ruim = valor !== '' && !EMAIL_VALIDO.test(valor);
    dica.textContent = ruim ? 'E-mail inválido — confira se não trocou o ponto por vírgula.' : '';
    dica.classList.toggle('dica--erro', ruim);
    $('email').parentNode.classList.toggle('campo--erro', ruim);
  });

  $('todasManuais').addEventListener('click', function () { marcaTodas('manual'); });
  $('todasAutomaticas').addEventListener('click', function () { marcaTodas('auto'); });

  montaListaModelos();
  $('modeloGrupo').addEventListener('change', function () { aplicaModelo($('modeloGrupo').value); });
  $('duplicarGrupo').addEventListener('click', duplicaGrupo);
  $('editando').addEventListener('click', function () {
    $('cartaoGrupo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('nomeGrupo').addEventListener('input', function () {
    A().nome = $('nomeGrupo').value;
    salvar();
    // Só as fichas: redesenhar a página inteira a cada tecla tiraria o
    // foco de quem está digitando o nome.
    desenhaGrupos();
    $('nomeGrupo').focus();
  });

  document.querySelectorAll('[data-ir]').forEach(function (b) {
    b.addEventListener('click', function () { mostraPagina(Number(b.dataset.ir)); });
  });

  $('ligarTodos').addEventListener('click', function () { ligaTodosAlertas(true); });
  $('desligarTodos').addEventListener('click', function () { ligaTodosAlertas(false); });

  $('abrirResumo').addEventListener('click', function () {
    // O resumo abre mesmo com pendência: quem preencheu tem direito de
    // ver o que respondeu. O que fica bloqueado é o botão de enviar, com
    // a lista do que falta logo acima dele.
    var faltas = pendenciasDoEnvio();
    desenhaResumo(faltas);
    // Reenviar é permitido enquanto o código valer: o botão volta ao normal.
    $('enviar').textContent = 'Enviar respostas';
    $('enviar').style.background = '';
    $('enviar').disabled = faltas.length > 0;
    estado(faltas.length ? 'Corrija os itens acima para liberar o envio.' : '', false);
    $('modal').hidden = false;
    $('fecharResumo').focus();
  });
  $('fecharResumo').addEventListener('click', function () { $('modal').hidden = true; });
  $('modal').addEventListener('click', function (e) {
    if (e.target === $('modal')) $('modal').hidden = true;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('modal').hidden) $('modal').hidden = true;
  });

  $('copiarResumo').addEventListener('click', function () {
    var botao = $('copiarResumo');
    var pronto = function () { botao.textContent = 'Copiado ✓'; };
    if (navigator.clipboard) navigator.clipboard.writeText(resumoTexto()).then(pronto, function () {});
  });

  $('enviar').addEventListener('click', enviar);
}

/** Chamada pelo acesso.js com a base do cliente: { codigo, cliente, placas }. */
function iniciar(base) {
  ACESSO = base;
  S = carregar(base);

  $('nomeCliente').textContent = base.cliente;
  $('tituloCliente').textContent = 'Frota ' + base.cliente;
  $('telaAcesso').hidden = true;
  $('formulario').hidden = false;

  ligaControles();
  mostraPagina(S.pagina >= 1 && S.pagina <= ETAPAS ? S.pagina : 1);
}
