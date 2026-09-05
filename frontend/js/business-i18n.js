(() => {
  const LANGS = {
    pt: 'Português', en: 'English', fr: 'Français', es: 'Español', sw: 'Kiswahili'
  };
  const dict = {
    pt: {
      'BUSINESS':'NEGÓCIOS','BUSINESS STUDIO':'ESTÚDIO DE NEGÓCIOS',
      'Invoice Generator':'Gerador de Faturas','Quote Generator':'Gerador de Orçamentos','Business Document Generator':'Gerador de Documentos Empresariais','Meeting Agenda':'Agenda de Reunião','Business Calculator':'Calculadora Empresarial',
      'Create invoices.':'Crie faturas.','Build a clean invoice draft with items, quantities, tax and totals.':'Crie uma fatura clara com itens, quantidades, imposto e totais.','Choose your workspace':'Escolha a sua ferramenta','Each experience is designed for a specific business task and works independently.':'Cada ferramenta foi criada para uma tarefa empresarial específica e funciona de forma independente.','Your data stays in your browser unless an experience explicitly says otherwise.':'Os seus dados permanecem no navegador, salvo indicação em contrário.',
      'Client name':'Nome do cliente','VAT / tax rate (%)':'IVA / taxa de imposto (%)','Add item':'Adicionar item','Clear':'Limpar','Print / Save PDF':'Imprimir / Guardar PDF','Subtotal:':'Subtotal:','VAT / tax':'IVA / imposto','Total:':'Total:','Client:':'Cliente:',
      'Price with clarity.':'Defina preços com clareza.','Create a service quote with quantities, unit prices and an adjustable tax estimate.':'Crie um orçamento de serviços com quantidades, preços unitários e imposto ajustável.','Customer name':'Nome do cliente','Tax rate (%)':'Taxa de imposto (%)','Add service':'Adicionar serviço','Service':'Serviço','Customer:':'Cliente:','Tax':'Imposto',
      'Draft professionally.':'Crie documentos profissionais.','Turn structured notes into a clean business document ready to copy or print.':'Transforme notas estruturadas num documento empresarial pronto para copiar ou imprimir.','Document title':'Título do documento','Document content':'Conteúdo do documento','Write your content…':'Escreva o seu conteúdo…','Copy':'Copiar','Document copied.':'Documento copiado.','Copy failed. Please select the text manually.':'Falha ao copiar. Selecione o texto manualmente.','Document cleared.':'Documento limpo.','Nothing to copy.':'Nada para copiar.','Add content before printing.':'Adicione conteúdo antes de imprimir.',
      'Meet with purpose.':'Reúna-se com propósito.','Prepare topics, assign owners and capture the decisions that matter.':'Prepare tópicos, atribua responsáveis e registe as decisões importantes.','Meeting title':'Título da reunião','Add topic':'Adicionar tópico','Copy agenda':'Copiar agenda','Topic':'Tópico','Owner':'Responsável','Agenda copied.':'Agenda copiada.','Agenda cleared.':'Agenda limpa.','Add a meeting title or topic before printing.':'Adicione um título ou tópico antes de imprimir.',
      'Know your numbers.':'Conheça os seus números.','Estimate revenue, costs, profit, margin and break-even from practical inputs.':'Calcule receita, custos, lucro, margem e ponto de equilíbrio.','Units sold':'Unidades vendidas','Price per unit':'Preço por unidade','Cost per unit':'Custo por unidade','Fixed costs':'Custos fixos','Reset':'Repor','Copy results':'Copiar resultados','Copied':'Copiado','Copy failed':'Falha ao copiar','Revenue:':'Receita:','Variable costs:':'Custos variáveis:','Profit:':'Lucro:','Margin:':'Margem:','Markup:':'Margem sobre custo:','Break-even:':'Ponto de equilíbrio:'
    },
    fr: {
      'BUSINESS':'ENTREPRISE','BUSINESS STUDIO':'STUDIO ENTREPRISE','Invoice Generator':'Générateur de factures','Quote Generator':'Générateur de devis','Business Document Generator':'Générateur de documents professionnels','Meeting Agenda':'Ordre du jour','Business Calculator':'Calculatrice professionnelle','Create invoices.':'Créez des factures.','Build a clean invoice draft with items, quantities, tax and totals.':'Créez une facture claire avec articles, quantités, taxes et totaux.','Choose your workspace':'Choisissez votre outil','Client name':'Nom du client','VAT / tax rate (%)':'TVA / taux de taxe (%)','Add item':'Ajouter un article','Clear':'Effacer','Print / Save PDF':'Imprimer / Enregistrer en PDF','Subtotal:':'Sous-total :','VAT / tax':'TVA / taxe','Total:':'Total :','Client:':'Client :','Price with clarity.':'Définissez vos prix clairement.','Create a service quote with quantities, unit prices and an adjustable tax estimate.':'Créez un devis avec quantités, prix unitaires et taxe ajustable.','Customer name':'Nom du client','Tax rate (%)':'Taux de taxe (%)','Add service':'Ajouter un service','Service':'Service','Customer:':'Client :','Tax':'Taxe','Draft professionally.':'Créez des documents professionnels.','Document title':'Titre du document','Document content':'Contenu du document','Write your content…':'Écrivez votre contenu…','Copy':'Copier','Document copied.':'Document copié.','Copy failed. Please select the text manually.':'Échec de la copie. Sélectionnez le texte manuellement.','Document cleared.':'Document effacé.','Nothing to copy.':'Rien à copier.','Add content before printing.':'Ajoutez du contenu avant l’impression.','Meet with purpose.':'Réunissez-vous efficacement.','Prepare topics, assign owners and capture the decisions that matter.':'Préparez les sujets, attribuez les responsables et notez les décisions importantes.','Meeting title':'Titre de la réunion','Add topic':'Ajouter un sujet','Copy agenda':'Copier l’ordre du jour','Topic':'Sujet','Owner':'Responsable','Agenda copied.':'Ordre du jour copié.','Agenda cleared.':'Ordre du jour effacé.','Add a meeting title or topic before printing.':'Ajoutez un titre ou un sujet avant l’impression.','Know your numbers.':'Maîtrisez vos chiffres.','Estimate revenue, costs, profit, margin and break-even from practical inputs.':'Estimez revenus, coûts, bénéfices, marge et seuil de rentabilité.','Units sold':'Unités vendues','Price per unit':'Prix unitaire','Cost per unit':'Coût unitaire','Fixed costs':'Coûts fixes','Reset':'Réinitialiser','Copy results':'Copier les résultats','Copied':'Copié','Copy failed':'Échec de la copie','Revenue:':'Revenus :','Variable costs:':'Coûts variables :','Profit:':'Bénéfice :','Margin:':'Marge :','Markup:':'Majoration :','Break-even:':'Seuil de rentabilité :'
    },
    es: {
      'BUSINESS':'NEGOCIOS','BUSINESS STUDIO':'ESTUDIO DE NEGOCIOS','Invoice Generator':'Generador de facturas','Quote Generator':'Generador de presupuestos','Business Document Generator':'Generador de documentos empresariales','Meeting Agenda':'Agenda de reunión','Business Calculator':'Calculadora empresarial','Create invoices.':'Crea facturas.','Build a clean invoice draft with items, quantities, tax and totals.':'Crea una factura clara con artículos, cantidades, impuestos y totales.','Choose your workspace':'Elige tu herramienta','Client name':'Nombre del cliente','VAT / tax rate (%)':'IVA / tasa de impuesto (%)','Add item':'Añadir artículo','Clear':'Limpiar','Print / Save PDF':'Imprimir / Guardar PDF','Subtotal:':'Subtotal:','VAT / tax':'IVA / impuesto','Total:':'Total:','Client:':'Cliente:','Price with clarity.':'Define precios con claridad.','Create a service quote with quantities, unit prices and an adjustable tax estimate.':'Crea un presupuesto con cantidades, precios unitarios e impuesto ajustable.','Customer name':'Nombre del cliente','Tax rate (%)':'Tasa de impuesto (%)','Add service':'Añadir servicio','Service':'Servicio','Customer:':'Cliente:','Tax':'Impuesto','Draft professionally.':'Crea documentos profesionales.','Document title':'Título del documento','Document content':'Contenido del documento','Write your content…':'Escribe tu contenido…','Copy':'Copiar','Document copied.':'Documento copiado.','Copy failed. Please select the text manually.':'No se pudo copiar. Selecciona el texto manualmente.','Document cleared.':'Documento borrado.','Nothing to copy.':'Nada que copiar.','Add content before printing.':'Añade contenido antes de imprimir.','Meet with purpose.':'Reúnete con propósito.','Prepare topics, assign owners and capture the decisions that matter.':'Prepara temas, asigna responsables y registra las decisiones importantes.','Meeting title':'Título de la reunión','Add topic':'Añadir tema','Copy agenda':'Copiar agenda','Topic':'Tema','Owner':'Responsable','Agenda copied.':'Agenda copiada.','Agenda cleared.':'Agenda borrada.','Add a meeting title or topic before printing.':'Añade un título o tema antes de imprimir.','Know your numbers.':'Conoce tus números.','Estimate revenue, costs, profit, margin and break-even from practical inputs.':'Calcula ingresos, costes, beneficio, margen y punto de equilibrio.','Units sold':'Unidades vendidas','Price per unit':'Precio por unidad','Cost per unit':'Coste por unidad','Fixed costs':'Costes fijos','Reset':'Restablecer','Copy results':'Copiar resultados','Copied':'Copiado','Copy failed':'Error al copiar','Revenue:':'Ingresos:','Variable costs:':'Costes variables:','Profit:':'Beneficio:','Margin:':'Margen:','Markup:':'Margen sobre coste:','Break-even:':'Punto de equilibrio:'
    },
    sw: {
      'BUSINESS':'BIASHARA','BUSINESS STUDIO':'STUDIO YA BIASHARA','Invoice Generator':'Kitengeneza Ankara','Quote Generator':'Kitengeneza Nukuu','Business Document Generator':'Kitengeneza Nyaraka za Biashara','Meeting Agenda':'Ajenda ya Mkutano','Business Calculator':'Kikokotoo cha Biashara','Create invoices.':'Tengeneza ankara.','Build a clean invoice draft with items, quantities, tax and totals.':'Tengeneza ankara yenye bidhaa, kiasi, kodi na jumla.','Choose your workspace':'Chagua zana yako','Client name':'Jina la mteja','VAT / tax rate (%)':'VAT / kiwango cha kodi (%)','Add item':'Ongeza bidhaa','Clear':'Futa','Print / Save PDF':'Chapisha / Hifadhi PDF','Subtotal:':'Jumla ndogo:','VAT / tax':'VAT / kodi','Total:':'Jumla:','Client:':'Mteja:','Price with clarity.':'Weka bei kwa uwazi.','Create a service quote with quantities, unit prices and an adjustable tax estimate.':'Tengeneza nukuu ya huduma yenye kiasi, bei za kitengo na kodi inayoweza kubadilishwa.','Customer name':'Jina la mteja','Tax rate (%)':'Kiwango cha kodi (%)','Add service':'Ongeza huduma','Service':'Huduma','Customer:':'Mteja:','Tax':'Kodi','Draft professionally.':'Tengeneza nyaraka za kitaalamu.','Document title':'Kichwa cha hati','Document content':'Maudhui ya hati','Write your content…':'Andika maudhui yako…','Copy':'Nakili','Document copied.':'Hati imenakiliwa.','Copy failed. Please select the text manually.':'Kunakili kumeshindikana. Chagua maandishi mwenyewe.','Document cleared.':'Hati imefutwa.','Nothing to copy.':'Hakuna cha kunakili.','Add content before printing.':'Ongeza maudhui kabla ya kuchapisha.','Meet with purpose.':'Fanya mikutano yenye lengo.','Prepare topics, assign owners and capture the decisions that matter.':'Andaa mada, wape watu majukumu na rekodi maamuzi muhimu.','Meeting title':'Kichwa cha mkutano','Add topic':'Ongeza mada','Copy agenda':'Nakili ajenda','Topic':'Mada','Owner':'Mhusika','Agenda copied.':'Ajenda imenakiliwa.','Agenda cleared.':'Ajenda imefutwa.','Add a meeting title or topic before printing.':'Ongeza kichwa au mada kabla ya kuchapisha.','Know your numbers.':'Jua namba zako.','Estimate revenue, costs, profit, margin and break-even from practical inputs.':'Kadiria mapato, gharama, faida, margin na usawa wa gharama.','Units sold':'Vitengo vilivyouzwa','Price per unit':'Bei kwa kitengo','Cost per unit':'Gharama kwa kitengo','Fixed costs':'Gharama zisizobadilika','Reset':'Weka upya','Copy results':'Nakili matokeo','Copied':'Imenakiliwa','Copy failed':'Kunakili kumeshindikana','Revenue:':'Mapato:','Variable costs:':'Gharama zinazobadilika:','Profit:':'Faida:','Margin:':'Margin:','Markup:':'Markup:','Break-even:':'Usawa wa gharama:'
    },
    en: {}
  };

  const storageKeys = ['nexauren-business-language', 'nexauren-language', 'nexauren_language'];
  let lang = storageKeys.map(k => localStorage.getItem(k)).find(v => LANGS[v]) || 'en';
  const pageTitle = document.title;

  function saveLanguage(value) {
    lang = value;
    storageKeys.forEach(k => localStorage.setItem(k, value));
    document.documentElement.lang = value === 'sw' ? 'sw' : value;
    translate();
  }

  function translateValue(value) {
    if (lang === 'en') return value;
    const map = dict[lang] || {};
    let result = value;
    Object.entries(map).sort((a,b) => b[0].length-a[0].length).forEach(([from,to]) => {
      if (result === from) result = to;
      else if (result.includes(from)) result = result.split(from).join(to);
    });
    return result;
  }

  function translate() {
    const map = dict[lang] || {};
    document.querySelectorAll('input[placeholder], textarea[placeholder], [aria-label]').forEach(el => {
      if (el.dataset.i18nOriginalPlaceholder === undefined) el.dataset.i18nOriginalPlaceholder = el.placeholder || '';
      if (el.dataset.i18nOriginalAria === undefined) el.dataset.i18nOriginalAria = el.getAttribute('aria-label') || '';
      el.placeholder = translateValue(el.dataset.i18nOriginalPlaceholder);
      if (el.dataset.i18nOriginalAria) el.setAttribute('aria-label', translateValue(el.dataset.i18nOriginalAria));
    });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (!node.parentElement || ['SCRIPT','STYLE','SELECT','OPTION'].includes(node.parentElement.tagName)) return;
      if (node.dataset?.i18nOriginal === undefined) node.dataset.i18nOriginal = node.nodeValue;
      node.nodeValue = translateValue(node.dataset.i18nOriginal);
    });
    const titleMap = {
      'Invoice Generator — Nexauren':'Invoice Generator — Nexauren','Quote Generator — Nexauren':'Quote Generator — Nexauren','Business Document Generator — Nexauren':'Business Document Generator — Nexauren','Meeting Agenda — Nexauren':'Meeting Agenda — Nexauren','Business Calculator — Nexauren':'Business Calculator — Nexauren'
    };
    if (titleMap[pageTitle]) document.title = translateValue(titleMap[pageTitle]);
  }

  function mountSelector() {
    const style = document.createElement('style');
    style.textContent = '.nexa-lang{position:fixed;top:12px;right:12px;z-index:9999;padding:9px 12px;border:1px solid rgba(0,0,0,.12);border-radius:10px;background:#fff;color:#172033;box-shadow:0 5px 18px rgba(0,0,0,.08);font:inherit}.nexa-lang-label{position:fixed;top:15px;right:175px;z-index:9999;font-size:12px;opacity:.7}@media(max-width:560px){.nexa-lang-label{display:none}.nexa-lang{top:8px;right:8px}}';
    document.head.appendChild(style);
    const select = document.createElement('select'); select.className='nexa-lang'; select.setAttribute('aria-label','Language');
    Object.entries(LANGS).forEach(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o)});
    select.value=lang; select.addEventListener('change',()=>saveLanguage(select.value));
    document.body.appendChild(select);
  }

  mountSelector();
  translate();
  new MutationObserver(() => { if (!document.querySelector('.nexa-lang')) return; translate(); }).observe(document.body,{childList:true,subtree:true});
})();
