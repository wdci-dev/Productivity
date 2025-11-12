// ==UserScript==
// @name         Salesforce Prod Detector
// @namespace    https://example.com/
// @version      1.4
// @description  Detect Salesforce production orgs and display a small floating warning banner and dotted border. Works for Setup, Classic, Lightning, and Builder. Skips sandbox/scratch orgs.
// @author       You
// @match        https://*.lightning.force.com/*
// @match        https://*.my.salesforce.com/*
// @match        https://*.builder.salesforce-experience.com/*
// @match        https://*.my.salesforce-setup.com/*
// @exclude      https://wdci.*
// @exclude      https://rio-edu-tso.*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  /*** CONFIG ***/
  const SALESFORCE_HOST_PATTERNS = [
    /\.salesforce-setup\.com$/i,
    /\.salesforce-experience\.com$/i,
    /\.lightning\.force\.com$/i,
    /\.force\.com$/i,
    /\.my\.salesforce\.com$/i,
    /\.visualforce\.com$/i,
    /\.experience\.force\.com$/i
  ];

  const SANDBOX_INDICATORS = [
    // sandbox
    /(^|\.)sandbox(\.|$)/i,
    /(^|\.)cs\d+(\.|$)/i,
    /--/, // scratch org or preview
    /(^|\.)scratch(\.|$)/i,
    /(^|\.)test(\.|$)/i
  ];

  const SETUP_PATH_PATTERNS = [/^\/lightning\/setup\//i, /^\/setup\//i, /^\/ui\/setup\//i];
  const BUILDER_PATH_PATTERNS = [/\/builder\//i, /experience-builder/i, /SitePreview/i, /\/cms\//i];

  /*** UTILS ***/
  const hostMatchesAny = (host, patterns) => patterns.some(r => r.test(host));
  const isSalesforceHost = host => hostMatchesAny(host, SALESFORCE_HOST_PATTERNS);
  const isSandboxLike = host => hostMatchesAny(host, SANDBOX_INDICATORS);

  const detectPageType = (path) => {
    if (SETUP_PATH_PATTERNS.some(r => r.test(path))) return 'setup';
    if (BUILDER_PATH_PATTERNS.some(r => r.test(path))) return 'builder';
    return 'normal';
  };

  const buildInfo = () => {
    const host = location.hostname;
    const path = location.pathname;
    const production = isSalesforceHost(host) && !isSandboxLike(host);
    const pageType = detectPageType(path);
    const isLightning = /lightning/i.test(location.href);
    const isClassic = !isLightning;
    return {
      host,
      path,
      isProductionHost: production,
      pageType,
      platform: isLightning ? 'Lightning' : 'Classic'
    };
  };

  const info = buildInfo();
  window.SF_INSTANCE_INFO = info;

  if (!info.isProductionHost) return; // Skip sandbox/scratch

  /*** INJECTION LOGIC ***/
  function injectWarningBanner(doc, contextLabel) {
    if (!doc || doc.getElementById('sf-prod-warning-banner')) return;

    const banner = doc.createElement('div');
    banner.id = 'sf-prod-warning-banner';
    banner.textContent = `⚠️ WARNING - PRODUCTION ORG ⚠️\n${info.host}`;
    Object.assign(banner.style, {
      position: 'fixed',
      top: '0px',
      left: '70%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(179, 0, 0, 0.85)',
      color: 'white',
      fontWeight: '700',
      fontSize: '14px',
      padding: '4px 10px',
      borderRadius: '8px',
      border: '1px solid red',
      zIndex: '999999',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      pointerEvents: 'none',
      whiteSpace: 'pre-line'
    });

    if (doc.body) {
      doc.body.appendChild(banner);
    } else {
      new MutationObserver((observer) => {
        if (doc.body) {
          doc.body.appendChild(banner);
          observer.disconnect();
        }
      }).observe(doc, { childList: true, subtree: true });
    }
  }

  // Inject in main document
  injectWarningBanner(document);

  // Watch for Setup iframe injection
  const observer = new MutationObserver(() => {
    const setupIframe = document.querySelector('iframe[id^="setupComponent"], iframe[name="setupComponent"]');
    if (setupIframe && setupIframe.contentDocument && !setupIframe._sfProdInjected) {
      setupIframe._sfProdInjected = true;
      try {
        injectWarningBanner(setupIframe.contentDocument, 'Setup IFrame');
      } catch (e) {
        console.warn('⚠️ Unable to inject into Setup iframe:', e);
      }
    }
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

  console.log(
    `%cSalesforce PROD Detector`,
    'background:#ffcc00;color:#000;padding:2px 6px;border-radius:3px;',
    info
  );
})();
