/* acesso.js — tela do código de acesso
   Parte do formulário de telemetria. É o último script: abre o formulário
   depois que o Apps Script reconhece o código.

   O código chega de dois jeitos: no link do e-mail (…/#ABCD-EFGH), que é
   o caminho normal — o cliente só clica —, ou digitado. Depois de aceito
   ele fica na sessão da aba (some ao fechar o navegador) e sai do
   endereço, para não aparecer num print nem no histórico. */

'use strict';

var CHAVE_SESSAO = 'corpvs-telemetria-codigo';

var MSG_ACESSO = {
  codigo_invalido: 'Código não reconhecido. Confira o código do e-mail da CORPVS.',
  codigo_vencido: 'Este código venceu. Peça um novo à CORPVS.',
  conexao: 'Sem resposta do servidor. Verifique a conexão e tente de novo.',
  muitas_tentativas: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  sem_servidor: 'O formulário ainda não está ligado ao servidor. Fale com a CORPVS.'
};

function estadoAcesso(msg, erro) {
  var el = document.getElementById('estadoAcesso');
  el.textContent = msg;
  el.classList.toggle('dica--erro', !!erro);
}

async function abrirComCodigo(codigo) {
  codigo = String(codigo || '').trim().toUpperCase();
  if (!codigo) return;
  if (!CONFIG.ENDPOINT) { estadoAcesso(MSG_ACESSO.sem_servidor, true); return; }

  var botao = document.getElementById('abrir');
  botao.disabled = true;
  estadoAcesso('Conferindo o código…', false);

  var r = await chamaServidor({ acao: 'abrir', codigo: codigo });
  botao.disabled = false;

  if (!r || !r.ok) {
    try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) {}
    estadoAcesso(MSG_ACESSO[r && r.erro] || MSG_ACESSO.codigo_invalido, true);
    return;
  }
  if (!Array.isArray(r.placas) || !r.placas.length) {
    estadoAcesso('Nenhuma placa cadastrada para a sua empresa. Fale com a CORPVS.', true);
    return;
  }

  try { sessionStorage.setItem(CHAVE_SESSAO, codigo); } catch (e) {}
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  iniciar({ codigo: codigo, cliente: r.cliente, placas: r.placas });
}

(function () {
  document.getElementById('formAcesso').addEventListener('submit', function (e) {
    e.preventDefault();
    abrirComCodigo(document.getElementById('codigo').value);
  });

  // O link do e-mail tem prioridade: é o código mais novo que o cliente tem.
  var doLink = decodeURIComponent(location.hash.slice(1));
  var daSessao = '';
  try { daSessao = sessionStorage.getItem(CHAVE_SESSAO) || ''; } catch (e) {}
  var codigo = doLink || daSessao;
  if (codigo) {
    document.getElementById('codigo').value = codigo;
    abrirComCodigo(codigo);
  } else {
    document.getElementById('codigo').focus();
  }
})();
