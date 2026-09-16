const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getCurrentYear, updateFooterYear } = require('../footer.js');

const root = path.join(__dirname, '..');
const markup = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'footer.css'), 'utf8');

test('ano do footer usa a data recebida e atualiza texto e datetime', () => {
  const element = {
    textContent: '',
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const documentStub = { querySelectorAll: () => [element] };
  const date = new Date('2032-06-15T12:00:00Z');

  assert.equal(getCurrentYear(date), 2032);
  assert.equal(updateFooterYear(documentStub, date), '2032');
  assert.equal(element.textContent, '2032');
  assert.equal(element.attributes.datetime, '2032');
});

test('footer contém marca, contatos e crédito com links externos seguros', () => {
  const footer = markup.match(/<footer class="site-footer"[\s\S]*?<\/footer>/)?.[0] || '';

  assert.match(footer, /LOGO ELEMENCTOR SEM FUNDO\.png/);
  assert.match(footer, /https:\/\/www\.instagram\.com\/elemenctor_\//);
  assert.match(footer, /https:\/\/wa\.me\/5581985745352/);
  assert.match(footer, /https:\/\/danilo-humberto\.github\.io\/helio3tech\//);
  assert.equal((footer.match(/target="_blank"/g) || []).length, 3);
  assert.equal((footer.match(/rel="noopener noreferrer"/g) || []).length, 3);
  assert.match(footer, /data-current-year[^>]*datetime="2026">2026<\/time>/);
  assert.match(footer, /data-social-icon="instagram"[^>]*aria-hidden="true"/);
  assert.match(footer, /data-social-icon="whatsapp"[^>]*aria-hidden="true"/);
  assert.match(footer, /site-footer__label[\s\S]*?data-social-icon="instagram"[\s\S]*?<span>Instagram<\/span>/);
  assert.match(footer, /site-footer__label[\s\S]*?data-social-icon="whatsapp"[\s\S]*?<span>Atendimento<\/span>/);
  assert.equal((footer.match(/class="site-footer__external-icon"/g) || []).length, 2);
});

test('footer possui responsividade, foco herdado e movimento reduzido', () => {
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /min-height: 52px/);
  assert.match(markup, /aria-label="Canais da Elemenctor"/);
  assert.match(styles, /\.site-footer__contact:hover \.site-footer__external-icon/);
  assert.doesNotMatch(styles, /\.site-footer__contact:hover svg/);
});
