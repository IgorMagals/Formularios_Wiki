/* catalogo.js — configuração, catálogo de campos e a matemática das faixas
   Parte do formulário de telemetria. index.html carrega na ordem
   catalogo.js → resumo.js → app.js, todos com defer, que preserva a ordem. */

'use strict';

/* ==================================================================== *
 * CONFIGURAÇÃO — tudo que muda de ambiente para ambiente mora aqui.
 * Nenhum destes valores se repete abaixo.
 *
 * Esta página NÃO guarda segredo nem dado de cliente. Quem abre o
 * formulário é o código de acesso de 24h que a CORPVS manda por e-mail;
 * o Apps Script confere o código e só então devolve as placas daquele
 * cliente. O ENDPOINT é público por natureza: sem código válido, ele não
 * abre nada e não grava nada.
 * ==================================================================== */
var CONFIG = {
  ENDPOINT: 'https://script.google.com/macros/s/AKfycbzCVkS2ijGarWEfCapA-vpaTNv-OdxSNw8WE6vq1ACBggwclKQwUrr0hg27h0JF32V-sQ/exec',
  RASCUNHO_VERSAO: 'v6',   // subir isto descarta rascunhos antigos de todos
  RPM_MAX: 4000,
  RPM_PASSO: 50,           // granularidade do arrasto e dos campos
  RPM_MIN_FAIXA: 50,       // distância mínima entre dois limites
  RPM_BASE: 700,           // âncora da primeira faixa: marcha lenta + 50
  CORPO_MAX: 262144,       // mesmo limite do Apps Script
  ESPERA_MAX_MS: 30000     // sem resposta nesse tempo, a tela avisa em vez de girar para sempre
};

/**
 * O rascunho é por CÓDIGO DE ACESSO: cada código abre um formulário novo.
 * Recarregar a página com o mesmo código traz de volta o que foi
 * preenchido; um código novo começa do zero, como um envio novo.
 */
var PREFIXO_RASCUNHO = 'corpvs-telemetria-';
function chaveRascunho(codigo) {
  return PREFIXO_RASCUNHO + String(codigo).toUpperCase().replace(/[^A-Z0-9]/g, '') + '-' + CONFIG.RASCUNHO_VERSAO;
}

/* -------------------------------------------------------------------- *
 * Catálogo do formulário. Rótulo, unidade e valor padrão num lugar só.
 * -------------------------------------------------------------------- */
/* -------------------------------------------------------------------- *
 * FAIXAS DE ROTAÇÃO — dois modelos, de propósito
 *
 * O EQUIPAMENTO trabalha com sete faixas: três verdes e duas vermelhas.
 * O CLIENTE não tem por que saber disso. Para quem preenche, verde é
 * verde — "o motor está na rotação boa" — e vermelho é vermelho. Faixas
 * repetidas na tela são trabalho de entender sem nada em troca, e mais
 * alças para arrastar no telefone.
 *
 * Então a tela mostra QUATRO faixas e a saída entrega SETE. Cada faixa da
 * tela se divide em partes iguais, em números inteiros, na hora de montar
 * o envio — quantas, diz FAIXAS_PARTES. A vermelha é a mais escura das
 * duas antigas, e a sua segunda metade termina no topo da escala.
 * As colunas da planilha continuam as de sempre.
 * -------------------------------------------------------------------- */
var FAIXAS_NOME = ['Azul', 'Verde', 'Amarela', 'Vermelha'];
var FAIXAS_COR  = ['#3b7fc4', '#4caf5c', '#f2c230', '#9e2219'];
var FAIXAS_PADRAO = [700, 900, 1600, 1900, 4000];

/* Em quantas faixas do equipamento cada faixa da tela se divide.
   A soma tem de ser o total de FAIXAS_SISTEMA_NOME — o teste confere. */
var FAIXAS_PARTES = [1, 3, 1, 2];
var FAIXAS_SISTEMA_NOME = ['Azul', 'Verde 1', 'Verde 2', 'Verde 3', 'Amarela', 'Vermelha', 'Vermelha 2'];

/* Índices derivados: nada de número solto espalhado pelo código, que é
   como se esquece um deles ao mudar a quantidade de faixas. */
var ULTIMA_FAIXA = FAIXAS_NOME.length - 1;       // índice da última banda
var ULTIMO_LIMITE = FAIXAS_PADRAO.length - 1;    // índice do limite máximo
var ALCAS = FAIXAS_NOME.length - 1;              // alças móveis na barra

