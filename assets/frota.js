/* frota.js — placas, câmbio e grupos
   Parte do formulário de telemetria. Ver a ordem de carga no index.html. */

'use strict';

/* ==================================================================== *
 * GRUPOS
 *
 * As placas vêm da base da CORPVS, pelo código de acesso. O cliente não
 * digita nenhuma: só marca o câmbio de cada uma e separa em grupos.
 *
 * Grupo é o único mecanismo de configuração. Placas no mesmo grupo
 * recebem a mesma configuração inteira; uma placa diferente das outras
 * vai para um grupo só dela. Não existe "exceção por placa" — seria um
 * segundo jeito de fazer a mesma coisa, e dois jeitos é onde o cliente
 * se perde.
 *
 * O câmbio é da PLACA, não do grupo: um grupo pode misturar manual e
 * automático, e na saída cada placa automática vai sem banguela, faixa
 * azul e RPM abaixo do ideal.
 * ==================================================================== */

/** Nome que aparece quando o cliente ainda não nomeou o grupo. */
function rotuloGrupo(g, i) {
  return g.nome.trim() || 'Grupo ' + (i + 1);
}

function placasDoGrupo(i) {
  return S.placas.filter(function (p) { return p.grupo === i; });
}

/** "4 placas · 3 aut. · 1 man." — o que o grupo tem, numa linha. */
function descreveGrupo(i) {
  var ps = placasDoGrupo(i);
  if (!ps.length) return 'sem placas';
  var a = ps.filter(function (p) { return p.cambio === 'auto'; }).length;
  var m = ps.filter(function (p) { return p.cambio === 'manual'; }).length;
  var partes = [ps.length + (ps.length > 1 ? ' placas' : ' placa')];
  if (a) partes.push(a + ' aut.');
  if (m) partes.push(m + ' man.');
  if (ps.length - a - m) partes.push((ps.length - a - m) + ' sem câmbio');
  return partes.join(' · ');
}

/* ==================================================================== *
 * ETAPA 1 — FROTA
 * ==================================================================== */
function desenhaPlacas() {
  var lista = $('listaPlacas');
  lista.textContent = '';

  S.placas.forEach(function (p) {
    var linha = cria('div', 'placa-linha' + (p.cambio ? '' : ' placa-linha--pendente'));

    var id = cria('div', 'placa-linha__id');
    id.appendChild(cria('b', null, p.placa));
    if (p.descricao) id.appendChild(cria('span', null, p.descricao));
    linha.appendChild(id);

    var cambio = cria('div', 'cambio');
    [['Manual', 'manual'], ['Automático', 'auto']].forEach(function (op) {
      var b = cria('button', null, op[0]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(p.cambio === op[1]));
      b.setAttribute('aria-label', op[0] + ' — ' + p.placa);
      b.addEventListener('click', function () {
        p.cambio = op[1];
        salvar();
        desenhaPlacas();
      });
      cambio.appendChild(b);
    });
    linha.appendChild(cambio);

    var sel = cria('select', 'entrada placa-linha__grupo');
    sel.setAttribute('aria-label', 'Grupo da placa ' + p.placa);
    S.grupos.forEach(function (g, i) {
      var op = cria('option', null, rotuloGrupo(g, i));
      op.value = String(i);
      sel.appendChild(op);
    });
    var novo = cria('option', null, '+ Novo grupo');
    novo.value = 'novo';
    sel.appendChild(novo);
    sel.value = String(p.grupo);
    sel.addEventListener('change', function () {
      if (sel.value === 'novo') {
        S.grupos.push(grupoNovo());
        p.grupo = S.grupos.length - 1;
      } else {
        p.grupo = Number(sel.value);
      }
      salvar();
      desenhaPlacas();
      if (navigator.vibrate) navigator.vibrate(12);
    });
    linha.appendChild(sel);

    lista.appendChild(linha);
  });

  var sem = S.placas.filter(function (p) { return !p.cambio; }).length;
  $('contadorPlacas').textContent = S.placas.length + ' placas' + (sem ? ' · ' + sem + ' sem câmbio' : '');
  $('contadorPlacas').classList.toggle('contador--alerta', sem > 0);
  desenhaResumoGrupos();
}

