/* campos.js — controles numéricos, críticas de valor e barra de rotação
   Parte do formulário de telemetria. index.html carrega na ordem
   catalogo.js → campos.js → resumo.js → app.js, todos com defer,
   que preserva a ordem. */

'use strict';

/* ==================================================================== *
 * CAMPOS NUMÉRICOS
 * ==================================================================== */
function campoMedida(def) {
  var chave = def[0], rotulo = def[1], unidade = def[2], soManual = def[3], dicaTexto = def[4];

  var label = cria('label', 'campo');
  label.appendChild(cria('span', null, rotulo));

  var medida = cria('div', 'medida');
  if (soManual) medida.dataset.soManual = '1';

  var lim = LIMITES[chave];

  var input = cria('input');
  // type="text" e não "number": com number, o navegador esconde o que foi
  // digitado de errado (devolve string vazia) e não dá para filtrar nem
  // avisar. inputmode="numeric" mantém o teclado numérico no telefone.
  input.type = 'text';
  input.inputMode = 'numeric';
  input.placeholder = '—';
  input.value = A().f[chave] || '';
  input.setAttribute('aria-label', rotulo + (unidade ? ' em ' + unidade : ''));
  if (lim) {
    input.maxLength = lim.digitos;
    input.setAttribute('aria-describedby', 'dica-' + chave);
    input.setAttribute('aria-valuemin', lim.min);
    input.setAttribute('aria-valuemax', lim.max);
  }

  input.addEventListener('input', function () {
    // Só dígito entra. Qualquer outra tecla some na hora, sem mensagem:
    // avisar a cada letra digitada é ruído — o limite se explica sozinho.
    var limpo = input.value.replace(/\D+/g, '');
    if (lim) limpo = limpo.slice(0, lim.digitos);
    if (limpo !== input.value) {
      var pos = input.selectionStart;
      input.value = limpo;
      try { input.setSelectionRange(pos - 1, pos - 1); } catch (e) {}
    }
    A().f[chave] = limpo;
    salvar();
    if (label.classList.contains('campo--erro')) criticaNaTela(chave);
  });

  // A crítica de intervalo só no blur: reclamar de "8" enquanto a pessoa
  // ainda vai digitar o "0" de "80" é brigar com quem está preenchendo.
  input.addEventListener('blur', function () { criticaNaTela(chave); });

  medida.appendChild(input);
  medida.appendChild(cria('span', 'medida__unidade', unidade));
  label.appendChild(medida);

  var dica = cria('span', 'dica', dicaTexto || '');
  dica.id = 'dica-' + chave;
  dica.dataset.original = dicaTexto || '';
  label.appendChild(dica);

  label.dataset.campo = chave;
  return label;
}

/** Mostra (ou tira) o erro de um campo numérico na tela. */
function criticaNaTela(chave) {
  var label = document.querySelector('[data-campo="' + chave + '"]');
  if (!label) return null;
  var dica = label.querySelector('.dica');
  var erro = criticaCampo(chave, A().f[chave]);

  if (erro) {
    label.classList.add('campo--erro');
    dica.textContent = erro + ' Permitido: ' + LIMITES[chave].min + ' a ' + LIMITES[chave].max + '.';
    dica.classList.add('dica--erro');
    dica.classList.remove('dica--alerta');
  } else {
    label.classList.remove('campo--erro');
    dica.classList.remove('dica--erro');
    // devolve a dica que o campo tinha — ou o aviso de câmbio automático,
    // que aplicaAutomaticos() reescreve por cima quando for o caso
    dica.textContent = dica.dataset.original || '';
    aplicaAutomaticos();
  }
  return erro;
}

/** Todos os campos fora do intervalo, para barrar o envio de uma vez só. */
function camposInvalidos() {
  return Object.keys(LIMITES)
    .map(function (k) { return { chave: k, erro: criticaCampo(k, A().f[k]) }; })
    .filter(function (r) { return r.erro; });
}

