/* ============================================================================
   NORTHPOINT JOURNAL — temas y perfil
   El tema se aplica con data-theme en <html>; los tokens viven en app.css.
   ========================================================================= */
(function(){
  const TEMAS = [
    {id:'acido',   n:'Ácido',        d:'Negro + verde ácido · el de fábrica'},
    {id:'blanco',  n:'Blanco',       d:'Negro + blanco · la marca original'},
    {id:'oro',     n:'Oro',          d:'Negro + dorado NorthPoint · trader backing'},
    {id:'papel',   n:'Papel',        d:'Claro, tinta y un acento · para el día'},
    {id:'cobalto', n:'Cobalto',      d:'Azul profundo + hielo'},
    {id:'tron-azul',    n:'Tron Azul',    d:'Rejilla y neón cian · energía', sw:['#03070f','#22D3EE']},
    {id:'tron-naranja', n:'Tron Naranja', d:'Neón naranja · Clu', sw:['#0b0603','#FF7A1A']},
    {id:'tron-morado',  n:'Tron Morado',  d:'Neón violeta · sintético', sw:['#07040f','#B26BFF']},
    {id:'tron-verde',   n:'Tron Verde',   d:'Neón verde · matrix', sw:['#02090a','#39FF88']}
  ];
  function aplicar(id){
    document.documentElement.setAttribute('data-theme', id || 'acido');
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();
    window.__temaAcc = acc;
    document.dispatchEvent(new CustomEvent('mesa:tema', {detail:{id, acc}}));
  }
  function perfil(){ return Object.assign({nombre:'André', alias:'', ciudad:'Morelia', frase:'Del examen al payout', foto:null, iniciales:'AM'}, Store.ajustes.perfil || {}); }
  function guardaPerfil(campos){ Store.ajustes.perfil = Object.assign(perfil(), campos); Store.guardar(); }
  window.Tema = { TEMAS, aplicar, perfil, guardaPerfil };
  aplicar((Store.ajustes && Store.ajustes.tema) || 'acido');
})();
