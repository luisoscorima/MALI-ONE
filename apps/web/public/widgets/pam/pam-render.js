/**
 * Renderiza layouts desktop y móvil del PAM desde PAM_DATA.
 */
(function (global) {
  'use strict';

  var BENEFITS_FOOTER_SVG = typeof getPamShapesSvg === 'function'
    ? getPamShapesSvg('pam-shapes-glow-footer')
    : '';

  function el(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (attrs[key] != null) node.setAttribute(key, attrs[key]);
      });
    }
    return node;
  }

  function textEl(tag, className, text) {
    var node = el(tag, className);
    node.textContent = text;
    return node;
  }

  function buildPriceBlock(billing) {
    var price = el('div', 'price');
    price.appendChild(textEl('span', 'currency', 'S/'));
    price.appendChild(textEl('span', 'value', billing.price));
    price.appendChild(textEl('span', 'duration', billing.duration));
    return price;
  }

  function buildPlanHeader(plan, billing) {
    var header = el('header', 'pricing-header');
    header.appendChild(textEl('h2', null, plan.name));
    header.appendChild(buildPriceBlock(billing));
    return header;
  }

  function buildCta(billing) {
    var footer = el('footer', 'pricing-footer');
    var link = el('a', 'select js-open-registro', {
      href: billing.checkout,
      target: '_blank',
      rel: 'noopener noreferrer',
      role: 'button'
    });
    link.textContent = 'Unirme ahora';
    footer.appendChild(link);
    return footer;
  }

  function buildDesktopFeatureList(values) {
    var list = el('ul', 'pricing-features');
    values.forEach(function (value) {
      var item = el('li');
      var em = el('em');
      em.textContent = value;
      item.appendChild(em);
      list.appendChild(item);
    });
    return list;
  }

  function buildDesktopPlanFace(plan, period, billing, isVisible) {
    var face = el('li', isVisible ? 'is-visible' : 'is-hidden', {
      'data-type': period
    });
    face.appendChild(buildPlanHeader(plan, billing));
    var body = el('div', 'pricing-body pam-rows-scroll');
    body.appendChild(buildDesktopFeatureList(billing.values));
    face.appendChild(body);
    face.appendChild(buildCta(billing));
    return face;
  }

  function buildMobileBenefitRows(benefits, values) {
    var list = el('ul', 'pam-plan-benefits');
    benefits.forEach(function (label, index) {
      var row = el('li', 'pam-plan-benefit-row pam-benefit-row', {
        'data-row': String(index)
      });
      row.appendChild(textEl('span', 'pam-plan-benefit-row__label', label));
      var valueWrap = el('span', 'pam-plan-benefit-row__value');
      var em = el('em');
      em.textContent = values[index] != null ? values[index] : '';
      valueWrap.appendChild(em);
      row.appendChild(valueWrap);
      list.appendChild(row);
    });
    return list;
  }

  function buildMobilePlanFace(plan, period, billing, benefits, isVisible) {
    var face = el('li', isVisible ? 'is-visible' : 'is-hidden', {
      'data-type': period
    });
    face.appendChild(buildPlanHeader(plan, billing));
    var body = el('div', 'pricing-body');
    body.appendChild(buildMobileBenefitRows(benefits, billing.values));
    face.appendChild(body);
    face.appendChild(buildCta(billing));
    return face;
  }

  function buildPricingWrapper(plan, benefits, isMobile) {
    var wrapper = el('ul', 'pricing-wrapper');
    wrapper.appendChild(
      isMobile
        ? buildMobilePlanFace(plan, 'monthly', plan.monthly, benefits, true)
        : buildDesktopPlanFace(plan, 'monthly', plan.monthly, true)
    );
    wrapper.appendChild(
      isMobile
        ? buildMobilePlanFace(plan, 'yearly', plan.yearly, benefits, false)
        : buildDesktopPlanFace(plan, 'yearly', plan.yearly, false)
    );
    return wrapper;
  }

  function renderDesktopLayout(data) {
    var layout = el('div', 'pam-layout-desktop pam-pricing-layout');

    var benefitsCard = el('aside', 'benefits-card', {
      'aria-label': 'Lista de beneficios'
    });
    var benefitsHeader = el('header', 'benefits-card__header');
    benefitsHeader.appendChild(textEl('h2', null, 'Beneficios'));
    benefitsHeader.appendChild(el('div', 'benefits-card__spacer', { 'aria-hidden': 'true' }));
    benefitsCard.appendChild(benefitsHeader);

    var benefitsScroll = el('div', 'pam-rows-scroll');
    var benefitsList = el('ul', 'benefits-list');
    data.benefits.forEach(function (benefit) {
      var item = el('li');
      item.textContent = benefit;
      benefitsList.appendChild(item);
    });
    benefitsScroll.appendChild(benefitsList);
    benefitsCard.appendChild(benefitsScroll);

    var benefitsFooter = el('footer', 'benefits-card__footer', { 'aria-hidden': 'true' });
    benefitsFooter.innerHTML = BENEFITS_FOOTER_SVG;
    benefitsCard.appendChild(benefitsFooter);

    layout.appendChild(benefitsCard);

    var pricingList = el('ul', 'pricing-list bounce-invert');
    data.plans.forEach(function (plan) {
      var item = el('li', plan.exclusive ? 'exclusive' : null);
      item.appendChild(buildPricingWrapper(plan, data.benefits, false));
      pricingList.appendChild(item);
    });
    layout.appendChild(pricingList);

    return layout;
  }

  function buildMobileBenefitsCard(data) {
    var item = el('li', 'pam-mobile-benefits-card pam-mobile-carousel__slide');
    var inner = el('article', 'pam-mobile-benefits-card__inner');
    var header = el('header', 'benefits-card__header');
    header.appendChild(textEl('h2', null, 'Beneficios'));
    inner.appendChild(header);

    var list = el('ul', 'pam-mobile-benefits-list');
    data.benefits.forEach(function (benefit) {
      var row = el('li');
      row.textContent = benefit;
      list.appendChild(row);
    });
    inner.appendChild(list);
    item.appendChild(inner);
    return item;
  }

  function renderMobileLayout(data) {
    var layout = el('div', 'pam-layout-mobile');
    var carousel = el('div', 'pam-mobile-carousel');
    var track = el('div', 'pam-mobile-carousel__track', {
      tabindex: '0',
      'aria-label': 'Beneficios y planes de membresía'
    });
    var plansList = el('ul', 'pam-mobile-plans');

    plansList.appendChild(buildMobileBenefitsCard(data));

    data.plans.forEach(function (plan) {
      var item = el('li', 'pam-mobile-plan-item pam-mobile-carousel__slide pam-mobile-plan-item--' + plan.color + (plan.exclusive ? ' exclusive' : ''));
      item.appendChild(buildPricingWrapper(plan, data.benefits, true));
      plansList.appendChild(item);
    });

    track.appendChild(plansList);
    carousel.appendChild(track);
    carousel.appendChild(el('div', 'pam-mobile-carousel__dots', {
      role: 'tablist',
      'aria-label': 'Seleccionar plan'
    }));
    layout.appendChild(carousel);

    return layout;
  }

  function renderNotes(data, container) {
    if (!container || !data) return;
    container.innerHTML = '';
    data.notes.forEach(function (note) {
      var p = el('p');
      p.textContent = note;
      container.appendChild(p);
    });
  }

  function mount(mountEl, data) {
    if (!mountEl || !data) return;
    mountEl.innerHTML = '';
    mountEl.className = 'pam-pricing-mount';
    mountEl.appendChild(renderDesktopLayout(data));
    mountEl.appendChild(renderMobileLayout(data));
  }

  function initMobileCarousel() {
    var track = document.querySelector('.pam-mobile-carousel__track');
    var dotsContainer = document.querySelector('.pam-mobile-carousel__dots');
    var slides = document.querySelectorAll('.pam-mobile-plans > li');
    if (!track || !dotsContainer || !slides.length) return;

    dotsContainer.innerHTML = '';
    var dotColors = ['lime', 'green', 'pink', 'blue'];

    slides.forEach(function (slide, index) {
      var label = 'Slide ' + (index + 1);
      var headerTitle = slide.querySelector('.pricing-header h2, .benefits-card__header h2');
      if (headerTitle) {
        label = headerTitle.textContent.trim();
      }
      var dot = el('button', 'pam-mobile-carousel__dot pam-mobile-carousel__dot--' + (dotColors[index] || 'green'), {
        type: 'button',
        role: 'tab',
        'aria-label': label,
        'aria-selected': index === 0 ? 'true' : 'false'
      });
      dot.addEventListener('click', function () {
        scrollToSlide(index);
      });
      dotsContainer.appendChild(dot);
    });

    var dots = dotsContainer.querySelectorAll('.pam-mobile-carousel__dot');
    var ticking = false;
    var activeIndex = 0;
    var autoTimer = null;
    var resumeTimer = null;
    var AUTO_INTERVAL_MS = 5000;
    var RESUME_DELAY_MS = 8000;

    function isMobileCarousel() {
      return !global.matchMedia('(min-width: 1024px)').matches;
    }

    function isAutoPlayAllowed() {
      return isMobileCarousel() &&
        !global.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        !document.hidden;
    }

    function clearAutoPlay() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    function clearResumeTimer() {
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    }

    function startAutoPlay() {
      clearAutoPlay();
      clearResumeTimer();
      if (!isAutoPlayAllowed()) return;

      autoTimer = setInterval(function () {
        if (!isAutoPlayAllowed()) {
          clearAutoPlay();
          return;
        }
        var nextIndex = (activeIndex + 1) % slides.length;
        scrollToSlide(nextIndex, true);
      }, AUTO_INTERVAL_MS);
    }

    function pauseAutoPlayTemporarily() {
      clearAutoPlay();
      clearResumeTimer();
      if (!isMobileCarousel()) return;
      resumeTimer = setTimeout(startAutoPlay, RESUME_DELAY_MS);
    }

    function scrollToSlide(index, fromAutoPlay) {
      var slide = slides[index];
      if (!slide) return;
      if (!fromAutoPlay) {
        pauseAutoPlayTemporarily();
      }
      var targetLeft = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
      track.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: global.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    }

    function updateState() {
      ticking = false;
      if (!isMobileCarousel()) {
        clearAutoPlay();
        clearResumeTimer();
        slides.forEach(function (slide) {
          slide.classList.remove('is-carousel-active');
        });
        return;
      }

      var trackCenter = track.scrollLeft + track.clientWidth / 2;
      var nextActive = 0;
      var minDistance = Infinity;

      slides.forEach(function (slide, index) {
        var slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        var distance = Math.abs(trackCenter - slideCenter);
        slide.classList.remove('is-carousel-active');
        if (distance < minDistance) {
          minDistance = distance;
          nextActive = index;
        }
      });

      activeIndex = nextActive;
      slides[activeIndex].classList.add('is-carousel-active');
      dots.forEach(function (dot, index) {
        var isActive = index === activeIndex;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    function scheduleUpdate() {
      if (ticking) return;
      ticking = true;
      global.requestAnimationFrame(updateState);
    }

    track.addEventListener('scroll', scheduleUpdate, { passive: true });
    track.addEventListener('touchstart', pauseAutoPlayTemporarily, { passive: true });
    track.addEventListener('pointerdown', pauseAutoPlayTemporarily);

    global.addEventListener('resize', function () {
      scheduleUpdate();
      if (isAutoPlayAllowed() && !autoTimer && !resumeTimer) {
        startAutoPlay();
      }
      if (!isMobileCarousel()) {
        clearAutoPlay();
        clearResumeTimer();
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        clearAutoPlay();
        return;
      }
      if (isAutoPlayAllowed()) {
        startAutoPlay();
      }
    });

    global.updatePamCarousel = function () {
      updateState();
      if (isAutoPlayAllowed() && !autoTimer && !resumeTimer) {
        startAutoPlay();
      }
    };

    updateState();
    startAutoPlay();
  }

  global.PamRender = {
    mount: mount,
    renderNotes: renderNotes,
    initMobileCarousel: initMobileCarousel
  };
})(typeof window !== 'undefined' ? window : this);
