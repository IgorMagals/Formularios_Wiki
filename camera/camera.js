/* camera.js — estado, tela, resumo, envio e acesso do formulário de câmera
   O catálogo (o que se pergunta) está em catalogo.js; aqui só a mecânica.

   Duplicação consciente: acesso, chamaServidor e leResposta são cópia adaptada de
   assets/acesso.js e assets/resumo.js, para não mexer na página da
   telemetria que está no ar. No terceiro formulário, viram um comum.js. */

'use strict';

var S = null;          // { responsavel, email, observacoes, pagina, v: { [id]: valores } }
var ACESSO = null;     // { codigo, cliente, placas } — vem da tela de acesso
var EMAIL_VALIDO = /^[^\s@,]+@[^\s@,]+(\.[^\s@,.]+)*\.[A-Za-zÀ-ÿ]{2,}$/;
var ETAPAS = 4;

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

function visiveis() { return FUNCOES.filter(function (f) { return f.mostrar; }); }

/** Item de valor único (Gravação, Sistema) não tem interruptor próprio. */
function temLiga(f) { return f.campos[0] !== 'valor'; }

/** O campo como esta função o usa: o padrão do catálogo com o ajuste dela. */
function specDe(f, campo) {
  var base = campo === 'valor' ? Object.assign({ coluna: 'valor', curto: '' }, f.valor) : CAMPOS[campo];
  return Object.assign({}, base, (f.ajuste || {})[campo]);
}

function chaveRascunho(codigo) {
  return PREFIXO_RASCUNHO + String(codigo).toUpperCase().replace(/[^A-Z0-9]/g, '') + '-' + CONFIG.RASCUNHO_VERSAO;
}

/* ==================================================================== *
 * ESTADO — rascunho por código, como na telemetria: código novo é
 * formulário novo, e os rascunhos de códigos anteriores são apagados.
 * ==================================================================== */
function carregar(base) {
  var salvo = null, chave = chaveRascunho(base.codigo);
  try {
    salvo = JSON.parse(localStorage.getItem(chave));
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf(PREFIXO_RASCUNHO) === 0 && k !== chave) localStorage.removeItem(k);
    });
  } catch (e) {}
  salvo = salvo || {};

  var v = {};
  FUNCOES.forEach(function (f) { v[f.id] = Object.assign({}, f.padrao, (salvo.v || {})[f.id] || {}); });
  return {
    responsavel: salvo.responsavel || '',
    email: salvo.email || '',
    observacoes: salvo.observacoes || '',
    pagina: salvo.pagina | 0 || 1,
    alarmes: salvo.alarmes !== false,   // chave geral: desligada, nenhum alarme toca na cabine
    v: v
  };
}

function salvar() {
  if (ACESSO.enviado) return;   // depois do envio confirmado, nada volta para o navegador
  try { localStorage.setItem(chaveRascunho(ACESSO.codigo), JSON.stringify(S)); } catch (e) {}
}

/* ==================================================================== *
 * CRÍTICA
 * ==================================================================== */
function criticaNumero(spec, valor) {
  if (String(valor || '') === '') return 'Preencha este campo.';
  var n = Number(valor);
  if (n < spec.min || n > spec.max) return 'Fora do intervalo. Permitido: ' + spec.min + ' a ' + spec.max + '.';
  return '';
}

function acimaDoAviso(spec, valor) {
  return !!spec.aviso && String(valor || '') !== '' && Number(valor) > spec.aviso.acima;
}

/** O que impede o envio, tudo de uma vez. Função desligada não é cobrada. */
function pendenciasDoEnvio() {
  var faltas = [];
  if (!S.responsavel.trim()) faltas.push('Informe o Responsável (etapa 1).');
  if (!EMAIL_VALIDO.test(S.email.trim())) faltas.push('Informe um e-mail válido (etapa 1).');
  visiveis().forEach(function (f) {
    if (temLiga(f) && !S.v[f.id].ligado) return;
    f.campos.forEach(function (c) {
      var spec = specDe(f, c);
      if (spec.tipo !== 'numero') return;
      var erro = criticaNumero(spec, S.v[f.id][c]);
      if (erro) faltas.push(f.nome + (spec.rotulo ? ' — ' + spec.rotulo : '') + ': ' + erro);
    });
  });
  return faltas;
}

