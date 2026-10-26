/* catalogo.js — configuração e catálogo do formulário de câmera
   Tudo o que o formulário pergunta está aqui: a tela, o resumo e a linha
   da planilha saem desta lista. Tirar uma função da tela é trocar o
   `mostrar` dela para false: ela some da tela e vai para a planilha com o
   padrão da CORPVS. */

'use strict';

/* ==================================================================== *
 * CONFIGURAÇÃO
 *
 * Esta página NÃO guarda segredo nem dado de cliente. Quem abre o
 * formulário é o código de acesso de 24h que a CORPVS manda por e-mail.
 * O ENDPOINT é o mesmo da telemetria: o código diz de qual formulário é.
 * ==================================================================== */
var CONFIG = {
  ENDPOINT: 'https://script.google.com/macros/s/AKfycbzCVkS2ijGarWEfCapA-vpaTNv-OdxSNw8WE6vq1ACBggwclKQwUrr0hg27h0JF32V-sQ/exec',
  FORMULARIO: 'camera',
  RASCUNHO_VERSAO: 'v2',   // subir isto descarta rascunhos antigos de todos
  CORPO_MAX: 262144,       // mesmo limite do Apps Script
  ESPERA_MAX_MS: 30000
};

/* Mesmo domínio da telemetria: as chaves de armazenamento não podem ser
   as dela, senão um código de lá seria tentado aqui. */
var PREFIXO_RASCUNHO = 'corpvs-camera-';
var CHAVE_SESSAO = 'corpvs-camera-codigo';

/* ==================================================================== *
 * CAMPOS — o que o cliente pode mudar
 *
 * `coluna` é o nome na planilha; `curto` é como aparece no resumo.
 *
 * Padrão da CORPVS, fora da escolha do cliente (consumo de dados,
 * armazenamento e fila no equipamento):
 *   duração antes e depois do evento e intervalo entre alertas — ficam
 *     como vêm no equipamento, nem vão para a planilha;
 *   envio à plataforma (foto OU vídeo) — `fixo.envio` de cada função;
 *   canal da câmera que grava o alarme do DSM — sempre o 2;
 *   volume — alarme ligado toca em VOLUME_ALARME; o máximo do equipamento
 *     é 9, alto demais para a cabine. Alarme desligado = mudo.
 * ==================================================================== */
var VOLUME_ALARME = '4';

var CAMPOS = {
  alarme:        { tipo: 'chave',  rotulo: 'Alarme sonoro na cabine', curto: 'alarme', coluna: 'alarme_sonoro' },
  velocidade:    { tipo: 'numero', rotulo: 'Só alerta acima de', curto: 'acima de', unidade: 'km/h', min: 0, max: 150, coluna: 'velocidade_kmh' },
  sensibilidade: { tipo: 'opcao',  rotulo: 'Sensibilidade', curto: 'sensibilidade', opcoes: ['Baixa', 'Média', 'Alta'], coluna: 'sensibilidade' }
};

/* Colunas da planilha, nesta ordem, em toda linha. `envio` e `volume` não
   são pergunta: saem do catálogo (fixo) e de VOLUME_ALARME. */
var COLUNAS = ['ligado', 'envio', 'canal_alarme', 'alarme_sonoro', 'volume',
  'velocidade_kmh', 'sensibilidade', 'valor'];

/* ==================================================================== *
 * MÓDULOS — os títulos de cada bloco na tela
 * ==================================================================== */
var MODULOS = {
  ADAS:     { titulo: 'ESTRADA — ADAS', sub: 'Câmera frontal: o que acontece à frente do veículo.' },
  DSM:      { titulo: 'MOTORISTA — DSM', sub: 'Câmera da cabine: o comportamento de quem dirige.' },
  VSD:      { titulo: 'CONDUÇÃO — VSD', sub: 'Sensor de movimento do equipamento: arrancadas, freadas e curvas.' },
  'Gravação': { titulo: 'GRAVAÇÃO', sub: 'Áudio da cabine e o que a câmera faz com o veículo desligado.' }
};

/* ==================================================================== *
 * FUNÇÕES
 *
 * `padrao`: o valor inicial do que o cliente escolhe (velocidade e
 * sensibilidade são os de hoje no equipamento de teste, prints de
 * 26/10/2026 — ver fontes/camera-g40/LEIA.txt).
 * `fixo`: colunas da planilha que a CORPVS define, iguais para todo cliente.
 * ==================================================================== */