/* -------------------------------------------------------------------- *
 * MODELOS DE VEÍCULO — faixas tiradas da ficha técnica do fabricante
 *
 * O padrão genérico é perfil de caminhão pesado: vermelho a partir de
 * 1.900 rpm. Um VW Delivery 6.160 tem potência máxima a 3.200 rpm e
 * torque máximo até 2.400 — a 2.200 ele está no melhor ponto de trabalho,
 * e o padrão genérico o daria como vermelho. O motorista dirigindo certo
 * e o equipamento reclamando o tempo todo.
 *
 * Escolhendo o modelo, as faixas vêm da ficha daquele motor. A regra
 * segue o conta-giros de fábrica, onde o verde marca justamente a faixa
 * de torque máximo:
 *
 *   Azul      marcha lenta + 50  →  início do torque máximo
 *   Verde     faixa de torque máximo
 *   Amarela   fim do torque máximo  →  potência máxima
 *   Vermelha  acima da potência máxima, até o topo da escala
 *
 * Os números vêm da ficha, sem arredondar: 1.365 rpm é o que o fabricante
 * publicou para o DAF, e arredondar para 1.350 seria trocar dado por
 * estética. O Mercedes Actros 2546 ficou de fora: a ficha dá o torque
 * máximo num ponto só (1.080 rpm), e sem faixa não há verde.
 * -------------------------------------------------------------------- */
var MODELOS = [
  { id: 'daf-xf480',    marca: 'DAF',           nome: 'DAF XF 480 (MX-13)',          torque: [900, 1365],  potencia: 1600 },
  { id: 'daf-xf530',    marca: 'DAF',           nome: 'DAF XF 530 (MX-13)',          torque: [1000, 1425], potencia: 1675 },
  { id: 'mb-accelo1016', marca: 'Mercedes-Benz', nome: 'Mercedes Accelo 1016',       torque: [1200, 1600], potencia: 2200 },
  { id: 'mb-atego2429', marca: 'Mercedes-Benz', nome: 'Mercedes Atego 2429',         torque: [1200, 1600], potencia: 2200 },
  { id: 'scania-p360',  marca: 'Scania',        nome: 'Scania P360',                 torque: [1000, 1300], potencia: 1900 },
  { id: 'scania-r440',  marca: 'Scania',        nome: 'Scania R440',                 torque: [1000, 1300], potencia: 1900 },
  { id: 'volvo-fh420',  marca: 'Volvo',         nome: 'Volvo FH 420',                torque: [1000, 1400], potencia: 1900 },
  { id: 'volvo-fh460',  marca: 'Volvo',         nome: 'Volvo FH 460',                torque: [1000, 1400], potencia: 1900 },
  { id: 'volvo-fh500',  marca: 'Volvo',         nome: 'Volvo FH 500',                torque: [1050, 1400], potencia: 1900 },
  { id: 'volvo-fh540',  marca: 'Volvo',         nome: 'Volvo FH 540',                torque: [1050, 1450], potencia: 1900 },
  { id: 'volvo-vm270',  marca: 'Volvo',         nome: 'Volvo VM 270',                torque: [1200, 1600], potencia: 2200 },
  { id: 'vw-const24280', marca: 'Volkswagen',   nome: 'VW Constellation 24.280',     torque: [1100, 1700], potencia: 2300 },
  { id: 'vw-deliv6160', marca: 'Volkswagen',    nome: 'VW Delivery 6.160',           torque: [1500, 2400], potencia: 3200 }
];

function modeloPorId(id) {
  for (var i = 0; i < MODELOS.length; i++) if (MODELOS[i].id === id) return MODELOS[i];
  return null;
}

/** Os limites das faixas que o modelo sugere, pela regra acima. */
function faixasDoModelo(m, cfg) {
  return [cfg.RPM_BASE, m.torque[0], m.torque[1], m.potencia, cfg.RPM_MAX];
}

/**
 * Referência de um conjunto: o que o modelo sugere, ou o padrão genérico
 * quando não há modelo. É contra isto que se mede o "ALTERADO" — cliente
 * que escolheu Volvo FH 540 e não mexeu em nada não alterou nada, mesmo
 * que as faixas sejam diferentes do padrão genérico.
 */
function faixasBase(c, cfg) {
  var m = c && c.modelo ? modeloPorId(c.modelo) : null;
  return m ? faixasDoModelo(m, cfg) : FAIXAS_PADRAO.slice();
}

/* Valores padrão dos campos numéricos.
   'rpmStop' não tem padrão de propósito: vazio significa "manter o valor
   atual do equipamento", e é assim que aparece no resumo. */
var PADRAO = {
  rpmStop: '',
  spdMax: '90', spdCurve: '35',
  accel: '15', brake: '15'
};
/* Fora da customização (decisão de 01/10/2026): sensibilidade de curva e
   tempos de tolerância. São padrão da CORPVS — o cliente não vê nem envia. */