/* ==================================================================== *
 * CONTROLES
 * ==================================================================== */
function botaoChave(titulo, dica, ligado, aoTrocar) {
  var b = cria('button', 'alerta');
  b.type = 'button';
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', String(!!ligado));
  var rot = cria('div', 'alerta__rot');
  rot.appendChild(cria('b', null, titulo));
  if (dica) rot.appendChild(cria('span', null, dica));
  b.appendChild(rot);
  b.appendChild(cria('span', 'chave'));
  b.addEventListener('click', function () {
    var novo = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(novo));
    aoTrocar(novo);
    salvar();
  });
  return b;
}

function campoNumero(spec, rotulo, dicaTexto, valor, aoMudar) {
  var label = cria('label', 'campo');
  label.appendChild(cria('span', null, rotulo));
  var medida = cria('div', 'medida');
  var input = cria('input');
  input.type = 'text';             // text + inputmode: ver campos.js da telemetria
  input.inputMode = 'numeric';
  input.placeholder = '—';
  input.value = valor || '';
  input.maxLength = String(spec.max).length;
  input.setAttribute('aria-label', rotulo + (spec.unidade ? ' em ' + spec.unidade : ''));
  medida.appendChild(input);
  if (spec.unidade) medida.appendChild(cria('span', 'medida__unidade', spec.unidade));
  label.appendChild(medida);
  var dica = cria('span', 'dica', dicaTexto || '');
  label.appendChild(dica);

  // Aviso não é erro: o valor é permitido, mas o cliente precisa saber o custo.
  function critica() {
    var erro = criticaNumero(spec, input.value);
    var alerta = !erro && acimaDoAviso(spec, input.value);
    label.classList.toggle('campo--erro', !!erro);
    dica.textContent = erro || (alerta ? spec.aviso.texto : dicaTexto || '');
    dica.classList.toggle('dica--erro', !!erro);
    dica.classList.toggle('dica--alerta', alerta);
  }
  if (acimaDoAviso(spec, valor)) critica();   // rascunho com valor alto já abre avisando
  input.addEventListener('input', function () {
    var limpo = input.value.replace(/\D+/g, '');
    if (limpo !== input.value) input.value = limpo;
    aoMudar(limpo);
    salvar();
    if (label.classList.contains('campo--erro')) critica();
  });
  input.addEventListener('blur', critica);
  return label;
}

function campoOpcao(spec, rotulo, valor, aoMudar) {
  var campo = cria('div', 'campo');
  if (rotulo) campo.appendChild(cria('span', null, rotulo));
  var grupo = cria('div', 'cambio');
  grupo.setAttribute('role', 'group');
  if (rotulo) grupo.setAttribute('aria-label', rotulo);
  spec.opcoes.forEach(function (op) {
    var b = cria('button', null, op);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(op === valor));
    b.addEventListener('click', function () {
      grupo.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      aoMudar(op);
      salvar();
    });
    grupo.appendChild(b);
  });
  campo.appendChild(grupo);
  return campo;
}

/** Um campo de uma função, do tipo que o catálogo disser. */
function controle(f, c) {
  var spec = specDe(f, c), v = S.v[f.id];
  var muda = function (x) { v[c] = x; };
  if (c === 'alarme') {
    // Com a chave geral desligada, o alarme de cada função some da tela —
    // e a escolha dela fica guardada para quando a chave voltar.
    var b = botaoChave(spec.rotulo, '', v[c], muda);
    b.dataset.alarme = '1';
    b.hidden = !S.alarmes;
    return b;
  }
  if (spec.tipo === 'chave') return botaoChave(spec.rotulo, '', v[c], muda);
  if (spec.tipo === 'numero') return campoNumero(spec, spec.rotulo, '', v[c], muda);
  return campoOpcao(spec, spec.rotulo, v[c], muda);
}

