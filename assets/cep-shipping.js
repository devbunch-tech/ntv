(function () {
  if (window.customElements && window.customElements.get('cep-shipping-calculator')) return;

  var STORAGE_KEY = 'ntv:lastCep';
  var BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var SHOP_CURRENCY = (window.Shopify && Shopify.currency && Shopify.currency.active) || 'BRL';

  function formatMoney(value) {
    var numeric = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numeric)) return '';
    if (SHOP_CURRENCY === 'BRL') return BRL.format(numeric);
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: SHOP_CURRENCY }).format(numeric);
    } catch (e) {
      return numeric.toFixed(2);
    }
  }

  function maskCep(value) {
    var digits = (value || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length > 5) return digits.slice(0, 5) + '-' + digits.slice(5);
    return digits;
  }

  function fetchAddress(cep) {
    return fetch('https://viacep.com.br/ws/' + cep + '/json/')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('viacep_http')); });
  }

  function fetchRates(address) {
    var params = new URLSearchParams();
    params.set('shipping_address[zip]', address.cep);
    params.set('shipping_address[country]', 'BR');
    if (address.uf) params.set('shipping_address[province]', address.uf);
    if (address.localidade) params.set('shipping_address[city]', address.localidade);

    var url = '/cart/shipping_rates.json?' + params.toString();
    return poll(url, 5, 700);
  }

  function poll(url, attemptsLeft, delay) {
    return fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 200) return res.json();
        if (res.status === 202 && attemptsLeft > 0) {
          return new Promise(function (resolve) { setTimeout(resolve, delay); })
            .then(function () { return poll(url, attemptsLeft - 1, delay); });
        }
        if (res.status === 422) return res.json().then(function (data) { return Promise.reject({ kind: 'invalid', data: data }); });
        return Promise.reject({ kind: 'http', status: res.status });
      });
  }

  function getRateName(rate) {
    if (rate.presentment_name) return rate.presentment_name;
    if (rate.name) return rate.name;
    if (rate.code) return rate.code;
    return 'Envio';
  }

  function getRateDays(rate) {
    var min = rate.min_delivery_date;
    var max = rate.max_delivery_date;
    if (!min && !max) return '';
    try {
      var d = new Date(max || min);
      var today = new Date();
      var diff = Math.round((d - today) / 86400000);
      if (diff <= 0) return '';
      return ' (até ' + diff + ' dia' + (diff > 1 ? 's' : '') + ' úteis)';
    } catch (e) {
      return '';
    }
  }

  function getRatePrice(rate) {
    if (rate.price != null) return parseFloat(rate.price);
    if (rate.checkout && rate.checkout.total_price != null) return parseFloat(rate.checkout.total_price) / 100;
    return null;
  }

  class CepShippingCalculator extends HTMLElement {
    constructor() {
      super();
      this.form = this.querySelector('[data-cep-form]');
      this.input = this.querySelector('[data-cep-input]');
      this.btn = this.querySelector('[data-cep-submit]');
      this.ratesList = this.querySelector('[data-cep-rates]');
      this.addressEl = this.querySelector('[data-cep-address]');
      this.errorEl = this.querySelector('[data-cep-error]');
      this.loadingEl = this.querySelector('[data-cep-loading]');

      this.errorInvalid = this.dataset.errorInvalid || 'CEP inválido.';
      this.errorNoRates = this.dataset.errorNoRates || 'Nenhuma opção de entrega encontrada.';
    }

    connectedCallback() {
      if (!this.form) return;
      this.form.addEventListener('submit', this.onSubmit.bind(this));
      this.input.addEventListener('input', this.onInput.bind(this));

      try {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          this.input.value = maskCep(saved);
        }
      } catch (e) {}
    }

    onInput(e) {
      var caretAtEnd = e.target.selectionStart === e.target.value.length;
      e.target.value = maskCep(e.target.value);
      if (caretAtEnd) e.target.setSelectionRange(e.target.value.length, e.target.value.length);
    }

    setState(state) {
      this.toggle(this.loadingEl, state === 'loading');
      if (state !== 'error') this.toggle(this.errorEl, false);
      if (state === 'loading' || state === 'error') {
        this.toggle(this.ratesList, false);
        this.toggle(this.addressEl, false);
      }
      if (this.btn) this.btn.disabled = state === 'loading';
    }

    toggle(el, show) {
      if (!el) return;
      if (show) el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    }

    showError(msg) {
      this.setState('error');
      if (this.errorEl) {
        this.errorEl.textContent = msg;
        this.toggle(this.errorEl, true);
      }
    }

    showAddress(addr) {
      if (!this.addressEl) return;
      var parts = [addr.localidade, addr.uf].filter(Boolean).join(' / ');
      var bairro = addr.bairro ? addr.bairro + ' — ' : '';
      this.addressEl.textContent = bairro + parts;
      this.toggle(this.addressEl, !!parts);
    }

    renderRates(rates) {
      if (!this.ratesList) return;
      this.ratesList.innerHTML = '';
      if (!rates || !rates.length) {
        this.showError(this.errorNoRates);
        return;
      }
      var frag = document.createDocumentFragment();
      rates.forEach(function (rate) {
        var li = document.createElement('li');
        li.className = 'm-product-cep__rate';
        var price = getRatePrice(rate);
        var priceText = price === 0 ? 'Grátis' : (price != null ? formatMoney(price) : '');
        li.innerHTML =
          '<span class="m-product-cep__rate-name">' + getRateName(rate) + getRateDays(rate) + '</span>' +
          '<strong class="m-product-cep__rate-price">' + priceText + '</strong>';
        frag.appendChild(li);
      });
      this.ratesList.appendChild(frag);
      this.toggle(this.ratesList, true);
    }

    onSubmit(e) {
      e.preventDefault();
      var self = this;
      var rawCep = (this.input.value || '').replace(/\D/g, '');
      if (rawCep.length !== 8) {
        this.showError(this.errorInvalid);
        return;
      }

      try { localStorage.setItem(STORAGE_KEY, rawCep); } catch (err) {}
      this.setState('loading');

      fetchAddress(rawCep)
        .then(function (address) {
          if (address.erro) return Promise.reject({ kind: 'viacep_invalid' });
          self.showAddress(address);
          return fetchRates({ cep: rawCep, uf: address.uf, localidade: address.localidade });
        })
        .then(function (data) {
          self.setState('idle');
          self.renderRates(data && data.shipping_rates ? data.shipping_rates : []);
        })
        .catch(function (err) {
          if (err && err.kind === 'viacep_invalid') {
            self.showError(self.errorInvalid);
          } else if (err && err.kind === 'invalid') {
            var msg = self.errorNoRates;
            if (err.data) {
              var first = Object.values(err.data)[0];
              if (Array.isArray(first) && first.length) msg = first[0];
            }
            self.showError(msg);
          } else {
            self.showError(self.errorNoRates);
          }
        });
    }
  }

  if (window.customElements) {
    window.customElements.define('cep-shipping-calculator', CepShippingCalculator);
  }
})();