/** Rótulo legível de um campo, para a mensagem de "corrija isto". */
function rotuloDe(chave) {
  var achado = null;
  BLOCOS.forEach(function (bk) {
    bk.campos.forEach(function (c) { if (c[0] === chave) achado = c[1]; });
  });
  CAMPOS_RPM.forEach(function (c) { if (c[0] === chave) achado = c[1]; });
  return achado || chave;
}

function desenhaBlocos() {
  var alvo = $('blocos');
  alvo.textContent = '';

  BLOCOS.forEach(function (bk) {
    var sec = cria('section', 'cartao secao');

    var topo = cria('div', 'cabecalho-bloco');
    var esq = cria('div');
    esq.appendChild(cria('div', 'numero-bloco', bk.num));
    esq.appendChild(cria('div', 'titulo titulo--grande', bk.titulo));
    topo.appendChild(esq);

    topo.appendChild(caixaUnidade(bk.unidade));
    sec.appendChild(topo);

    var campos = cria('div', 'campos-bloco');
    bk.campos.forEach(function (c) { campos.appendChild(campoMedida(c)); });
    sec.appendChild(campos);


    alvo.appendChild(sec);
  });

  var rpm = $('camposRpm');
  rpm.textContent = '';
  CAMPOS_RPM.forEach(function (c) { rpm.appendChild(campoMedida(c)); });
}

function caixaUnidade(texto) {
  var d = cria('div', 'unidade');
  d.appendChild(cria('small', null, 'UNIDADE'));
  d.appendChild(cria('b', null, texto));
  return d;
}

/* ==================================================================== *
 * FAIXAS DE ROTAÇÃO — barra, marcas e campos
 * ==================================================================== */
/* A barra é construída UMA vez; o arrasto só move posições.
   Reconstruir os nós a cada evento de ponteiro custa caro no telefone e
   troca a alça debaixo do dedo por outra igual. */
var refFaixas = [];
var refAlcas = [];

function pct(v) { return Math.max(0, Math.min(100, v / CONFIG.RPM_MAX * 100)) + '%'; }

function desenhaBarra() {
  var barra = $('barra');
  barra.textContent = '';
  refFaixas = [];
  refAlcas = [];

  FAIXAS_NOME.forEach(function (nome, i) {
    var f = cria('div', 'barra__faixa');
    f.style.background = FAIXAS_COR[i];
    f.title = nome;
    barra.appendChild(f);
    refFaixas.push(f);
  });

  for (var i = 1; i <= ALCAS; i++) {
    (function (idx) {
      var alca = cria('button', 'barra__alca');
      alca.type = 'button';
      alca.title = 'Arraste para ajustar';
      alca.addEventListener('pointerdown', function (e) { iniciaArrasto(idx, e); });
      // Teclado: a alça também anda de seta, senão só existe para mouse e toque.
      alca.addEventListener('keydown', function (e) {
        var passo = e.shiftKey ? CONFIG.RPM_PASSO * 10 : CONFIG.RPM_PASSO;
        var d = e.key === 'ArrowRight' ? passo : (e.key === 'ArrowLeft' ? -passo : 0);
        if (!d) return;
        e.preventDefault();
        A().b = mover(A().b, idx, limites(A().b, CONFIG)[idx] + d, CONFIG);
        salvar();
        atualizaBarra();
        atualizaCamposFaixas();
      });
      barra.appendChild(alca);
      refAlcas.push(alca);
    })(i);
  }

  var marcas = $('marcas');
  marcas.textContent = '';
  for (var t = 0; t <= CONFIG.RPM_MAX; t += 500) {
    var m = cria('span', null, t % 1000 === 0 ? String(t) : '');
    m.style.left = pct(t);
    // As duas pontas encostam na borda em vez de centralizar: centrado, o
    // "4000" sairia meia palavra para fora e a tela ganharia rolagem
    // horizontal no telefone.
    if (t === 0) m.style.transform = 'none';
    else if (t === CONFIG.RPM_MAX) m.style.transform = 'translateX(-100%)';
    marcas.appendChild(m);
  }

  atualizaBarra();
}