/** Embaixo da lista: cada grupo com o que tem dentro. */
function desenhaResumoGrupos() {
  var alvo = $('resumoGrupos');
  alvo.textContent = '';
  if (S.grupos.length < 2) return;
  S.grupos.forEach(function (g, i) {
    var linha = cria('div', 'resumo-grupos__linha');
    linha.appendChild(cria('b', null, rotuloGrupo(g, i)));
    linha.appendChild(cria('span', null, descreveGrupo(i)));
    alvo.appendChild(linha);
  });
}

function marcaTodas(cambio) {
  S.placas.forEach(function (p) { p.cambio = cambio; });
  salvar();
  desenhaPlacas();
}

/* ==================================================================== *
 * ETAPAS 2 E 3 — O GRUPO EM EDIÇÃO
 * ==================================================================== */
function desenhaGrupos() {
  var fichas = $('fichasGrupos');
  fichas.textContent = '';
  var varios = S.grupos.length > 1;

  S.grupos.forEach(function (g, i) {
    var ficha = cria('div', 'ficha' + (i === S.ativo ? ' ficha--ativa' : ''));

    var abre = cria('button', 'ficha__nome', rotuloGrupo(g, i));
    abre.type = 'button';
    abre.setAttribute('aria-pressed', String(i === S.ativo));
    abre.addEventListener('click', function () { trocaGrupo(i); });
    ficha.appendChild(abre);

    // Sem remoção quando só existe um: o formulário precisa de um grupo.
    if (varios) {
      var tira = cria('button', 'ficha__tira', '×');
      tira.type = 'button';
      tira.title = 'Remover ' + rotuloGrupo(g, i);
      tira.setAttribute('aria-label', 'Remover ' + rotuloGrupo(g, i));
      tira.addEventListener('click', function () { removeGrupo(i); });
      ficha.appendChild(tira);
    }

    fichas.appendChild(ficha);
  });

  var placas = placasDoGrupo(S.ativo).map(function (p) {
    return p.placa + (p.cambio === 'auto' ? ' (aut.)' : p.cambio === 'manual' ? ' (man.)' : '');
  });
  $('placasDoGrupo').textContent = placas.length
    ? 'Placas: ' + placas.join(', ')
    : 'Nenhuma placa neste grupo — ele não vai no envio. Mova placas para ele na etapa 1.';

  var faixa = $('editando');
  faixa.textContent = '';
  faixa.appendChild(cria('span', null, 'Configurando'));
  faixa.appendChild(cria('b', null, rotuloGrupo(A(), S.ativo)));
  faixa.appendChild(cria('span', null, descreveGrupo(S.ativo) + (varios ? ' · trocar ↑' : '')));

  $('nomeGrupo').value = A().nome;
  $('nomeGrupo').placeholder = 'Grupo ' + (S.ativo + 1);
  $('modeloGrupo').value = A().modelo || '';
  desenhaOrigemFaixas();
}

/** A lista de modelos, agrupada por marca. Montada uma vez só. */
function montaListaModelos() {
  var sel = $('modeloGrupo');
  sel.textContent = '';

  var outro = cria('option', null, 'Outro modelo (faixas à mão)');
  outro.value = '';
  sel.appendChild(outro);

  var marcas = [];
  MODELOS.forEach(function (m) { if (marcas.indexOf(m.marca) < 0) marcas.push(m.marca); });
  marcas.forEach(function (marca) {
    var grupo = cria('optgroup');
    grupo.label = marca;
    MODELOS.filter(function (m) { return m.marca === marca; }).forEach(function (m) {
      var op = cria('option', null, m.nome);
      op.value = m.id;
      grupo.appendChild(op);
    });
    sel.appendChild(grupo);
  });
}

