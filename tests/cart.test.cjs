const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {STORAGE_KEY,normalizeItem,normalizeItems,getSubtotal,formatPhone,formatPostalCode,lookupPostalCode,buildOrderMessage,buildWhatsAppUrl}=require('../cart.js');

const markup=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const styles=fs.readFileSync(path.join(__dirname,'..','cart.css'),'utf8');
const products=fs.readFileSync(path.join(__dirname,'..','products.js'),'utf8');

const black={id:'black',name:'Polo Personal Black',gender:'masculina',size:'P',price:149.9,image:'assets/polo-black-masculina.png',quantity:1};
const chumbo={id:'chumbo',name:'Polo Personal Chumbo',gender:'feminina',size:'GG',price:159.9,image:'assets/polo-chumbo-feminina.png',quantity:2};

test('normaliza, agrupa e limita itens restaurados',()=>{
  const restored=normalizeItems([black,{...black,quantity:3},chumbo,{...black,id:'invalido'},null]);
  assert.equal(restored.length,2);
  assert.equal(restored[0].quantity,4);
  assert.equal(restored[1].quantity,2);
  assert.equal(STORAGE_KEY,'elemenctor-cart-v2');
});

test('descarta payloads inválidos e calcula subtotal',()=>{
  assert.equal(normalizeItem({...black,price:NaN}),null);
  assert.equal(normalizeItem({...black,image:'https://example.com/x.png'}),null);
  assert.equal(normalizeItem({...black,gender:'infantil'}),null);
  assert.equal(normalizeItem({...black,size:'XG'}),null);
  assert.equal(normalizeItem(({id:black.id,name:black.name,gender:black.gender,price:black.price,image:black.image})),null);
  assert.equal(getSubtotal([black,chumbo]),469.7);
});
test('separa variantes do mesmo produto por tamanho',()=>{
  const restored=normalizeItems([black,{...black,size:'M'}]);
  assert.equal(restored.length,2);
  assert.deepEqual(restored.map(item=>item.size),['P','M']);
});

test('drawer possui contrato acessível e controles previstos',()=>{
  assert.match(markup,/id="cart-drawer"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(markup,/class="cart-announcement sr-only" role="status" aria-live="polite"/);
  assert.match(markup,/class="bag-count"[^>]*hidden/);
  assert.match(markup,/class="cart-order"[^>]*aria-haspopup="dialog"[^>]*aria-controls="order-dialog"[^>]*>Realizar Pedido</);
  assert.doesNotMatch(markup,/Frete e condições serão calculados posteriormente/);
  assert.doesNotMatch(markup,/shop-note/);
});

test('modal de pedido contém todos os campos e contrato acessível',()=>{
  const dialog=markup.match(/<div class="order-layer"[\s\S]*?<\/section>\s*<\/div>/)?.[0]||'';
  assert.match(dialog,/id="order-dialog"[^>]*role="dialog"[^>]*aria-modal="true"/);
  ['name','phone','postalCode','address','number','district','city','complement'].forEach(name=>assert.match(dialog,new RegExp(`name="${name}"`)));
  assert.match(dialog,/class="order-submit"[^>]*type="submit">Finalizar Pedido/);
  assert.match(dialog,/Complemento <small>\(opcional\)<\/small>/);
  assert.ok(dialog.includes('maxlength="15" pattern="\\([0-9]{2}\\) ([0-9]{4}|[0-9]{5})-[0-9]{4}"'));
  assert.match(dialog,/class="order-field__status-space" aria-hidden="true"/);
  assert.match(dialog,/id="postal-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(dialog,/class="order-field order-field--wide order-field--address"/);
  assert.match(styles,/\.order-field--address\s*\{\s*margin-top:\s*-8px;/);
});

test('formata telefone fixo, celular, entrada parcial e colagem com ruído',()=>{
  assert.equal(formatPhone('8134567890'),'(81) 3456-7890');
  assert.equal(formatPhone('81985745352'),'(81) 98574-5352');
  assert.equal(formatPhone('81'),' (81'.trim());
  assert.equal(formatPhone('81abc98574-5352'),'(81) 98574-5352');
  assert.equal(formatPhone('(81) 98574-535'),'(81) 9857-4535');
});

test('formata CEP parcial, completo e colado com caracteres inválidos',()=>{
  assert.equal(formatPostalCode('50000'),'50000');
  assert.equal(formatPostalCode('50000000'),'50000-000');
  assert.equal(formatPostalCode('50.000 abc-000'),'50000-000');
});

test('consulta e normaliza resposta do ViaCEP',async()=>{
  const controller=new AbortController();
  let request;
  const result=await lookupPostalCode('01001-000',{signal:controller.signal,fetchImpl:async(url,options)=>{
    request={url,options};
    return {ok:true,json:async()=>({logradouro:' Praça da Sé ',bairro:'Sé',localidade:'São Paulo',uf:'SP'})};
  }});
  assert.equal(request.url,'https://viacep.com.br/ws/01001000/json/');
  assert.equal(request.options.signal,controller.signal);
  assert.deepEqual(result,{address:'Praça da Sé',district:'Sé',city:'São Paulo'});
  assert.equal('uf' in result,false);
});

test('distingue CEP inexistente e falha HTTP',async()=>{
  const missing=await lookupPostalCode('00000000',{fetchImpl:async()=>({ok:true,json:async()=>({erro:true})})});
  assert.equal(missing,null);
  await assert.rejects(
    lookupPostalCode('01001000',{fetchImpl:async()=>({ok:false,status:400})}),
    /status 400/,
  );
  await assert.rejects(lookupPostalCode('123'),/8 dígitos/);
});

test('mensagem do WhatsApp inclui cliente, itens, totais e omite complemento vazio',()=>{
  const customer={name:' João da Silva ',phone:'(81) 99999-9999',postalCode:'50000-000',address:'Rua Exemplo',number:'123',district:'Centro',city:'Recife',complement:'   '};
  const message=buildOrderMessage([{...black,quantity:2},chumbo],customer);
  assert.match(message,/\*DADOS DO CLIENTE\*[\s\S]*Nome: João da Silva/);
  assert.match(message,/\*ENDEREÇO DE ENTREGA\*[\s\S]*Bairro: Centro/);
  assert.match(message,/1\. Polo Personal Black[\s\S]*Modelagem: Masculina[\s\S]*Tamanho: P[\s\S]*Quantidade: 2/);
  assert.match(message,/2\. Polo Personal Chumbo[\s\S]*Modelagem: Feminina[\s\S]*Tamanho: GG/);
  assert.match(message,/Total de peças: 4/);
  assert.match(message,/Subtotal dos produtos: R\$\s*619,60/);
  assert.doesNotMatch(message,/Complemento:/);
  const url=buildWhatsAppUrl([black],{...customer,complement:'Apto 201'});
  assert.match(url,/^https:\/\/wa\.me\/5581985745352\?text=/);
  assert.match(decodeURIComponent(url),/Complemento: Apto 201/);
});

test('integração usa evento interno e animação lateral',()=>{
  assert.match(products,/new CustomEvent\('elemenctor:cart-add'/);
  assert.match(styles,/\.cart-layer\.is-static \.cart-drawer/);
  const cartSource=fs.readFileSync(path.join(__dirname,'..','cart.js'),'utf8');
  assert.match(cartSource,/fromTo\(drawer, \{x:\(\) => drawer\.offsetWidth\}, \{x:0/);
  assert.match(cartSource,/items = \[\];[\s\S]*save\(\);[\s\S]*render\(\);[\s\S]*finishOrder\(\)/);
  assert.match(cartSource,/pageFooter\.inert = value/);
});