/** Item de valor único: o próprio nome da função é o rótulo. */
function controleValor(f) {
  var spec = specDe(f, 'valor'), v = S.v[f.id];
  var muda = function (x) { v.valor = x; };
  if (spec.tipo === 'chave') return botaoChave(f.nome, f.dica, v.valor, muda);
  if (spec.tipo === 'numero') return campoNumero(spec, f.nome, f.dica, v.valor, muda);
  var el = campoOpcao(spec, f.nome, v.valor, muda);
  if (f.dica) el.appendChild(cria('span', 'dica', f.dica));
  return el;
}

/* ==================================================================== *
 * TELA — montada uma vez; os controles escrevem direto no estado.
 * ==================================================================== */
function cabecalhoModulo(m) {
  var topo = cria('div');
  topo.appendChild(cria('div', 'titulo titulo--grande', MODULOS[m].titulo));
  topo.appendChild(cria('div', 'subtitulo', MODULOS[m].sub));
  return topo;
}

function fichaFuncao(f) {
  var sec = cria('section', 'cartao secao funcao');
  var campos = cria('div', 'funcao__campos');
  // Função só de liga/desliga (TSR, TLD, FCL) não deixa caixa vazia na ficha.
  campos.hidden = !S.v[f.id].ligado || !f.campos.length;
  sec.appendChild(botaoChave(f.nome, f.dica + textoEnvio(f), S.v[f.id].ligado, function (novo) {
    S.v[f.id].ligado = novo;
    campos.hidden = !novo || !f.campos.length;   // desligada, os campos não valem: some com eles
  }));
  f.campos.forEach(function (c) { campos.appendChild(controle(f, c)); });
  sec.appendChild(campos);
  return sec;
}

function desenhaModulos() {
  document.querySelectorAll('[data-modulos]').forEach(function (alvo) {
    alvo.textContent = '';
    alvo.dataset.modulos.split(' ').forEach(function (m) {
      var fs = visiveis().filter(function (f) { return f.modulo === m; });
      if (!fs.length) return;
      if (temLiga(fs[0])) {
        var topo = cria('section', 'cartao secao');
        topo.appendChild(cabecalhoModulo(m));
        alvo.appendChild(topo);
        fs.forEach(function (f) { alvo.appendChild(fichaFuncao(f)); });
      } else {
        var sec = cria('section', 'cartao secao');
        sec.appendChild(cabecalhoModulo(m));
        var grade = cria('div', 'funcao__campos');
        fs.forEach(function (f) { grade.appendChild(controleValor(f)); });
        sec.appendChild(grade);
        alvo.appendChild(sec);
      }
    });
  });
}

/** O envio à plataforma é padrão da CORPVS: o cliente lê, não escolhe. */
function textoEnvio(f) {
  var e = (f.fixo || {}).envio;
  return e ? ' Quando acontece, ' + (e === 'foto' ? 'tira e envia uma foto' : 'grava e envia um vídeo') + ' à plataforma.' : '';
}

/* A chave geral, no começo do formulário: quem não quer som na cabine
   desliga uma vez, em vez de função por função. */
function desenhaMestre() {
  var alvo = $('alarmesCabine');
  alvo.textContent = '';
  alvo.appendChild(botaoChave('Alarmes sonoros na cabine',
    'Desligado, nenhuma função toca alarme para o motorista. Os eventos continuam sendo registrados.',
    S.alarmes, function (novo) {
      S.alarmes = novo;
      document.querySelectorAll('[data-alarme="1"]').forEach(function (b) { b.hidden = !novo; });
    }));
}

