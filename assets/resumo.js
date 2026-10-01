/* resumo.js — montagem do resumo e envio das respostas
   Parte do formulário de telemetria. Ver a ordem de carga no index.html. */

'use strict';

/* ==================================================================== *
 * RESUMO
 * ==================================================================== */
/* -------------------------------------------------------------------- *
 * O QUE O CLIENTE REALMENTE MUDOU
 *
 * O formulário nasce com os padrões preenchidos — é o que o cabeçalho
 * promete, e deixar tudo em branco faria o cliente achar que precisa
 * preencher todos os campos. O problema disso é do outro lado: quem
 * abre a planilha não distingue "o cliente escolheu 90 km/h" de "o
 * cliente não olhou".
 *
 * A saída é comparar com o padrão e dizer a diferença — na tela, no
 * resumo e numa coluna da planilha. Alterado é o que está DIFERENTE do
 * padrão; reescrever o mesmo número não conta, porque o que interessa é
 * o valor, não o gesto.
 * -------------------------------------------------------------------- */
function alterouCampo(c, chave) {
  return String(c.f[chave] || '') !== String(PADRAO[chave] || '');
}

function alterouFaixas(c) {
  var b = limites(c.b, CONFIG);
  var base = faixasBase(c, CONFIG);
  return b.some(function (v, i) { return v !== base[i]; });
}

/** Lista legível do que saiu do padrão — é o que vai para a planilha. */
function listaAlterados(c) {
  var fora = [];
  if (alterouFaixas(c)) fora.push('faixas de rotação');
  Object.keys(PADRAO).forEach(function (k) {
    if (alterouCampo(c, k)) fora.push(rotuloDe(k) + ': ' + (c.f[k] || 'em branco'));
  });
  ALERTAS.forEach(function (a) {
    if (!c.audio[a[0]]) fora.push('alerta desligado: ' + a[1]);   // padrão: tudo ligado
  });
  return fora;
}

function valorOu(c, chave, unidade) {
  return c.f[chave] ? c.f[chave] + ' ' + unidade : 'manter atual';
}

/** Linha do resumo para um campo numérico, já marcada como alterada. */
function linhaCampo(c, rotulo, chave, unidade) {
  return { k: rotulo, v: valorOu(c, chave, unidade), alterado: alterouCampo(c, chave) };
}

/** As seções de resumo de UM grupo. */
function resumoDoGrupo(g, i) {
  var b = limites(g.b, CONFIG);
  var base = faixasBase(g, CONFIG);
  var modelo = modeloPorId(g.modelo);

  return [
    { titulo: 'PLACAS', linhas: [{ k: 'Modelo', v: modelo ? modelo.nome : 'não informado — faixas padrão' }]
      .concat(placasDoGrupo(i).map(function (p) {
        return { k: p.placa, v: p.cambio === 'auto' ? 'Automático' : p.cambio === 'manual' ? 'Manual' : 'câmbio não marcado' };
      })) },
    { titulo: 'FAIXAS DE ROTAÇÃO (RPM)', linhas: FAIXAS_NOME.map(function (nome, j) {
      return {
        k: j === 0 ? nome + ' — RPM abaixo do ideal (só manuais)' : nome,
        v: j === 0 ? 'marcha lenta + 50 – ' + b[1]
          : (j === ULTIMA_FAIXA ? b[j] + ' – máx.' : b[j] + ' – ' + b[j + 1]),
        alterado: b[j] !== base[j] || b[j + 1] !== base[j + 1]
      };
    }) },
    { titulo: 'ROTAÇÃO · VELOCIDADE · CONDUÇÃO', linhas: [
      linhaCampo(g, 'Parado acelerando', 'rpmStop', 'RPM'),
      { k: 'Banguela (só manuais)', v: 'fixo' },
      linhaCampo(g, 'Excesso de velocidade', 'spdMax', 'km/h'),
      linhaCampo(g, 'Vel. mínima p/ curva brusca', 'spdCurve', 'km/h'),
      linhaCampo(g, 'Aceleração brusca', 'accel', 'km/h/s'),
      linhaCampo(g, 'Frenagem brusca', 'brake', 'km/h/s')
    ] },
    { titulo: 'ALERTAS SONOROS', linhas: ALERTAS.map(function (a) {
      return { k: a[1], v: g.audio[a[0]] ? 'Ligado' : 'Desligado', alterado: !g.audio[a[0]] };
    }) }
  ];
}