/* [chave, rótulo, nota, sóManuais] */
var ALERTAS = [
  ['passe', 'Passe o cartão', ''],
  ['boa', 'Boa viagem', 'Após ler um cartão válido'],
  ['vel', 'Excesso de velocidade', ''],
  ['tracao', 'Movimento sem tração', 'Banguela', true],
  ['parado', 'Parado acelerando', ''],
  ['amarela', 'Faixa amarela', ''],
  ['vermelha', 'Faixa vermelha', ''],
  ['rpmlow', 'RPM abaixo do ideal', '', true],
  ['temp', 'Temperatura do motor', ''],
  ['embreagem', 'Excesso de embreagem', '', true],
  ['acel', 'Aceleração brusca', ''],
  ['fren', 'Frenagem brusca', ''],
  ['curva', 'Curva brusca', '']
];

/* Blocos da página 2. campo = [chave, rótulo, unidade, sóManuais, dica] */
var BLOCOS = [
  { num: '02', titulo: 'VELOCIDADE', unidade: 'km/h', campos: [
    ['spdMax', 'Excesso de velocidade', 'km/h'],
    ['spdCurve', 'Velocidade mínima para detectar curva brusca', 'km/h']
  ] },
  { num: '03', titulo: 'CONDUÇÃO', unidade: 'km/h/s', campos: [
    ['accel', 'Aceleração brusca', 'km/h/s'],
    ['brake', 'Frenagem brusca', 'km/h/s']
  ] }
];

var CAMPOS_RPM = [
  ['rpmStop', 'Parado acelerando', 'RPM', false, 'Acima desta rotação com o veículo parado']
];

/* -------------------------------------------------------------------- *
 * REGRAS DO RANKING DE MOTORISTAS
 *
 * Toda regra tem o mesmo formato no sistema: quando o evento acontecer
 * X vezes, o motorista perde Y pontos. O ID é o do sistema e é ele que
 * vai para a planilha — o nome é só para o cliente ler.
 *
 * Os nomes são escritos para quem preenche; o que identifica a regra é
 * o ID. A lista traz só as regras oferecidas neste formulário.
 *
 * [id, nome, lista, grupo]
 * -------------------------------------------------------------------- */
var LISTAS_REGRAS = [
  ['performance', 'Performance', 'Como o veículo é conduzido em relação ao motor e ao consumo.'],
  ['seguranca', 'Segurança', 'Como o motorista conduz: velocidade, freadas, curvas.'],
  ['video', 'Vídeo', 'Alarmes da câmera voltada para o motorista.']
];

var REGRAS = [
  [14, 'Excesso de tempo parado com ignição ligada', 'performance', ''],
  [31, 'Parado acelerando', 'performance', ''],
  [50, 'Faixa vermelha', 'performance', ''],
  [51, 'Faixa amarela', 'performance', ''],
  [57, 'Uso do pedal do acelerador', 'performance', ''],

  [4, 'Excesso de velocidade', 'seguranca', 'Velocidade'],
  [21, 'Velocidade máxima da via', 'seguranca', 'Velocidade'],
  [7, 'Aceleração brusca', 'seguranca', 'Aceleração'],
  [17, 'Frenagem brusca', 'seguranca', 'Frenagem'],
  [8, 'Curva brusca', 'seguranca', 'Curva'],
  [22, 'Excesso de embreagem', 'seguranca', 'Condução'],
  [30, 'Excesso de RPM em movimento', 'seguranca', 'Condução'],
  [32, 'Banguela', 'seguranca', 'Condução'],
  [19, 'Temperatura máxima', 'seguranca', 'Veículo'],

  [43, 'Cansaço ao dirigir', 'video', ''],
  [44, 'Uso do celular', 'video', ''],
  [45, 'Fumar ao dirigir', 'video', ''],
  [46, 'Distração do motorista', 'video', ''],
  [67, 'Motorista sem cinto de segurança', 'video', '']
];

/** Nota para os grupos que existem em três intensidades. */

/** Quantidade e pontos: inteiros de 1 a 999. Vazio ou zero não vale. */
function criticaRegra(r) {
  if (!r || !r.on) return null;
  var ok = function (v) { return /^\d{1,3}$/.test(String(v)) && Number(v) >= 1; };
  if (!ok(r.qtd)) return 'informe quantas vezes (de 1 a 999)';
  if (!ok(r.pts)) return 'informe quantos pontos o motorista perde (de 1 a 999)';
  return null;
}

/* -------------------------------------------------------------------- *
 * LIMITES POR CAMPO
 *
 * Barram o impossível, não o incomum: um valor fora do intervalo é quase
 * sempre um dedo no teclado (300 km/h). Ficam num lugar só para serem
 * ajustados sem procurar número pelo código.
 * -------------------------------------------------------------------- */
