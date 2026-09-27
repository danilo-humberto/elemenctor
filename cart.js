(() => {
  const STORAGE_KEY = 'elemenctor-cart-v2';
  const VALID_IDS = new Set(['black', 'chumbo']);
  const VALID_GENDERS = new Set(['masculina', 'feminina']);
  const VALID_SIZES = new Set(['P', 'M', 'G', 'GG']);
  const VALID_IMAGE = /^assets\/polo-(black|chumbo)-(masculina|feminina)\.png$/;
  const currency = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'});
  const WHATSAPP_NUMBER = '5581985745352';

  function normalizeItem(value) {
    if (!value || typeof value !== 'object') return null;
    const {id, name, gender, size, price, image} = value;
    if (!VALID_IDS.has(id) || typeof name !== 'string' || !name.trim() || !VALID_GENDERS.has(gender) || !VALID_SIZES.has(size)) return null;
    if (!Number.isFinite(price) || price <= 0 || !VALID_IMAGE.test(image)) return null;
    const quantity = Math.min(99, Math.max(1, Number.isInteger(value.quantity) ? value.quantity : 1));
    return {id, name:name.trim().slice(0, 80), gender, size, price, image, quantity};
  }

  function normalizeItems(value) {
    if (!Array.isArray(value)) return [];
    const grouped = new Map();
    value.forEach(raw => {
      const item = normalizeItem(raw);
      if (!item) return;
      const key = `${item.id}:${item.gender}:${item.size}`;
      if (grouped.has(key)) grouped.get(key).quantity = Math.min(99, grouped.get(key).quantity + item.quantity);
      else grouped.set(key, item);
    });
    return [...grouped.values()];
  }

  const getSubtotal = items => items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100;

  function cleanText(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
  }

  const onlyDigits = (value, limit) => String(value ?? '').replace(/\D/g, '').slice(0, limit);

  function formatPhone(value) {
    const digits = onlyDigits(value, 11);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    const area = digits.slice(0, 2);
    const local = digits.slice(2);
    if (local.length <= 4) return `(${area}) ${local}`;
    if (digits.length <= 10) return `(${area}) ${local.slice(0, 4)}-${local.slice(4)}`;
    return `(${area}) ${local.slice(0, 5)}-${local.slice(5)}`;
  }

  function formatPostalCode(value) {
    const digits = onlyDigits(value, 8);
    return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  async function lookupPostalCode(value, {fetchImpl = globalThis.fetch, signal} = {}) {
    const digits = onlyDigits(value, 8);
    if (digits.length !== 8) throw new RangeError('CEP deve conter 8 dígitos.');
    const response = await fetchImpl(`https://viacep.com.br/ws/${digits}/json/`, {
      signal,
      headers: {Accept:'application/json'},
    });
    if (!response.ok) throw new Error(`ViaCEP respondeu com status ${response.status}.`);
    const data = await response.json();
    if (data.erro === true) return null;
    return {
      address: cleanText(data.logradouro),
      district: cleanText(data.bairro),
      city: cleanText(data.localidade),
    };
  }

  function buildOrderMessage(rawItems, rawCustomer) {
    const items = normalizeItems(rawItems);
    const customer = Object.fromEntries(Object.entries(rawCustomer || {}).map(([key, value]) => [key, cleanText(value)]));
    const lines = [
      'Olá! Gostaria de realizar um pedido na Elemenctor.',
      '',
      '*DADOS DO CLIENTE*',
      `Nome: ${customer.name}`,
      `Telefone: ${customer.phone}`,
      '',
      '*ENDEREÇO DE ENTREGA*',
      `CEP: ${customer.postalCode}`,
      `Endereço: ${customer.address}`,
      `Número: ${customer.number}`,
      `Bairro: ${customer.district}`,
      `Cidade: ${customer.city}`,
    ];
    if (customer.complement) lines.push(`Complemento: ${customer.complement}`);
    lines.push('', '*ITENS DO PEDIDO*', '');
    items.forEach((item, index) => {
      const gender = item.gender.charAt(0).toUpperCase() + item.gender.slice(1);
      lines.push(
        `${index + 1}. ${item.name}`,
        `Modelagem: ${gender}`,
        `Tamanho: ${item.size}`,
        `Quantidade: ${item.quantity}`,
        `Valor unitário: ${currency.format(item.price)}`,
        `Subtotal: ${currency.format(item.price * item.quantity)}`,
        '',
      );
    });
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    lines.push(
      '*RESUMO*',
      `Total de peças: ${total}`,
      `Subtotal dos produtos: ${currency.format(getSubtotal(items))}`,
      '',
      'Pedido gerado pelo site da Elemenctor.',
    );
    return lines.join('\n');
  }

  function buildWhatsAppUrl(items, customer) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildOrderMessage(items, customer))}`;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {STORAGE_KEY, normalizeItem, normalizeItems, getSubtotal, formatPhone, formatPostalCode, lookupPostalCode, buildOrderMessage, buildWhatsAppUrl};
    return;
  }

  const layer = document.querySelector('.cart-layer');
  const drawer = document.querySelector('.cart-drawer');
  const overlay = document.querySelector('.cart-overlay');
  const bag = document.querySelector('.bag');
  const badge = document.querySelector('.bag-count');
  const closeButton = document.querySelector('.cart-close');
  const orderButton = document.querySelector('.cart-order');
  const empty = document.querySelector('.cart-empty');
  const list = document.querySelector('.cart-items');
  const footer = document.querySelector('.cart-drawer__footer');
  const subtotal = document.querySelector('.cart-subtotal strong');
  const announcement = document.querySelector('.cart-announcement');
  const pageHeader = document.querySelector('body > .header');
  const main = document.querySelector('main');
  const pageFooter = document.querySelector('body > .site-footer');
  const orderLayer = document.querySelector('.order-layer');
  const orderOverlay = document.querySelector('.order-overlay');
  const orderDialog = document.querySelector('.order-dialog');
  const orderClose = document.querySelector('.order-close');
  const orderForm = document.querySelector('.order-form');
  const orderError = document.querySelector('.order-form__error');
  const phoneInput = orderForm.elements.phone;
  const postalInput = orderForm.elements.postalCode;
  const postalStatus = document.querySelector('.postal-status');
  const addressInputs = {
    address: orderForm.elements.address,
    district: orderForm.elements.district,
    city: orderForm.elements.city,
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let items = [];
  let isOpen = false;
  let timeline = null;
  let returnFocus = null;
  let orderOpen = false;
  let orderTimeline = null;
  let orderReturnFocus = null;
  let postalController = null;
  let postalRequestId = 0;
  let lastRequestedPostalCode = '';
  let autoFilledAddress = {address:'', district:'', city:''};

  function setPostalStatus(message = '', type = '') {
    postalStatus.textContent = message;
    postalStatus.classList.toggle('is-success', type === 'success');
    postalStatus.classList.toggle('is-error', type === 'error');
  }

  function clearPreviousAutoFill() {
    Object.entries(autoFilledAddress).forEach(([key, value]) => {
      if (value && addressInputs[key].value === value) addressInputs[key].value = '';
    });
    autoFilledAddress = {address:'', district:'', city:''};
  }

  function resetPostalLookup() {
    postalController?.abort();
    postalController = null;
    postalRequestId += 1;
    lastRequestedPostalCode = '';
    autoFilledAddress = {address:'', district:'', city:''};
    postalInput.removeAttribute('aria-busy');
    postalInput.removeAttribute('aria-invalid');
    postalInput.setCustomValidity('');
    setPostalStatus();
  }

  async function handlePostalInput() {
    postalInput.value = formatPostalCode(postalInput.value);
    const digits = onlyDigits(postalInput.value, 8);
    const requestId = ++postalRequestId;
    postalController?.abort();
    postalController = null;
    postalInput.removeAttribute('aria-busy');
    postalInput.removeAttribute('aria-invalid');
    postalInput.setCustomValidity('');

    if (digits !== lastRequestedPostalCode) clearPreviousAutoFill();
    if (digits.length !== 8) {
      lastRequestedPostalCode = '';
      setPostalStatus();
      return;
    }
    if (digits === lastRequestedPostalCode) return;

    lastRequestedPostalCode = digits;
    postalController = new AbortController();
    const {signal} = postalController;
    postalInput.setAttribute('aria-busy', 'true');
    setPostalStatus('Buscando CEP…');

    try {
      const result = await lookupPostalCode(digits, {signal});
      if (requestId !== postalRequestId) return;
      if (!result) {
        postalInput.setCustomValidity('CEP não encontrado.');
        postalInput.setAttribute('aria-invalid', 'true');
        setPostalStatus('CEP não encontrado. Verifique os números.', 'error');
        return;
      }
      Object.entries(result).forEach(([key, value]) => {
        if (!value || addressInputs[key].value) return;
        addressInputs[key].value = value;
        autoFilledAddress[key] = value;
      });
      setPostalStatus('Endereço encontrado.', 'success');
    } catch (error) {
      if (error?.name === 'AbortError' || requestId !== postalRequestId) return;
      postalInput.setCustomValidity('');
      postalInput.removeAttribute('aria-invalid');
      setPostalStatus('Não foi possível consultar o CEP. Preencha o endereço manualmente.', 'error');
    } finally {
      if (requestId === postalRequestId) {
        postalController = null;
        postalInput.removeAttribute('aria-busy');
      }
    }
  }

  function load() {
    try { items = normalizeItems(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
    catch { items = []; }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
    catch { /* The cart remains usable in memory when storage is unavailable. */ }
  }

  function announce(message) {
    announcement.textContent = '';
    requestAnimationFrame(() => { announcement.textContent = message; });
  }

  function button(label, action, key, text) {
    const element = document.createElement('button');
    element.type = 'button';
    element.dataset.action = action;
    element.dataset.key = key;
    element.setAttribute('aria-label', label);
    element.textContent = text;
    return element;
  }

  function makeItem(item) {
    const key = `${item.id}:${item.gender}:${item.size}`;
    const row = document.createElement('li');
    row.className = 'cart-item';

    const media = document.createElement('div');
    media.className = 'cart-item__media';
    const image = document.createElement('img');
    image.src = item.image;
    image.alt = `${item.name}, modelagem ${item.gender}`;
    image.width = 94;
    image.height = 120;
    media.append(image);

    const content = document.createElement('div');
    content.className = 'cart-item__content';
    const title = document.createElement('h3');
    title.textContent = item.name;
    const variant = document.createElement('p');
    variant.className = 'cart-item__variant';
    variant.textContent = `Modelagem ${item.gender} · Tamanho ${item.size}`;
    const unitPrice = document.createElement('p');
    unitPrice.className = 'cart-item__price';
    unitPrice.textContent = currency.format(item.price);

    const actions = document.createElement('div');
    actions.className = 'cart-item__actions';
    const quantity = document.createElement('div');
    quantity.className = 'cart-quantity';
    quantity.setAttribute('aria-label', `Quantidade de ${item.name}, modelagem ${item.gender}, tamanho ${item.size}`);
    const decrease = button(`Diminuir quantidade de ${item.name}`, 'decrease', key, '−');
    decrease.disabled = item.quantity === 1;
    const amount = document.createElement('span');
    amount.textContent = String(item.quantity);
    amount.setAttribute('aria-live', 'off');
    const increase = button(`Aumentar quantidade de ${item.name}`, 'increase', key, '+');
    const remove = button(`Remover ${item.name}, modelagem ${item.gender}, tamanho ${item.size}`, 'remove', key, 'Remover');
    remove.className = 'cart-remove';
    quantity.append(decrease, amount, increase);
    actions.append(quantity, remove);
    content.append(title, variant, unitPrice, actions);
    row.append(media, content);
    return row;
  }

  function render() {
    list.replaceChildren(...items.map(makeItem));
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = total > 99 ? '99+' : String(total);
    badge.hidden = total === 0;
    bag.setAttribute('aria-label', total ? `Sacola de compras, ${total} ${total === 1 ? 'item' : 'itens'}` : 'Sacola de compras vazia');
    empty.hidden = items.length > 0;
    footer.hidden = items.length === 0;
    subtotal.textContent = currency.format(getSubtotal(items));
  }

  function add(raw) {
    const incoming = normalizeItem(raw);
    if (!incoming) return;
    const existing = items.find(item => item.id === incoming.id && item.gender === incoming.gender && item.size === incoming.size);
    if (existing) existing.quantity = Math.min(99, existing.quantity + 1);
    else items.push(incoming);
    save();
    render();
  }

  function canAnimate() { return Boolean(window.gsap) && !reduced.matches; }

  function setPageInactive(value) {
    pageHeader.inert = value;
    main.inert = value;
    pageFooter.inert = value;
    document.body.classList.toggle('cart-open', value);
  }

  function finishClose() {
    isOpen = false;
    layer.hidden = true;
    layer.setAttribute('aria-hidden', 'true');
    layer.classList.remove('is-static');
    bag.setAttribute('aria-expanded', 'false');
    setPageInactive(false);
    if (window.gsap) gsap.set([overlay, drawer], {clearProps:'all'});
    returnFocus?.focus({preventScroll:true});
    returnFocus = null;
  }

  function openCart() {
    if (isOpen) return;
    isOpen = true;
    returnFocus = document.activeElement;
    layer.hidden = false;
    layer.setAttribute('aria-hidden', 'false');
    bag.setAttribute('aria-expanded', 'true');
    setPageInactive(true);
    timeline?.kill();
    if (!canAnimate()) {
      layer.classList.add('is-static');
      closeButton.focus({preventScroll:true});
      return;
    }
    timeline = gsap.timeline({onComplete:() => { timeline = null; closeButton.focus({preventScroll:true}); }})
      .fromTo(overlay, {opacity:0}, {opacity:1, duration:.35, ease:'power2.out'}, 0)
      .fromTo(drawer, {x:() => drawer.offsetWidth}, {x:0, duration:.56, ease:'power3.out'}, 0);
  }

  function closeCart() {
    if (!isOpen) return;
    timeline?.kill();
    if (!canAnimate()) { finishClose(); return; }
    timeline = gsap.timeline({onComplete:finishClose})
      .to(drawer, {x:() => drawer.offsetWidth, duration:.44, ease:'power3.in'}, 0)
      .to(overlay, {opacity:0, duration:.32, ease:'power2.in'}, .08);
  }

  function finishOrderClose({restoreFocus = true} = {}) {
    orderOpen = false;
    orderLayer.hidden = true;
    orderLayer.setAttribute('aria-hidden', 'true');
    drawer.inert = false;
    if (window.gsap) gsap.set([orderOverlay, orderDialog], {clearProps:'all'});
    if (restoreFocus) orderReturnFocus?.focus({preventScroll:true});
    orderReturnFocus = null;
  }

  function openOrder() {
    if (orderOpen || items.length === 0) return;
    orderOpen = true;
    orderReturnFocus = document.activeElement;
    orderError.textContent = '';
    drawer.inert = true;
    orderLayer.hidden = false;
    orderLayer.setAttribute('aria-hidden', 'false');
    orderTimeline?.kill();
    const firstInput = orderForm.querySelector('input');
    if (!canAnimate()) { firstInput.focus({preventScroll:true}); return; }
    orderTimeline = gsap.timeline({onComplete:() => { orderTimeline = null; firstInput.focus({preventScroll:true}); }})
      .fromTo(orderOverlay, {opacity:0}, {opacity:1, duration:.28, ease:'power2.out'}, 0)
      .fromTo(orderDialog, {autoAlpha:0, y:18, scale:.975}, {autoAlpha:1, y:0, scale:1, duration:.4, ease:'power3.out'}, 0);
  }

  function closeOrder() {
    if (!orderOpen) return;
    orderTimeline?.kill();
    if (!canAnimate()) { finishOrderClose(); return; }
    orderTimeline = gsap.timeline({onComplete:() => { orderTimeline = null; finishOrderClose(); }})
      .to(orderDialog, {autoAlpha:0, y:12, scale:.985, duration:.22, ease:'power2.in'}, 0)
      .to(orderOverlay, {opacity:0, duration:.2, ease:'power2.in'}, .04);
  }

  function finishOrder() {
    const complete = () => {
      orderTimeline = null;
      finishOrderClose({restoreFocus:false});
      orderForm.reset();
      resetPostalLookup();
      finishClose();
    };
    orderTimeline?.kill();
    if (!canAnimate()) { complete(); return; }
    orderTimeline = gsap.timeline({onComplete:complete})
      .to(orderDialog, {autoAlpha:0, y:12, scale:.985, duration:.22, ease:'power2.in'}, 0)
      .to(orderOverlay, {opacity:0, duration:.2, ease:'power2.in'}, .04)
      .to(drawer, {x:() => drawer.offsetWidth, duration:.38, ease:'power3.in'}, 0)
      .to(overlay, {opacity:0, duration:.28, ease:'power2.in'}, .06);
  }

  function submitOrder(event) {
    event.preventDefault();
    orderError.textContent = '';
    if (!orderForm.checkValidity()) {
      orderForm.reportValidity();
      orderForm.querySelector(':invalid')?.focus({preventScroll:true});
      return;
    }
    const customer = Object.fromEntries(new FormData(orderForm).entries());
    const link = document.createElement('a');
    link.href = buildWhatsAppUrl(items, customer);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.append(link);
    link.click();
    link.remove();
    items = [];
    save();
    render();
    finishOrder();
  }

  function findControl(action, key) {
    return [...list.querySelectorAll('button')].find(control => control.dataset.action === action && control.dataset.key === key);
  }

  function updateItem(event) {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const item = items.find(candidate => `${candidate.id}:${candidate.gender}:${candidate.size}` === control.dataset.key);
    if (!item) return;
    const {action, key} = control.dataset;
    let message = '';
    if (action === 'increase' && item.quantity < 99) {
      item.quantity += 1;
      message = `Quantidade de ${item.name} aumentada para ${item.quantity}.`;
    } else if (action === 'decrease' && item.quantity > 1) {
      item.quantity -= 1;
      message = `Quantidade de ${item.name} reduzida para ${item.quantity}.`;
    } else if (action === 'remove') {
      items = items.filter(candidate => candidate !== item);
      message = `${item.name}, modelagem ${item.gender}, tamanho ${item.size}, removida da sacola.`;
    } else return;
    save();
    render();
    announce(message);
    (action === 'remove' ? closeButton : findControl(action, key))?.focus({preventScroll:true});
  }

  function trapFocus(event) {
    if (!isOpen || orderOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); closeCart(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...drawer.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) { event.preventDefault(); drawer.focus(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function trapOrderFocus(event) {
    if (!orderOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); closeOrder(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...orderDialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) { event.preventDefault(); orderDialog.focus(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  bag.addEventListener('click', openCart);
  closeButton.addEventListener('click', closeCart);
  orderButton.addEventListener('click', openOrder);
  overlay.addEventListener('click', closeCart);
  orderClose.addEventListener('click', closeOrder);
  orderOverlay.addEventListener('click', closeOrder);
  phoneInput.addEventListener('input', () => { phoneInput.value = formatPhone(phoneInput.value); });
  postalInput.addEventListener('input', handlePostalInput);
  orderForm.addEventListener('submit', submitOrder);
  list.addEventListener('click', updateItem);
  document.addEventListener('keydown', trapFocus);
  document.addEventListener('keydown', trapOrderFocus);
  window.addEventListener('elemenctor:cart-add', event => add(event.detail));
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    if (timeline) timeline.progress(1);
    if (orderTimeline) orderTimeline.progress(1);
  });
  load();
  render();
})();