/**
 * O resumo inteiro: identificação, cada grupo com as suas placas, e o
 * ranking.
 *
 * Com mais de um grupo, o título de cada seção leva o nome do grupo na
 * frente — revisar dois blocos "FAIXAS DE ROTAÇÃO" sem saber de qual
 * grupo é cada um seria pior que não mostrar.
 */
function montaResumo() {
  var secoes = [{ titulo: 'IDENTIFICAÇÃO', linhas: [
    { k: 'Empresa', v: ACESSO.cliente },
    { k: 'Responsável', v: S.responsavel || '—' },
    { k: 'E-mail', v: S.email || '—' }
  ] }];

  var indices = gruposComPlacas();
  var varios = indices.length > 1;
  indices.forEach(function (i) {
    var nome = rotuloGrupo(S.grupos[i], i);
    resumoDoGrupo(S.grupos[i], i).forEach(function (s) {
      secoes.push({ titulo: varios ? nome.toUpperCase() + ' · ' + s.titulo : s.titulo, linhas: s.linhas });
    });
  });

  var vazios = [];
  S.grupos.forEach(function (g, i) { if (indices.indexOf(i) === -1) vazios.push({ k: rotuloGrupo(g, i), v: '' }); });
  if (vazios.length) secoes.push({ titulo: 'GRUPOS SEM PLACA — NÃO VÃO NO ENVIO', linhas: vazios });

  var regras = regrasLigadas();
  secoes.push({ titulo: 'RANKING DE MOTORISTAS', linhas: regras.length
    ? regras.map(function (r) {
      var d = regraDe(r[0]);
      return { k: r[1], v: (d.qtd || '?') + (d.qtd === '1' ? ' vez' : ' vezes') + ' → perde ' + (d.pts || '?') + (d.pts === '1' ? ' ponto' : ' pontos') };
    })
    : [{ k: 'Nenhuma regra ligada', v: '' }] });

  if (S.observacoes) {
    secoes.push({ titulo: 'OBSERVAÇÕES', linhas: [{ k: S.observacoes, v: '', alterado: true }] });
  }
  return secoes;
}

/** Quantos itens saíram do padrão, somando os grupos que vão no envio. */
function totalAlterados() {
  return gruposComPlacas().reduce(function (t, i) { return t + listaAlterados(S.grupos[i]).length; }, 0);
}

/** "15 placas · 2 grupos · 5 itens alterados" — o cabeçalho do resumo. */
function placarTexto() {
  var n = totalAlterados();
  var g = gruposComPlacas().length;
  var cabeca = S.placas.length + ' placas · ' + g + (g > 1 ? ' grupos' : ' grupo') + ' · ';
  return n
    ? cabeca + n + (n > 1 ? ' itens alterados' : ' item alterado') + ' em relação ao padrão'
    : cabeca + 'nenhum item alterado — configuração padrão';
}

function resumoTexto() {
  var cabeca = 'TELEMETRIA ' + ACESSO.cliente.toUpperCase() + ' — CONFIGURAÇÃO\n' + placarTexto() + '\n\n';
  return cabeca + montaResumo().map(function (s) {
    return s.titulo + '\n' + s.linhas.map(function (l) {
      return '• ' + l.k + (l.v ? ': ' + l.v : '') + (l.alterado ? '   [alterado]' : '');
    }).join('\n');
  }).join('\n\n');
}

/**
 * Desenha o resumo. Recebe a lista de pendências do envio, que aparece
 * em primeiro lugar quando existe — o cliente vê o que falta antes de
 * procurar o botão que não funciona.
 */