var LIMITES = {
  rpmStop:  { min: 500, max: 3000, digitos: 4 },
  spdMax:   { min: 80,  max: 150,  digitos: 3 },
  spdCurve: { min: 10,  max: 80,   digitos: 3 },
  accel:    { min: 5,   max: 40,   digitos: 2 },
  brake:    { min: 5,   max: 40,   digitos: 2 }
};

/**
 * Valida um campo numérico. Campo vazio é válido: significa
 * "manter o valor atual do equipamento", e é assim que aparece no resumo.
 * Devolve null quando está bom, ou a mensagem do que está errado.
 */
function criticaCampo(chave, valor) {
  var lim = LIMITES[chave];
  if (!lim) return null;
  var texto = String(valor == null ? '' : valor).trim();
  if (texto === '') return null;
  if (!/^\d+$/.test(texto)) return 'Use apenas números.';
  var n = Number(texto);
  if (n < lim.min) return 'Mínimo ' + lim.min + '.';
  if (n > lim.max) return 'Máximo ' + lim.max + '.';
  return null;
}

/* Vírgula no lugar do ponto é o erro de digitação mais comum em e-mail
   ("nome@empresa.com,br"). O domínio não pode ter vírgula, e a última
   parte tem de ser só letras. */
var EMAIL_VALIDO = /^[^\s@,]+@[^\s@,]+(\.[^\s@,.]+)*\.[A-Za-zÀ-ÿ]{2,}$/;


/* ==================================================================== *
 * INICIO NUCLEO FAIXAS
 *
 * A matemática das faixas de rotação. Está isolada aqui e sem
 * dependência de DOM de propósito: é o que notas/teste-faixas.js
 * carrega e verifica. Faixa sobreposta não dá erro na tela — gera
 * configuração inválida no equipamento.
 * ==================================================================== */
function limites(b, cfg) {
  var v = b.map(function (x) { var n = Number(x); return isFinite(n) ? n : 0; });
  v[0] = cfg.RPM_BASE;                 // marcha lenta + 50: âncora, não se move
  v[v.length - 1] = cfg.RPM_MAX;       // último limite: o máximo
  return v;
}

/**
 * Reordena os limites depois de uma alteração no índice k.
 * Empurra os vizinhos para manter RPM_MIN_FAIXA entre cada par e nunca
 * deixa um limite passar do que os seguintes precisam para existir.
 */
function normalizar(b, k, cfg) {
  var v = limites(b, cfg);
  var ultimo = v.length - 1;
  var min = cfg.RPM_MIN_FAIXA;
  k = Math.min(ultimo - 1, Math.max(1, k));

  for (var j = k + 1; j <= ultimo - 1; j++) if (v[j] < v[j - 1] + min) v[j] = v[j - 1] + min;
  for (var i = k - 1; i >= 1; i--) if (v[i] > v[i + 1] - min) v[i] = v[i + 1] - min;
  for (var m = 1; m <= ultimo - 1; m++) {
    v[m] = Math.min(cfg.RPM_MAX - min * (ultimo - m), Math.max(v[0] + min * m, v[m]));
  }
  return v;
}

/** Limite i movido para o valor bruto v, respeitando apenas os vizinhos. */
function mover(b, i, valor, cfg) {
  var v = limites(b, cfg);
  var passo = cfg.RPM_PASSO;
  var alvo = Math.round(valor / passo) * passo;
  v[i] = Math.min(v[i + 1] - cfg.RPM_MIN_FAIXA, Math.max(v[i - 1] + cfg.RPM_MIN_FAIXA, alvo));
  return v;
}

/**
 * Traduz as faixas do cliente para as faixas do equipamento: cada faixa
 * da tela vira FAIXAS_PARTES[i] pedaços iguais, em números inteiros.
 *
 * Recebe os limites da tela e devolve os do equipamento. As bordas de
 * cada faixa não se movem, e os pedaços são contíguos e cobrem exatamente
 * o intervalo que o cliente escolheu — o arredondamento fica nos pontos
 * do meio, nunca nas bordas, senão sobraria ou faltaria rotação entre uma
 * faixa e a seguinte.
 */
function faixasDoSistema(b, cfg) {
  var v = limites(b, cfg);
  var saida = [v[0]];

  for (var i = 0; i < v.length - 1; i++) {
    var ini = v[i], fim = v[i + 1];
    var partes = FAIXAS_PARTES[i] || 1;
    for (var k = 1; k < partes; k++) {
      saida.push(ini + Math.round((fim - ini) * k / partes));
    }
    saida.push(fim);
  }
  return saida;
}
/* ==================================================================== *
 * FIM NUCLEO FAIXAS
 * ==================================================================== */
