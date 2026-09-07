// Service worker mínimo — necessário para o navegador considerar o site
// "instalável" (adicionar ao ecrã inicial). Por agora não faz cache
// nem funciona offline; só regista presença, o que já é suficiente
// para o ícone e o modo ecrã cheio funcionarem.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Sem cache por agora — deixa tudo passar direto para a rede.
});
