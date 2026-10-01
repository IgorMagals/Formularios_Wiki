/* regras.js — regras do ranking de motoristas
   Parte do formulário de telemetria. Ver a ordem de carga no index.html. */

'use strict';

/* ==================================================================== *
 * RANKING
 *
 * As regras são da EMPRESA, não do grupo: o ranking compara motoristas da
 * frota inteira, e regra diferente por grupo faria a comparação valer
 * nada. Por isso moram em S.regras, fora de S.grupos.
 *
 * Toda regra é "quando o evento acontecer X vezes, o motorista perde Y
 * pontos". Como o desconto é contado depois disso fica a cargo do
 * sistema de ranking — a tela não afirma nada além da regra.
 * ==================================================================== */

function regraDe(id) {
  if (!S.regras[id]) S.regras[id] = { on: false, qtd: '', pts: '' };
  return S.regras[id];
}

/** Regras que vão no envio: ligadas, e as de vídeo só com câmera. */
function regrasLigadas() {
  return REGRAS.filter(function (r) {
    if (r[2] === 'video' && S.camera !== 'sim') return false;
    return regraDe(r[0]).on;
  });
}

function desenhaRegras() {
  var alvo = $('listasRegras');
  alvo.textContent = '';

  LISTAS_REGRAS.forEach(function (lista) {
    var chave = lista[0];
    var cartao = cria('section', 'cartao secao');

    var topo = cria('div', 'cabecalho-bloco cabecalho-bloco--quebra');
    var tit = cria('div');
    tit.appendChild(cria('div', 'titulo', lista[1].toUpperCase()));
    tit.appendChild(cria('div', 'subtitulo', lista[2]));
    topo.appendChild(tit);
    var conta = cria('div', 'contador');
    topo.appendChild(conta);
    cartao.appendChild(topo);

    if (chave === 'video') {
      cartao.appendChild(perguntaCamera());
      if (S.camera !== 'sim') {
        conta.textContent = S.camera === 'nao' ? 'sem câmera' : '—';
        alvo.appendChild(cartao);
        return;
      }
    }

    // Cada grupo (Velocidade, Aceleração…) é um bloco: título e regras
    // juntos, com o espaço grande só entre um bloco e outro.
    var bloco = null, grupoAtual;
    REGRAS.filter(function (r) { return r[2] === chave; }).forEach(function (r) {
      if (!bloco || r[3] !== grupoAtual) {
        grupoAtual = r[3];
        bloco = cria('div', 'regras__bloco');
        if (r[3]) bloco.appendChild(cria('div', 'regras__grupo', r[3]));
        cartao.appendChild(bloco);
      }
      bloco.appendChild(linhaRegra(r));
    });

    var n = REGRAS.filter(function (r) { return r[2] === chave && regraDe(r[0]).on; }).length;
    conta.textContent = n ? n + (n > 1 ? ' ligadas' : ' ligada') : 'nenhuma ligada';
    alvo.appendChild(cartao);
  });
}

function perguntaCamera() {
  var caixa = cria('div', 'campo');
  caixa.appendChild(cria('span', null, 'Sua frota tem câmera de monitoramento?'));
  var opcoes = cria('div', 'cambio');
  [['Sim', 'sim'], ['Não', 'nao']].forEach(function (op) {
    var b = cria('button', null, op[0]);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(S.camera === op[1]));
    b.addEventListener('click', function () {
      S.camera = op[1];
      salvar();
      desenhaRegras();
    });
    opcoes.appendChild(b);
  });
  caixa.appendChild(opcoes);
  return caixa;
}

function linhaRegra(r) {
  var dados = regraDe(r[0]);
  var linha = cria('div', 'regra' + (dados.on ? ' regra--ligada' : ''));

  var liga = cria('button', 'alerta regra__liga');
  liga.type = 'button';
  liga.setAttribute('role', 'switch');
  liga.setAttribute('aria-checked', String(dados.on));
  var rot = cria('div', 'alerta__rot');
  rot.appendChild(cria('b', null, r[1]));
  liga.appendChild(rot);
  liga.appendChild(cria('span', 'chave'));
  liga.addEventListener('click', function () {
    dados.on = !dados.on;
    salvar();
    desenhaRegras();
  });
  linha.appendChild(liga);

  if (dados.on) {
    var valores = cria('div', 'regra__valores');
    valores.appendChild(numeroRegra(dados, 'qtd', 'Quantas vezes — ' + r[1]));
    valores.appendChild(document.createTextNode(' vezes, perde '));
    valores.appendChild(numeroRegra(dados, 'pts', 'Pontos perdidos — ' + r[1]));
    valores.appendChild(document.createTextNode(' pontos.'));
    linha.appendChild(valores);

    var erro = criticaRegra(dados);
    var dica = cria('p', 'dica' + (erro ? ' dica--erro' : ''), erro ? 'Falta: ' + erro + '.' : '');
    dica.dataset.regra = r[0];
    linha.appendChild(dica);
  }
  return linha;
}

function numeroRegra(dados, chave, rotulo) {
  var input = cria('input', 'entrada regra__numero');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.maxLength = 3;
  input.value = dados[chave];
  input.setAttribute('aria-label', rotulo);
  input.addEventListener('input', function () {
    input.value = input.value.replace(/\D/g, '');
    dados[chave] = input.value;
    salvar();
  });
  // A crítica aparece ao sair do campo, não a cada tecla.
  input.addEventListener('blur', function () {
    var dica = input.closest('.regra').querySelector('.dica');
    var erro = criticaRegra(dados);
    dica.textContent = erro ? 'Falta: ' + erro + '.' : '';
    dica.classList.toggle('dica--erro', !!erro);
  });
  return input;
}
