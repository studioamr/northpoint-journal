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
    {id:'aurora-azul',    n:'Aurora Azul',    d:'Vidrio + aurora cian que se mueve', sw:['#070b16','#38BDF8']},
    {id:'aurora-naranja', n:'Aurora Naranja', d:'Vidrio + aurora ámbar y coral', sw:['#120906','#FB923C']},
    {id:'aurora-morado',  n:'Aurora Morado',  d:'Vidrio + aurora violeta y rosa', sw:['#0c0714','#A78BFA']},
    {id:'aurora-verde',   n:'Aurora Verde',   d:'Vidrio + aurora esmeralda', sw:['#06110d','#34D399']}
  ];
  function aplicar(id){
    if(id && id.startsWith('tron-')) id = id.replace('tron-', 'aurora-');   // los Tron viejos pasan a Aurora
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