function atualizaBarra() {
  var b = limites(A().b, CONFIG);

  refFaixas.forEach(function (f, i) {
    f.style.left = pct(b[i]);
    f.style.width = pct(b[i + 1] - b[i]);
  });

  refAlcas.forEach(function (alca, k) {
    var idx = k + 1;
    alca.style.left = pct(b[idx]);
    alca.setAttribute('aria-label',
      'Limite entre ' + FAIXAS_NOME[idx - 1] + ' e ' + FAIXAS_NOME[idx] + ': ' + b[idx] + ' RPM');
    if (arrastando === idx) alca.dataset.arrastando = '1';
    else alca.removeAttribute('data-arrastando');
  });
}

function iniciaArrasto(i, ev) {
  ev.preventDefault();
  var barra = $('barra');
  arrastando = i;
  atualizaBarra();

  function move(e) {
    var r = barra.getBoundingClientRect();
    if (!r.width) return;
    var valor = (e.clientX - r.left) / r.width * CONFIG.RPM_MAX;
    A().b = mover(A().b, i, valor, CONFIG);
    atualizaBarra();
    atualizaCamposFaixas();
  }
  function solta() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', solta);
    window.removeEventListener('pointercancel', solta);
    arrastando = -1;
    salvar();
    atualizaBarra();
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', solta);
  window.addEventListener('pointercancel', solta);
}
function desenhaFaixas() {
  var lista = $('listaFaixas');
  lista.textContent = '';

  FAIXAS_NOME.forEach(function (nome, i) {
    var linha = cria('div', 'faixa');

    var cor = cria('span', 'faixa__cor');
    cor.style.background = FAIXAS_COR[i];
    linha.appendChild(cor);

    var rot = cria('div', 'faixa__nome');
    rot.appendChild(cria('b', null, nome));
    rot.appendChild(cria('span', null,
      i === 0 ? 'RPM abaixo do ideal · só manuais' : (i === ULTIMA_FAIXA ? 'até o máximo' : '')));
    linha.appendChild(rot);

    linha.appendChild(campoLimite(i, 'inicio'));
    linha.appendChild(cria('span', 'faixa__tra', '–'));
    linha.appendChild(campoLimite(i, 'fim'));

    lista.appendChild(linha);
  });

  atualizaCamposFaixas();
}

/**
 * Campo de limite de faixa. O início da primeira e o fim da última são
 * travados: um é a marcha lenta, o outro é o máximo do equipamento.
 */
function campoLimite(i, qual) {
  var idx = qual === 'inicio' ? i : i + 1;
  var travado = (qual === 'inicio' && i === 0) || (qual === 'fim' && i === ULTIMA_FAIXA);

  var input = cria('input');
  input.setAttribute('aria-label', (qual === 'inicio' ? 'Início' : 'Fim') + ' da faixa ' + FAIXAS_NOME[i]);
  input.dataset.limite = String(idx);

  if (travado) {
    input.type = 'text';
    input.value = qual === 'inicio' ? 'ML+50' : 'máx.';
    input.disabled = true;
    return input;
  }

  input.type = 'number';
  input.inputMode = 'numeric';
  input.step = String(CONFIG.RPM_PASSO);
  input.addEventListener('input', function () {
    var v = A().b.slice();
    v[idx] = input.value;
    A().b = v;
    atualizaBarra();          // a barra acompanha a digitação
  });
  input.addEventListener('blur', function () {
    // Só no blur se reordena: reordenar a cada tecla puxaria o valor
    // debaixo de quem ainda está digitando.
    A().b = normalizar(A().b, idx, CONFIG);
    salvar();
    atualizaBarra();
    atualizaCamposFaixas();
  });
  return input;
}

function atualizaCamposFaixas() {
  var b = limites(A().b, CONFIG);
  document.querySelectorAll('.faixa input[data-limite]').forEach(function (input) {
    if (input.disabled) return;
    input.value = b[Number(input.dataset.limite)];
  });
}