function desenhaPlacas() {
  var lista = $('listaPlacas');
  lista.textContent = '';
  // Só a placa: a descrição da base costuma ser a própria placa com hífen.
  ACESSO.placas.forEach(function (p) { lista.appendChild(cria('div', 'entrada entrada--fixa', p.placa)); });
  var n = ACESSO.placas.length;
  $('contadorPlacas').textContent = n + (n > 1 ? ' veículos' : ' veículo');
}

function mostraPagina(n) {
  S.pagina = n;
  salvar();
  for (var i = 1; i <= ETAPAS; i++) $('pagina' + i).hidden = n !== i;
  document.querySelectorAll('.aba').forEach(function (aba) {
    aba.setAttribute('aria-current', String(Number(aba.dataset.ir) === n));
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==================================================================== *
 * RESUMO — o que mudou é o que difere do valor atual do equipamento.
 * ==================================================================== */
function alterou(f) {
  var v = S.v[f.id];
  var chaves = (temLiga(f) ? ['ligado'] : []).concat(f.campos);
  return chaves.some(function (c) { return String(v[c]) !== String(f.padrao[c]); });
}

/** O valor que vale de fato: com a chave geral desligada, nenhum alarme toca. */
function valorDe(f, c) {
  return c === 'alarme' ? S.alarmes && S.v[f.id].alarme : S.v[f.id][c];
}

function formata(spec, valor) {
  if (spec.tipo === 'chave') return valor ? 'sim' : 'não';
  return String(valor === undefined ? '' : valor);
}

function descreve(f) {
  var v = S.v[f.id];
  if (!temLiga(f)) {
    var s = specDe(f, 'valor');
    return s.tipo === 'chave' ? (v.valor ? 'Ligado' : 'Desligado')
      : v.valor + (s.unidade ? ' ' + s.unidade : '') + (acimaDoAviso(s, v.valor) ? ' — acima do recomendado (' + s.aviso.acima + ')' : '');
  }
  if (!v.ligado) return 'Desligado';
  if (!f.campos.length) return 'Ligado';
  return f.campos.map(function (c) {
    var s = specDe(f, c);
    return s.curto + ' ' + formata(s, valorDe(f, c)) + (s.tipo === 'numero' && s.unidade ? ' ' + s.unidade : '');
  }).join(' · ') + textoEnvio(f).replace(' Quando acontece, ', ' · ').replace(' à plataforma.', '');
}

function montaResumo() {
  var secoes = [{ titulo: 'IDENTIFICAÇÃO', linhas: [
    { k: 'Empresa', v: ACESSO.cliente },
    { k: 'Responsável', v: S.responsavel || '—' },
    { k: 'E-mail', v: S.email || '—' },
    { k: 'Veículos', v: ACESSO.placas.map(function (p) { return p.placa; }).join(', ') },
    { k: 'Alarmes sonoros na cabine', v: S.alarmes ? 'Ligados' : 'Desligados em todas as funções', alterado: !S.alarmes }
  ] }];
  Object.keys(MODULOS).forEach(function (m) {
    var fs = visiveis().filter(function (f) { return f.modulo === m; });
    if (fs.length) {
      secoes.push({ titulo: MODULOS[m].titulo, linhas: fs.map(function (f) {
        return { k: f.nome, v: descreve(f), alterado: alterou(f) };
      }) });
    }
  });
  if (S.observacoes) secoes.push({ titulo: 'OBSERVAÇÕES', linhas: [{ k: S.observacoes, v: '', alterado: true }] });
  return secoes;
}

function placarTexto() {
  var n = visiveis().filter(alterou).length + (S.alarmes ? 0 : 1);
  return n ? n + (n > 1 ? ' itens alterados' : ' item alterado') + ' em relação ao equipamento hoje'
    : 'nenhum item alterado — fica como está no equipamento';
}

function resumoTexto() {
  return 'CÂMERA ' + ACESSO.cliente.toUpperCase() + ' — CONFIGURAÇÃO\n' + placarTexto() + '\n\n' +
    montaResumo().map(function (s) {
      return s.titulo + '\n' + s.linhas.map(function (l) {
        return '• ' + l.k + (l.v ? ': ' + l.v : '') + (l.alterado ? '   [alterado]' : '');
      }).join('\n');
    }).join('\n\n');
}

function desenhaResumo(faltas) {
  var corpo = $('corpoResumo');
  corpo.textContent = '';
  if (faltas.length) {
    var aviso = cria('div', 'pendencias');
    aviso.appendChild(cria('b', null, faltas.length > 1 ? 'Faltam ' + faltas.length + ' coisas antes de enviar' : 'Falta uma coisa antes de enviar'));
    var ul = cria('ul');
    faltas.forEach(function (f) { ul.appendChild(cria('li', null, f)); });
    aviso.appendChild(ul);
    corpo.appendChild(aviso);
  }
  var placar = cria('div', 'placar' + (visiveis().some(alterou) || !S.alarmes ? '' : ' placar--vazio'));
  placar.textContent = placarTexto();
  corpo.appendChild(placar);
  montaResumo().forEach(function (s) {
    var secao = cria('div', 'grupo-resumo');
    secao.appendChild(cria('b', null, s.titulo));
    s.linhas.forEach(function (l) {
      var linha = cria('div', 'linha-resumo' + (l.alterado ? ' linha-resumo--alterado' : ''));
      var esq = cria('span', null, l.k);
      if (l.alterado) esq.appendChild(cria('span', 'marca-alterado', 'ALTERADO'));
      linha.appendChild(esq);
      linha.appendChild(cria('span', null, l.v));
      secao.appendChild(linha);
    });
    corpo.appendChild(secao);
  });
}

/* ==================================================================== *
 * ENVIO — uma linha por placa e função, colunas iguais em todas.
 * Função desligada vai só com "ligado: não": o resto não vale.
 * ==================================================================== */
function linhasDoEnvio() {
  var linhas = [];
  ACESSO.placas.forEach(function (p) {
    // TODAS as funções, inclusive as que não aparecem: quem configura o
    // equipamento lê a configuração inteira numa aba só.
    FUNCOES.forEach(function (f) {
      var v = S.v[f.id];
      var o = { placa: p.placa, descricao: p.descricao || '', modulo: f.modulo, funcao: f.nome, sigla: f.id };
      COLUNAS.forEach(function (col) { o[col] = ''; });
      if (temLiga(f)) o.ligado = v.ligado ? 'sim' : 'não';
      if (!temLiga(f) || v.ligado) {
        f.campos.forEach(function (c) { var s = specDe(f, c); o[s.coluna] = formata(s, valorDe(f, c)); });
        Object.keys(f.fixo || {}).forEach(function (col) { o[col] = f.fixo[col]; });
        // Sem escolha de alarme na ficha (TSR, TLD, FCL): segue a chave geral.
        if (temLiga(f) && f.campos.indexOf('alarme') === -1) o.alarme_sonoro = S.alarmes ? 'sim' : 'não';
      }
      if (o.alarme_sonoro === 'sim') o.volume = VOLUME_ALARME;   // volume não é pergunta: ver catalogo.js
      o.alterado = alterou(f) ? 'sim' : '';
      linhas.push(o);
    });
  });
  return linhas;
}

function corpoDoEnvio() {
  return {
    acao: 'enviar',
    formulario: CONFIG.FORMULARIO,
    codigo: ACESSO.codigo,
    armadilha: ($('armadilha') || {}).value || '',
    responsavel: S.responsavel,
    email: S.email,
    observacoes: S.observacoes,
    resumo: resumoTexto(),
    linhas: linhasDoEnvio()
  };
}

var ERROS = {
  codigo_invalido: 'Código de acesso não reconhecido. Confira o código do e-mail da CORPVS.',
  codigo_vencido: 'Seu código de acesso venceu. Use "Copiar resumo" para guardar o que preencheu e peça um novo código à CORPVS.',
  formulario_errado: 'Este código é de outro formulário da CORPVS. Abra o link que veio no e-mail.',
  responsavel_vazio: 'Informe o Responsável na etapa 1 antes de enviar.',
  email_invalido: 'Informe um e-mail válido na etapa 1 antes de enviar.',
  sem_placas: 'Nenhum veículo para enviar.',
  placa_invalida: 'Um dos veículos não pertence à sua frota. Recarregue a página e tente de novo.',
  linha_invalida: 'Não foi possível enviar. Recarregue a página e tente de novo.',
  corpo_grande: 'Resposta muito longa. Reduza as observações.',
  falha_interna: 'Não foi possível enviar. Tente de novo em instantes.',
  conexao: 'Sem resposta do servidor. Verifique a conexão e tente de novo.',
  muitas_tentativas: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  sem_servidor: 'O formulário ainda não está ligado ao servidor. Fale com a CORPVS.'
};

function estado(msg, ok) {
  var el = $('estadoEnvio');
  el.textContent = msg;
  el.dataset.ok = ok ? '1' : '0';
}

/** { ok: true } ou { ok: false, erro }. Qualquer outra coisa é null — e null nunca vira confirmação. */
function leResposta(texto) {
  try {
    var j = JSON.parse(String(texto || '').trim());
    if (j && typeof j.ok === 'boolean') return j;
  } catch (e) {}
  return null;
}

/** POST ao Apps Script. text/plain mantém a requisição sem preflight. */
async function chamaServidor(corpo) {
  var corte = new AbortController();
  var relogio = setTimeout(function () { corte.abort(); }, CONFIG.ESPERA_MAX_MS);
  try {
    var r = await fetch(CONFIG.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corpo),
      signal: corte.signal
    });
    return leResposta(await r.text());
  } catch (e) {
    return { ok: false, erro: 'conexao' };
  } finally {
    clearTimeout(relogio);
  }
}

async function enviar() {
  var botao = $('enviar');
  var faltas = pendenciasDoEnvio();
  if (faltas.length) {
    estado(faltas.length > 1 ? 'Faltam ' + faltas.length + ' itens. Veja a lista acima.' : faltas[0], false);
    botao.disabled = true;
    return;
  }
  var corpo = corpoDoEnvio();
  if (JSON.stringify(corpo).length > CONFIG.CORPO_MAX) { estado(ERROS.corpo_grande, false); return; }

  botao.disabled = true;
  botao.textContent = 'Enviando…';
  estado('', false);
  var resposta = await chamaServidor(corpo);

  if (resposta && resposta.ok === true) {
    ACESSO.enviado = true;
    try { localStorage.removeItem(chaveRascunho(ACESSO.codigo)); } catch (e) {}
    botao.textContent = 'Enviado ✓';
    botao.style.background = 'var(--verde)';
    estado('Recebemos a configuração. Obrigado!', true);
    return;
  }
  botao.textContent = 'Tentar de novo';
  botao.disabled = false;
  if (!resposta) estado('Enviado — aguarde nossa confirmação por e-mail.', false);   // ilegível: não confirma
  else estado(ERROS[resposta.erro] || ERROS.falha_interna, false);
}

/* ==================================================================== *
 * LIGAÇÕES E INÍCIO
 * ==================================================================== */
function ligaTexto(id, chave) {
  var el = $(id);
  el.value = S[chave];
  el.addEventListener('input', function () { S[chave] = el.value; salvar(); });
}

function ligaControles() {
  ligaTexto('responsavel', 'responsavel');
  ligaTexto('email', 'email');
  ligaTexto('observacoes', 'observacoes');

  $('email').addEventListener('blur', function () {
    var valor = S.email.trim();
    var ruim = valor !== '' && !EMAIL_VALIDO.test(valor);
    $('dicaEmail').textContent = ruim ? 'E-mail inválido — confira se não trocou o ponto por vírgula.' : '';
    $('dicaEmail').classList.toggle('dica--erro', ruim);
    $('email').parentNode.classList.toggle('campo--erro', ruim);
  });

  document.querySelectorAll('[data-ir]').forEach(function (b) {
    b.addEventListener('click', function () { mostraPagina(Number(b.dataset.ir)); });
  });

  $('abrirResumo').addEventListener('click', function () {
    var faltas = pendenciasDoEnvio();
    desenhaResumo(faltas);
    $('enviar').textContent = 'Enviar respostas';
    $('enviar').style.background = '';
    $('enviar').disabled = faltas.length > 0;
    estado(faltas.length ? 'Corrija os itens acima para liberar o envio.' : '', false);
    $('modal').hidden = false;
    $('fecharResumo').focus();
  });
  $('fecharResumo').addEventListener('click', function () { $('modal').hidden = true; });
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) $('modal').hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('modal').hidden) $('modal').hidden = true;
  });
  $('copiarResumo').addEventListener('click', function () {
    if (navigator.clipboard) navigator.clipboard.writeText(resumoTexto()).then(function () { $('copiarResumo').textContent = 'Copiado ✓'; }, function () {});
  });
  $('enviar').addEventListener('click', enviar);
}