/** A linha acima da barra: de onde vieram as faixas deste grupo. */
function desenhaOrigemFaixas() {
  var alvo = $('origemFaixas');
  alvo.textContent = '';
  var m = modeloPorId(A().modelo);
  if (!m) {
    alvo.textContent = 'Faixas padrão. Escolha o modelo do veículo, lá em cima, para usar as da ficha do fabricante.';
    return;
  }
  alvo.appendChild(document.createTextNode('Faixas da ficha técnica do '));
  alvo.appendChild(cria('b', null, m.nome));
  alvo.appendChild(document.createTextNode(
    ' — torque máximo de ' + m.torque[0] + ' a ' + m.torque[1] + ' rpm, potência máxima a ' + m.potencia + ' rpm.'));
}

/**
 * Aplica o modelo escolhido às faixas do grupo aberto.
 *
 * Se o cliente já tinha ajustado as faixas à mão, pergunta antes: trocar
 * o modelo por cima apagaria em silêncio um trabalho feito de propósito.
 */
function aplicaModelo(id) {
  var g = A();
  var base = faixasBase(g, CONFIG);
  var atual = limites(g.b, CONFIG);
  var mexeu = atual.some(function (v, i) { return v !== base[i]; });

  var m = modeloPorId(id);
  var texto = m ? 'as do ' + m.nome : 'as faixas padrão';
  if (mexeu && !window.confirm('Você ajustou as faixas de rotação deste grupo. Trocar pelos valores de ' + texto + '?')) {
    $('modeloGrupo').value = g.modelo || '';   // desfaz a escolha na lista
    return;
  }

  g.modelo = id;
  g.b = m ? faixasDoModelo(m, CONFIG) : FAIXAS_PADRAO.slice();
  salvar();
  redesenhaTudo();
}

function trocaGrupo(i) {
  S.ativo = i;
  salvar();
  redesenhaTudo();
  sinalizaTroca();
}

/** Copia a configuração inteira do grupo aberto para um grupo novo. */
function duplicaGrupo() {
  var copia = JSON.parse(JSON.stringify(A()));
  copia.nome = rotuloGrupo(A(), S.ativo) + ' (cópia)';
  S.grupos.push(copia);
  S.ativo = S.grupos.length - 1;
  salvar();
  redesenhaTudo();
  sinalizaTroca();
  $('fichasGrupos').lastChild.classList.add('ficha--nova');
  $('nomeGrupo').focus();
}

/**
 * Mostra que a troca aconteceu. Sem isto, trocar de grupo parecia não
 * fazer nada: a página de baixo tem a mesma cara em todos eles.
 * A vibração só existe no Android; no iPhone fica só o sinal visual.
 */
function sinalizaTroca() {
  ['nomeGrupo', 'modeloGrupo', 'pagina2', 'pagina3', 'editando'].forEach(function (id) {
    var el = $(id);
    el.classList.remove('trocou');
    void el.offsetWidth;   // reinicia a animação se a troca for seguida
    el.classList.add('trocou');
  });
  if (navigator.vibrate) navigator.vibrate(12);
}

/**
 * Remove um grupo. As placas dele voltam para o primeiro grupo que
 * sobrar — placa nunca fica sem grupo. Pede confirmação porque os ajustes
 * daquele grupo se perdem e não há como desfazer.
 */
function removeGrupo(i) {
  var n = placasDoGrupo(i).length;
  var destino = i === 0 ? rotuloGrupo(S.grupos[1], 0) : rotuloGrupo(S.grupos[0], 0);
  var msg = 'Remover "' + rotuloGrupo(S.grupos[i], i) + '" e os ajustes dele?' +
    (n ? '\n\n' + (n > 1 ? 'As ' + n + ' placas voltam' : 'A placa volta') + ' para "' + destino + '".' : '');
  if (!window.confirm(msg)) return;

  S.grupos.splice(i, 1);
  S.placas.forEach(function (p) {
    if (p.grupo === i) p.grupo = 0;
    else if (p.grupo > i) p.grupo--;
  });
  S.ativo = Math.min(S.ativo, S.grupos.length - 1);
  salvar();
  redesenhaTudo();
}
