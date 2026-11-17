import assert from 'node:assert/strict';
import test from 'node:test';
import {
  htmlStillPointsToMailchimp,
  scrubMailchimpNewsletterHtml,
} from './scrub-mailchimp-newsletter-html';

const opts = {
  appUrl: 'https://dev.mali.pe',
  slug: 'mailchimp-boletin-mensual-nov-2026',
};

test('normalizes view-in-browser for all templates and rewrites known archives', () => {
  const html = scrubMailchimpNewsletterHtml(
    `<p><a href="https://mailchi.mp/mali/boletinmarzo2026-7706953?e=[UNIQID]">View this email in your browser</a></p>
     <p><a href="https://mailchi.mp/mali/boletinnoviembre2026-7706881?e=[UNIQID]">PROGRAMACIÓN COMPLETA AQUÍ</a></p>`,
    opts,
  );
  assert.match(html, /Ver este correo en el navegador/);
  assert.match(
    html,
    /https:\/\/dev\.mali\.pe\/n\/mailchimp-boletin-mensual-nov-2026/,
  );
  assert.match(
    html,
    /https:\/\/dev\.mali\.pe\/n\/mailchimp-boletin-auditorio-nov-2026/,
  );
  assert.equal(htmlStillPointsToMailchimp(html).length, 0);
});

test('injects view-in-browser when missing', () => {
  const html = scrubMailchimpNewsletterHtml('<p>Solo contenido</p>', opts);
  assert.match(html, /data-mali-view-in-browser/);
  assert.match(html, /Ver este correo en el navegador/);
  assert.match(
    html,
    /href="https:\/\/dev\.mali\.pe\/n\/mailchimp-boletin-mensual-nov-2026"/,
  );
});

test('removes list-manage preference/unsubscribe copy and referral badge', () => {
  const html = scrubMailchimpNewsletterHtml(
    `Want to change how you receive these emails?
     You can <a href="https://mali.us10.list-manage.com/profile?u=1&e=[UNIQID]">update your preferences</a>
     or <a href="https://mali.us10.list-manage.com/unsubscribe?u=1&e=[UNIQID]">unsubscribe from this list</a>.
     <a href="https://login.mailchimp.com/signup/email-referral/?aid=1"><img src="https://cdn-images.mailchimp.com/monkey_rewards/x.png" alt="Email Marketing Powered by Mailchimp" /></a>`,
    opts,
  );
  assert.doesNotMatch(html, /Want to change/i);
  assert.doesNotMatch(html, /update your preferences/i);
  assert.doesNotMatch(html, /unsubscribe from this list/i);
  assert.doesNotMatch(html, /list-manage/);
  assert.doesNotMatch(html, /login\.mailchimp/);
  assert.doesNotMatch(html, /Powered by Mailchimp/i);
  assert.doesNotMatch(html, /cdn-images\.mailchimp/);
});

test('removes Spanish preference leftovers after copyright', () => {
  const year = new Date().getFullYear();
  const html = scrubMailchimpNewsletterHtml(
    `© 2024 MALI — Museo de Arte de Lima. Todos los derechos reservados.
     Eres parte del MALI
     ¿Quieres hacer cambios en cómo recibes estos emails?
     Puedes  o .
     You can or .
     You can or .`,
    opts,
  );
  assert.match(
    html,
    new RegExp(
      `© ${year} MALI — Museo de Arte de Lima\\. Todos los derechos reservados\\.`,
    ),
  );
  assert.doesNotMatch(html, /Eres parte del MALI/i);
  assert.doesNotMatch(html, /Quieres hacer cambios/i);
  assert.doesNotMatch(html, /Puedes(?:\s|&nbsp;)+o/i);
  assert.doesNotMatch(html, /You can(?:\s|&nbsp;)+or/i);
});

test('removes Puedes leftovers that use &nbsp;', () => {
  const html = scrubMailchimpNewsletterHtml(
    `<em>© 2026 MALI — Museo de Arte de Lima. Todos los derechos reservados.</em><br>
     <p dir="ltr" style="color:#222"></p>
     Puedes&nbsp;&nbsp;o&nbsp;.`,
    opts,
  );
  assert.doesNotMatch(html, /Puedes/i);
  assert.doesNotMatch(html, /&nbsp;&nbsp;o&nbsp;\./i);
});

test('normalizes English copyright to Spanish with current year', () => {
  const year = new Date().getFullYear();
  const html = scrubMailchimpNewsletterHtml(
    `Copyright © 2023 Museo de Arte de Lima, All rights reserved.`,
    opts,
  );
  assert.match(
    html,
    new RegExp(
      `© ${year} MALI — Museo de Arte de Lima\\. Todos los derechos reservados\\.`,
    ),
  );
  assert.doesNotMatch(html, /All rights reserved/i);
});

test('unknown mailchi.mp archive falls back to mali.pe', () => {
  const html = scrubMailchimpNewsletterHtml(
    `<a href="https://mailchi.mp/mali/boletinmarzo2026-7706613?e=[UNIQID]"><img src="x.jpg" /></a>`,
    opts,
  );
  assert.match(html, /href="https:\/\/mali\.pe"/);
  assert.equal(htmlStillPointsToMailchimp(html).length, 0);
});

test('rewrites Mailchimp social icon CDN to local newsletter-brands paths', () => {
  const html = scrubMailchimpNewsletterHtml(
    `<img src="https://cdn-images.mailchimp.com/icons/social-block-v2/light-facebook-96.png" alt="Facebook" />
     <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-tiktok-96.png" alt="TikTok" />`,
    opts,
  );
  assert.match(
    html,
    /https:\/\/dev\.mali\.pe\/newsletter-brands\/social\/facebook\.png/,
  );
  assert.match(
    html,
    /https:\/\/dev\.mali\.pe\/newsletter-brands\/social\/tiktok\.png/,
  );
  assert.equal(htmlStillPointsToMailchimp(html).length, 0);
});