var ADAS_CHEIO = ['alarme', 'velocidade', 'sensibilidade'];
var ADAS_CURTO = [];   // TSR, TLD e FCL: o cliente só liga ou desliga
var DSM_CAMPOS = ['alarme', 'velocidade', 'sensibilidade'];
var VSD_CAMPOS = ['alarme'];

var BASE = { ligado: true, alarme: true, velocidade: '30', sensibilidade: 'Baixa' };
function padrao(extra) { return Object.assign({}, BASE, extra); }

var FOTO = { envio: 'foto' };
var VIDEO = { envio: 'vídeo' };
var DSM_FOTO = { envio: 'foto', canal_alarme: '2' };
var DSM_VIDEO = { envio: 'vídeo', canal_alarme: '2' };

var FUNCOES = [
  /* ---- ADAS ---- */
  { id: 'FCW', modulo: 'ADAS', nome: 'Colisão frontal (FCW)', mostrar: true, campos: ADAS_CHEIO, fixo: VIDEO,
    dica: 'Avisa quando o veículo se aproxima rápido demais do veículo da frente.',
    padrao: padrao({ sensibilidade: 'Média' }) },
  { id: 'LDW', modulo: 'ADAS', nome: 'Saída de faixa (LDW)', mostrar: true, campos: ADAS_CHEIO, fixo: FOTO,
    dica: 'Avisa quando o veículo sai da faixa em que está.',
    padrao: padrao({}) },
  { id: 'HMW', modulo: 'ADAS', nome: 'Distância do veículo da frente (HMW)', mostrar: true, campos: ADAS_CHEIO, fixo: FOTO,
    dica: 'Avisa quando a distância para o veículo da frente fica curta demais.',
    padrao: padrao({}) },
  { id: 'PCW', modulo: 'ADAS', nome: 'Colisão com pedestre (PCW)', mostrar: true, campos: ADAS_CHEIO, fixo: FOTO,
    dica: 'Avisa quando há pedestre parado ou andando na pista à frente.',
    ajuste: { velocidade: { rotulo: 'Só alerta abaixo de', curto: 'abaixo de' } },
    padrao: padrao({}) },
  { id: 'SLW', modulo: 'ADAS', nome: 'Mudança de faixa na linha contínua (SLW)', mostrar: true, campos: ADAS_CHEIO, fixo: FOTO,
    dica: 'Avisa quando o veículo passa sobre a linha contínua.',
    padrao: padrao({ sensibilidade: 'Média' }) },
  { id: 'TSR', modulo: 'ADAS', nome: 'Placas de velocidade (TSR)', mostrar: true, campos: ADAS_CURTO, fixo: { sensibilidade: 'Média' },
    dica: 'Lê as placas de limite de velocidade da via e avisa o motorista.',
    padrao: padrao({}) },
  { id: 'TLD', modulo: 'ADAS', nome: 'Semáforo (TLD)', mostrar: true, campos: ADAS_CURTO, fixo: { sensibilidade: 'Baixa' },
    dica: 'Detecta o estado do semáforo e avisa o motorista.',
    padrao: padrao({}) },
  { id: 'FCL', modulo: 'ADAS', nome: 'Veículo da frente saiu (FCL)', mostrar: true, campos: ADAS_CURTO, fixo: { sensibilidade: 'Baixa' },
    dica: 'Avisa o motorista quando o veículo da frente sai.',
    padrao: padrao({}) },

  /* ---- DSM ---- */
  { id: 'FADIGA', modulo: 'DSM', nome: 'Cansaço ao dirigir', mostrar: true, campos: DSM_CAMPOS, fixo: DSM_VIDEO,
    dica: 'Sinais de cansaço no rosto do motorista.', padrao: padrao({}) },
  { id: 'CELULAR', modulo: 'DSM', nome: 'Uso do celular', mostrar: true, campos: DSM_CAMPOS, fixo: DSM_FOTO,
    dica: 'Motorista usando o celular.', padrao: padrao({}) },
  { id: 'FUMAR', modulo: 'DSM', nome: 'Fumar', mostrar: true, campos: DSM_CAMPOS, fixo: DSM_FOTO,
    dica: 'Motorista fumando.', padrao: padrao({ sensibilidade: 'Alta' }) },
  { id: 'DISTRACAO', modulo: 'DSM', nome: 'Distração', mostrar: true, campos: DSM_CAMPOS, fixo: DSM_VIDEO,
    dica: 'Motorista sem olhar para a estrada.', padrao: padrao({}) },
  { id: 'MANUSEIO', modulo: 'DSM', nome: 'Câmera mexida ou tapada', mostrar: true, campos: DSM_CAMPOS, fixo: DSM_VIDEO,
    dica: 'Alguém mexeu na câmera da cabine ou a cobriu.', padrao: padrao({}) },
  { id: 'CINTO', modulo: 'DSM', nome: 'Sem cinto de segurança', mostrar: true, campos: DSM_CAMPOS, fixo: DSM_FOTO,
    dica: 'Motorista dirigindo sem o cinto.', padrao: padrao({}) },
  // Sempre desligadas: o cliente não escolhe, a planilha leva "ligado: não".
  { id: 'OCULOS', modulo: 'DSM', nome: 'Óculos que bloqueiam a câmera', mostrar: false, campos: DSM_CAMPOS,
    padrao: padrao({ ligado: false }) },
  { id: 'AUSENCIA', modulo: 'DSM', nome: 'Motorista ausente', mostrar: false, campos: DSM_CAMPOS,
    padrao: padrao({ ligado: false }) },
  { id: 'BOCEJO', modulo: 'DSM', nome: 'Bocejo', mostrar: true, campos: DSM_CAMPOS, fixo: DSM_FOTO,
    dica: 'Motorista bocejando.', padrao: padrao({ sensibilidade: 'Média' }) },

  /* ---- VSD: sensibilidade fixa em Média; o cliente liga e escolhe o alarme ---- */
  { id: 'ACEL', modulo: 'VSD', nome: 'Aceleração brusca', mostrar: true, campos: VSD_CAMPOS,
    fixo: { envio: 'vídeo', sensibilidade: 'Média' }, dica: 'Arrancada forte.', padrao: padrao({}) },
  { id: 'FREIO', modulo: 'VSD', nome: 'Frenagem brusca', mostrar: true, campos: VSD_CAMPOS,
    fixo: { envio: 'vídeo', sensibilidade: 'Média' }, dica: 'Freada forte.', padrao: padrao({}) },
  { id: 'CURVA', modulo: 'VSD', nome: 'Curva brusca', mostrar: true, campos: VSD_CAMPOS,
    fixo: { envio: 'vídeo', sensibilidade: 'Média' }, dica: 'Curva feita rápido demais.', padrao: padrao({}) },

  /* ---- Gravação: um valor só por item ----
     É o que o cliente decide; o resto do app (formato, imagem, OSD,
     armazenamento) mexe em dados e armazenamento e fica com a CORPVS. */
  { id: 'AUDIO_CABINE', modulo: 'Gravação', nome: 'Microfone da cabine', mostrar: true, campos: ['valor'],
    dica: 'Grava o áudio da cabine junto com o vídeo.',
    valor: { tipo: 'chave' }, padrao: { valor: true } },
  { id: 'ATRASO_DESLIGAR', modulo: 'Gravação', nome: 'Gravação depois de desligar o veículo', mostrar: true, campos: ['valor'],
    dica: 'Quanto tempo a câmera continua gravando depois que a ignição é desligada. Até 2 horas.',
    valor: { tipo: 'numero', unidade: 'min', min: 0, max: 120,
      aviso: { acima: 10, texto: 'Acima de 10 minutos a câmera fica mais tempo consumindo a bateria com o motor parado. ' +
        'Somado aos outros equipamentos do veículo e repetido a cada parada, isso pode descarregar a bateria ou encurtar a vida dela.' } },
    padrao: { valor: '10' } },
  { id: 'EMERGENCIA_G', modulo: 'Gravação', nome: 'Gravação por impacto com o veículo desligado', mostrar: true, campos: ['valor'],
    dica: 'Com o veículo desligado, a câmera liga sozinha e grava se o sensor sentir uma batida ou um tranco forte.',
    valor: { tipo: 'chave' }, padrao: { valor: true } }
];
