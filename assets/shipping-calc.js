(function () {
  if (window.__mShippingCalcInit) return;
  window.__mShippingCalcInit = true;

  function formatMoneyCents(cents) {
    if (window.Shopify && typeof window.Shopify.formatMoney === "function") {
      try {
        return window.Shopify.formatMoney(cents);
      } catch (e) {}
    }
    const value = (cents / 100).toFixed(2).replace(".", ",");
    return "R$ " + value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function maskCep(value) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length > 5) return digits.slice(0, 5) + "-" + digits.slice(5);
    return digits;
  }

  function setResult(resultEl, html, type) {
    resultEl.innerHTML = html;
    resultEl.dataset.state = type || "info";
  }

  async function fetchViaCep(cep) {
    const r = await fetch("https://viacep.com.br/ws/" + cep + "/json/");
    if (!r.ok) throw new Error("via-cep-http");
    return r.json();
  }

  async function fetchShopifyRates(cep, productSection) {
    if (!productSection) return null;
    const variantInput = productSection.querySelector('[name="id"]');
    if (!variantInput || !variantInput.value) return null;

    const params = new URLSearchParams({
      "shipping_address[zip]": cep,
      "shipping_address[country]": "BR",
    });

    try {
      const r = await fetch("/cart/shipping_rates.json?" + params.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) return null;
      const data = await r.json();
      if (data && Array.isArray(data.shipping_rates) && data.shipping_rates.length > 0) {
        return data.shipping_rates;
      }
    } catch (e) {}
    return null;
  }

  function renderRates(rates) {
    if (!rates || rates.length === 0) return "";
    return (
      '<ul class="m-product-shipping-calc__rates">' +
      rates
        .map(function (rate) {
          const price = parseFloat(rate.price) * 100;
          const days = rate.delivery_days_count != null ? rate.delivery_days_count : null;
          return (
            '<li class="m-product-shipping-calc__rate">' +
            '<span class="m-product-shipping-calc__rate-name">' +
            (rate.name || rate.presentment_name || "") +
            "</span>" +
            (days != null
              ? '<span class="m-product-shipping-calc__rate-days">' + days + " dia(s)</span>"
              : "") +
            '<span class="m-product-shipping-calc__rate-price">' +
            formatMoneyCents(price) +
            "</span>" +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  document.addEventListener("input", function (e) {
    const input = e.target.closest("[data-cep-input]");
    if (!input) return;
    const masked = maskCep(input.value);
    if (masked !== input.value) input.value = masked;
  });

  document.addEventListener("submit", async function (e) {
    const form = e.target.closest("[data-shipping-calc]");
    if (!form) return;
    e.preventDefault();

    const input = form.querySelector("[data-cep-input]");
    const button = form.querySelector("[data-cep-button]");
    const container = form.closest(".m-product-shipping-calc");
    const result = container && container.querySelector("[data-cep-result]");
    if (!input || !button || !result) return;

    const cep = (input.value || "").replace(/\D/g, "");
    if (cep.length !== 8) {
      setResult(
        result,
        '<p class="m-product-shipping-calc__error">CEP inválido. Use o formato 00000-000.</p>',
        "error"
      );
      input.focus();
      return;
    }

    const originalLabel = button.dataset.originalLabel || button.textContent;
    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = "<span>Calculando...</span>";

    try {
      const address = await fetchViaCep(cep);
      if (!address || address.erro) {
        setResult(
          result,
          '<p class="m-product-shipping-calc__error">CEP não encontrado.</p>',
          "error"
        );
        return;
      }

      const addressLine = [address.logradouro, address.bairro, address.localidade + " - " + address.uf]
        .filter(Boolean)
        .join(", ");

      let html =
        '<div class="m-product-shipping-calc__address">' +
        '<strong>Entrega para:</strong> ' +
        addressLine +
        "</div>";

      const productSection = form.closest('[data-section-type="product"], form[action*="/cart/add"]')
        ? form.closest('[data-section-type="product"]')
        : document.querySelector('[data-section-type="product"]');

      const rates = await fetchShopifyRates(cep, productSection);
      if (rates) {
        html += renderRates(rates);
      } else {
        html +=
          '<p class="m-product-shipping-calc__hint">Adicione o produto ao carrinho para ver as opções de envio.</p>';
      }

      setResult(result, html, "success");
    } catch (err) {
      setResult(
        result,
        '<p class="m-product-shipping-calc__error">Não foi possível consultar o CEP no momento. Tente novamente.</p>',
        "error"
      );
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.innerHTML = "<span>" + originalLabel + '</span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
    }
  });
})();