function desenhaResumo(faltas) {
  var corpo = $('corpoResumo');
  corpo.textContent = '';

  if (faltas && faltas.length) {
    var aviso = cria('div', 'pendencias');
    aviso.appendChild(cria('b', null,
      faltas.length > 1 ? 'Faltam ' + faltas.length + ' coisas antes de enviar' : 'Falta uma coisa antes de enviar'));
    var lista = cria('ul');
    faltas.forEach(function (f) { lista.appendChild(cria('li', null, f)); });
    aviso.appendChild(lista);
    corpo.appendChild(aviso);
  }

  var placar = cria('div', 'placar' + (totalAlterados() ? '' : ' placar--vazio'));
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
 * ENVIO
 * ==================================================================== */

/* O que uma placa automática não tem. Na linha dela esses valores saem
   vazios — é o que diz a quem configura que o equipamento não recebe o
   comando, e não que o cliente esqueceu de preencher. */
var SO_MANUAL_CAMPOS = [];
BLOCOS.forEach(function (bk) { bk.campos.forEach(function (c) { if (c[3]) SO_MANUAL_CAMPOS.push(c[0]); }); });
CAMPOS_RPM.forEach(function (c) { if (c[3]) SO_MANUAL_CAMPOS.push(c[0]); });

/**
 * Uma linha da planilha, para UMA placa: a configuração final dela.
 *
 * Quem configura lê uma linha e tem tudo ali — grupo, câmbio, faixas,
 * campos e alertas — sem cruzar com outra aba. A identificação do
 * cliente é posta pelo Apps Script, a partir do código de acesso.
 */
function linhaDaPlaca(p) {
  var g = S.grupos[p.grupo];
  var auto = p.cambio === 'auto';
  var fora = listaAlterados(g);

  var out = {
    placa: p.placa,
    descricao: p.descricao,
    cambio: auto ? 'Automático' : 'Manual',
    grupo: rotuloGrupo(g, p.grupo),
    grupo_n: p.grupo + 1,
    modelo: (modeloPorId(g.modelo) || {}).nome || '',
    // O que o cliente mudou, em primeiro lugar: é por onde a leitura
    // começa, em vez de comparar quarenta colunas com o padrão.
    qtd_alterados: fora.length,
    alterados: fora.join(' | ')
  };

  /* A planilha e o equipamento falam em SETE faixas; a tela, em quatro.
     A tradução acontece aqui, e só aqui. */
  var sis = faixasDoSistema(g.b, CONFIG);
  var ultimaSis = FAIXAS_SISTEMA_NOME.length - 1;
  FAIXAS_SISTEMA_NOME.forEach(function (nome, i) {
    var chave = 'faixa_' + nome.toLowerCase().replace(/ /g, '_');
    out[chave] = i === 0 ? (auto ? '' : 'ML+50–' + sis[1])   // azul: só manuais
      : (i === ultimaSis ? sis[i] + '–máx' : sis[i] + '–' + sis[i + 1]);
  });

  /* Os limites também vão como número, cada um na sua coluna: redigitar
     "1100–1300" sete vezes por placa é erro esperando acontecer. */
  for (var i = 1; i < sis.length - 1; i++) out['limite_' + i] = sis[i];
  out.limite_min = sis[0];
  out.limite_max = sis[sis.length - 1];

  Object.keys(PADRAO).forEach(function (k) {
    out[k] = auto && SO_MANUAL_CAMPOS.indexOf(k) !== -1 ? '' : (g.f[k] || '');
  });
  ALERTAS.forEach(function (a) {
    out['audio_' + a[0]] = auto && a[3] ? '' : (g.audio[a[0]] ? 'ligado' : 'desligado');
  });
  return out;
}

function corpoDoEnvio() {
  return {
    acao: 'enviar',
    codigo: ACESSO.codigo,
    armadilha: ($('armadilha') || {}).value || '',   // vazio em gente de verdade
    responsavel: S.responsavel,
    email: S.email,
    observacoes: S.observacoes,
    // O mesmo texto do botão "Copiar resumo": vai no e-mail de aviso da
    // CORPVS, não na planilha.
    resumo: resumoTexto(),
    linhas: S.placas.map(linhaDaPlaca),
    regras: regrasLigadas().map(function (r) {
      var d = regraDe(r[0]);
      return { lista: r[2], id: r[0], regra: r[1], quantidade: Number(d.qtd), pontos: Number(d.pts) };
    })
  };
}

var ERROS = {
  codigo_invalido: 'Código de acesso não reconhecido. Abra de novo o link do e-mail da CORPVS.',
  codigo_vencido: 'Seu código de acesso venceu. Use "Copiar resumo" para guardar o que preencheu e peça um novo código à CORPVS.',
  responsavel_vazio: 'Informe o Responsável na etapa 1 antes de enviar.',
  email_invalido: 'Informe um e-mail válido na etapa 1 antes de enviar.',
  sem_placas: 'Nenhuma placa para enviar.',
  placa_invalida: 'Uma das placas não pertence à sua frota. Recarregue a página e tente de novo.',
  linha_invalida: 'Não foi possível enviar. Recarregue a página e tente de novo.',
  corpo_grande: 'Resposta muito longa. Reduza as observações.',
  json_invalido: 'Não foi possível enviar. Tente de novo em instantes.',
  acao_invalida: 'Não foi possível enviar. Tente de novo em instantes.',
  falha_interna: 'Não foi possível enviar. Tente de novo em instantes.',
  conexao: 'Sem resposta do servidor. Verifique a conexão e tente de novo.',
  muitas_tentativas: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo — o que você preencheu continua aqui.'
};

function estado(msg, ok) {
  var el = $('estadoEnvio');
  el.textContent = msg;
  el.dataset.ok = ok ? '1' : '0';
}

/**
 * Lê a resposta do Apps Script: { ok: true } ou { ok: false, erro }.
 * Qualquer outra coisa devolve null — e null NUNCA vira confirmação.
 */
function leResposta(texto) {
  try {
    var j = JSON.parse(String(texto || '').trim());
    if (j && typeof j.ok === 'boolean') return j;
  } catch (e) { /* não é JSON */ }
  return null;
}

/** POST ao Apps Script. text/plain mantém a requisição sem preflight. */
async function chamaServidor(corpo) {
  // O Apps Script parado há tempo demora alguns segundos para acordar; sem
  // limite, uma queda de rede deixava a tela em "Conferindo…" para sempre.
  var corte = new AbortController();
  var relogio = setTimeout(function () { corte.abort(); }, CONFIG.ESPERA_MAX_MS);
  try {
    var r = await fetch(CONFIG.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corpo),
      signal: corte.signal
    });
    // A resposta é lida de verdade: o envio antigo usava mode:'no-cors',
    // que resolve com sucesso mesmo quando o outro lado recusa.
    return leResposta(await r.text());
  } catch (e) {
    return { ok: false, erro: 'conexao' };
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * Um envio só, com todas as placas. O cliente pode reenviar enquanto o
 * código valer: cada envio fica na planilha, e vale o último.
 */
async function enviar() {
  var botao = $('enviar');

  // Uma barreira só, com tudo o que falta — a mesma lista que o resumo
  // mostra. Checagem duplicada aqui e ali é como um lado fica para trás.
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
    // Envio confirmado: o rascunho sai do navegador. Num computador
    // compartilhado, a configuração não fica para o próximo que abrir.
    // Enquanto a aba estiver aberta, dá para revisar e reenviar.
    ACESSO.enviado = true;
    try { localStorage.removeItem(chaveRascunho(ACESSO.codigo)); } catch (e) {}

    botao.textContent = 'Enviado ✓';
    botao.style.background = 'var(--verde)';
    estado('Recebemos a configuração de ' + corpo.linhas.length + ' placas. Obrigado!', true);
    return;
  }

  botao.textContent = 'Tentar de novo';
  botao.disabled = false;
  if (!resposta) estado('Enviado — aguarde nossa confirmação por e-mail.', false);   // ilegível: não confirma
  else estado(ERROS[resposta.erro] || ERROS.falha_interna, false);
}