function iniciar(base) {
  ACESSO = base;
  S = carregar(base);
  $('nomeCliente').textContent = base.cliente;
  $('tituloCliente').textContent = 'Câmeras ' + base.cliente;
  $('telaAcesso').hidden = true;
  $('formulario').hidden = false;
  ligaControles();
  desenhaPlacas();
  desenhaMestre();
  desenhaModulos();
  mostraPagina(S.pagina >= 1 && S.pagina <= ETAPAS ? S.pagina : 1);
}

/* --- Acesso: o código vem no link do e-mail (…/#ABCD-EFGH) ou digitado. */
function estadoAcesso(msg, erro) {
  var el = $('estadoAcesso');
  el.textContent = msg;
  el.classList.toggle('dica--erro', !!erro);
}

async function abrirComCodigo(codigo) {
  codigo = String(codigo || '').trim().toUpperCase();
  if (!codigo) return;
  if (!CONFIG.ENDPOINT) { estadoAcesso(ERROS.sem_servidor, true); return; }

  $('abrir').disabled = true;
  estadoAcesso('Conferindo o código…', false);
  var r = await chamaServidor({ acao: 'abrir', formulario: CONFIG.FORMULARIO, codigo: codigo });
  $('abrir').disabled = false;

  if (!r || !r.ok) {
    try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) {}
    estadoAcesso(ERROS[r && r.erro] || ERROS.codigo_invalido, true);
    return;
  }
  if (!Array.isArray(r.placas) || !r.placas.length) {
    estadoAcesso('Nenhum veículo cadastrado para a sua empresa. Fale com a CORPVS.', true);
    return;
  }
  try { sessionStorage.setItem(CHAVE_SESSAO, codigo); } catch (e) {}
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  iniciar({ codigo: codigo, cliente: r.cliente, placas: r.placas });
}

(function () {
  $('formAcesso').addEventListener('submit', function (e) {
    e.preventDefault();
    abrirComCodigo($('codigo').value);
  });
  var doLink = decodeURIComponent(location.hash.slice(1));
  var daSessao = '';
  try { daSessao = sessionStorage.getItem(CHAVE_SESSAO) || ''; } catch (e) {}
  var codigo = doLink || daSessao;
  if (codigo) {
    $('codigo').value = codigo;
    abrirComCodigo(codigo);
  } else {
    $('codigo').focus();
  }
})();
