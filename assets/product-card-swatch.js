/**
 * Product card swatch: seleção de variantes, preço e imagem no card.
 *
 * Modificações em relação ao tema base:
 * - keepFeaturedImage (data-keep-featured-image="true"): mantém a imagem principal fixa;
 *   não atualiza opções/imagem ao carregar nem ao trocar variante (útil em listagens).
 * - Sale badge: removido deste componente (seletor saleBadge e updateSaleBadge);
 *   selo de promoção não é mais gerenciado aqui.
 * - Desconto Pix: em updatePrice(), exibe preço com pix_discount_percentage e usa
 *   spaceBeforePix só quando não há preço comparativo, para não duplicar o gap do flex.
 */
if (!customElements.get("pcard-swatch")) {
  class ProductCardColorSwatch extends HTMLElement {
    constructor() {
      super();

      this.selectors = {
        container: "[data-pcard-variant-picker]",
        optionNodes: [".m-product-option--node__label"],
        featuredImage: ".m-product-card__main-image",
        pcard: ".m-product-card",
        variantDropdown: ".m-product-option--dropdown-select",
        priceWrapper: ".m-price",
        salePrice: ".m-price-item--sale",
        compareAtPrice: [".m-price-item--regular"],
        unitPrice: ".m-price__unit",
        soldOutBadge: ".m-product-tag--soldout",
      };
      this.container = this.closest(this.selectors.container);
      this.pcard = this.closest(this.selectors.pcard);
      this.variantIdNode = this.pcard && this.pcard.querySelector('[name="id"]');
      this.featuredImage = this.pcard && this.pcard.querySelector(this.selectors.featuredImage);
      this.keepFeaturedImage = this.dataset.keepFeaturedImage === "true";
      this.domNodes = queryDomNodes(this.selectors, this.pcard);
      this.initializeData();
    }

    async initializeData() {
      this.variantData = this.fetchVariantData();
      this.productHandle = this.container.dataset.productHandle;
      this.productData = await this.fetchProductJson();
      this.activeOptionNodeByPosition = {};
      this.hideUnavailableProductOptions = MinimogSettings.hide_unavailable_product_options;

      const { variantIdNode, productData, productData: { variants } = {} } = this;

      if (productData) {
        let currentVariantId = variantIdNode && Number(variantIdNode.value);
        if (!currentVariantId) {
          currentVariantId =
            productData.selected_or_first_available_variant && productData.selected_or_first_available_variant.id;
        }
        const currentVariant = variants.find((v) => v.id === currentVariantId) || variants[0];
        this.productData.initialVariant = currentVariant;
        if (!this.productData.selected_variant && variantIdNode && variantIdNode.dataset.selectedVariant) {
          this.productData.selected_variant = variants.find(
            (v) => v.id === Number(variantIdNode.dataset.selectedVariant)
          );
        }

        if (!this.keepFeaturedImage) {
          this.updateOptionsByVariant(currentVariant);
          this.updateProductImage(currentVariant);
          window.MinimogEvents.subscribe("m:image-loaded", () => {
            this.updateProductImage(currentVariant);
          });
        }
      }

      if (this.domNodes.optionNodes) {
        this.domNodes.optionNodes.forEach((node) =>
          node.addEventListener("click", this.handleVariantSelection.bind(this))
        );
      }
      if (this.domNodes.variantDropdown) {
        this.domNodes.variantDropdown.addEventListener("change", this.handleVariantSelection.bind(this));
      }
    }

    fetchVariantData() {
      if (!this.variantData) {
        var jsonElement = this.container && this.container.querySelector('[type="application/json"]');
        this.variantData = JSON.parse(jsonElement ? jsonElement.textContent : "{}");
      }
      return this.variantData;
    }

    fetchProductJson() {
      var productUrl = `${window.MinimogSettings.routes.root}/products/${this.productHandle}.js`;
      productUrl = productUrl.replace("//", "/");
      return fetch(productUrl).then(function (response) {
        return response.json();
      });
    }

    toggleOptionNodeActive(optNode, active) {
      if (!optNode) return;
      if (active) {
        const { optionPosition, value: optionValue } = optNode.dataset;
        this.activeOptionNodeByPosition[optionPosition] = optNode;

        switch (optNode.tagName) {
          case "INPUT":
            optNode.checked = true;
            optNode.dataset.selected = "true";
            break;
          case "OPTION":
            optNode.dataset.selected = "true";
            const select = optNode.closest("select");
            if (select) select.value = optNode.value;
            break;
          case "LABEL":
            optNode.dataset.selected = "true";
            break;
          default:
            if (!optNode.classList.contains("m-product-quickview-button")) {
              console.warn("Unable to activate option node", optNode);
            }
            break;
        }

        this.updateSoldOutBadge(this.getVariantsByOptionValue(optionValue));
      } else {
        if (!["default", "image", "color"].includes(optNode.dataset.optionType)) {
          optNode.style.border = "";
        }
        optNode.checked = false;
        delete optNode.dataset.selected;
        const select = optNode.closest("select");
        if (select) select.value = "";
      }
    }

    updateOptionsByVariant(variant) {
      Object.values(this.activeOptionNodeByPosition).forEach((optNode) => this.toggleOptionNodeActive(optNode, false));

      const { optionNodes } = this.domNodes;
      const { options = [] } = variant || {};
      options.forEach((option, index) => {
        const optPosition = index + 1;
        optionNodes.forEach((optNode) => {
          const _optPosition = Number(optNode.dataset.optionPosition);
          const _optValue = optNode.dataset.value;

          if (_optPosition === optPosition && option === _optValue) {
            this.toggleOptionNodeActive(optNode, true);
          }
        });
      });
      this.updatePrice(variant);
    }

    getVariantFromActiveOptions = () => {
      const {
        productData,
        productData: { initialVariant },
        activeOptionNodeByPosition,
      } = this;
      const initialVariantOptions = {
        1: initialVariant.option1,
        2: initialVariant.option2,
        3: initialVariant.option3,
      };

      Object.values(activeOptionNodeByPosition).forEach((optNode) => {
        const { optionPosition, value } = optNode.dataset;
        initialVariantOptions[optionPosition] = value;
      });

      var options = Object.values(initialVariantOptions).filter(Boolean);
      var variant = getVariantFromOptionArray(productData, options);
      if (!variant && this.hideUnavailableProductOptions) {
        options.pop();
        variant = getVariantFromOptionArray(productData, options);
        if (!variant) {
          options.pop();
          variant = getVariantFromOptionArray(productData, options);
        }
      }
      this.currentVariant = variant;
      return variant;
    };

    handleVariantSelection(e) {
      var target = e.target;
      var newVariant;

      if (target.classList.contains("combined-variant")) {
        const variantId = Number(e.target.value);
        newVariant =
          this.productData && this.productData.variants && this.productData.variants.find((v) => v.id === variantId);
      } else {
        if (target.tagName === "SELECT") {
          target = target.querySelectorAll("option")[target.selectedIndex];
        }
        if (!target.classList.contains("m-product-option--node__label")) {
          target = target.closest(".m-product-option--node__label");
          if (!target) console.error("Unable to find option node!");
        }
        const { optionPosition, value } = target.dataset;

        const currActiveOptNode = this.activeOptionNodeByPosition[optionPosition];
        this.toggleOptionNodeActive(currActiveOptNode, false);
        this.toggleOptionNodeActive(target, true);
        const pos = Number(optionPosition) - 1;
        newVariant = this.getVariantFromActiveOptions();

        // Fallback: se não encontrou, ou encontrou variante com a cor ERRADA
        // (hideUnavailableOptions pode fazer pop() na cor e retornar variante errada)
        if (!newVariant || newVariant.options[pos] !== value) {
          const variants = Array.isArray(this.variantData) ? this.variantData : [];
          newVariant = variants.find((v) => v.options[pos] === value && v.available)
            || variants.find((v) => v.options[pos] === value);
        }
      }

      if (!newVariant) return;

      const { variantIdNode } = this;
      if (variantIdNode) {
        variantIdNode.setAttribute("value", String(newVariant.id));
        variantIdNode.value = String(newVariant.id);
      }

      this.updateBySelectedVariant(newVariant);
    }

    updateBySelectedVariant(variant) {
      if (variant) {
        this.updateProductImage(variant);
        this.updatePrice(variant);
      }
    }

    updateProductCardSoldOutBadge(variant) {
      if (this.domNodes.soldOutBadge) {
        this.domNodes.soldOutBadge.style.display = variant.available ? "none" : "flex";
      }
    }

    updateSoldOutBadge(variants) {
      const soldOut = !variants.some((variant) => variant.available);
      if (this.domNodes.soldOutBadge) {
        this.domNodes.soldOutBadge.style.display = soldOut ? "flex" : "none";
      }
    }

    getVariantsByOptionValue = (value) => {
      const { productData: { variants } = {} } = this;
      return variants.filter((variant) => variant.options.includes(value));
    };

    updateProductImage(variant) {
      const { featuredImage, pcard, productData } = this;
      const featImg = variant && variant.featured_image;
      const src = featImg && featImg.src;

      // Update main image
      const mainImg = featuredImage && featuredImage.querySelector("img");
      if (mainImg && src) {
        mainImg.src = `${src}&width=533`;
        mainImg.removeAttribute("srcset");
      }

      // Update hover image with the next product image after the variant's featured image
      const hoverDiv = pcard && pcard.querySelector(".m-product-card__hover-image");
      if (hoverDiv && featImg && productData && productData.images) {
        const hoverImg = hoverDiv.querySelector("img");
        if (hoverImg) {
          const pos = featImg.position; // 1-based
          const images = productData.images;
          if (pos > 0 && pos < images.length) {
            const sep = images[pos].includes("?") ? "&" : "?";
            hoverImg.src = `${images[pos]}${sep}width=533`;
            hoverImg.removeAttribute("srcset");
          }
        }
      }
    }

    updatePrice(variant) {
      if (MinimogSettings.pcard_show_lowest_prices) return;
      const classes = {
        onSale: "m-price--on-sale",
        soldOut: "m-price--sold-out",
      };

      const moneyFormat = window.MinimogSettings.money_format;

      const { priceWrapper, salePrice, unitPrice, compareAtPrice } = this.domNodes;
      const { compare_at_price, price, unit_price_measurement } = variant;
      const onSale = compare_at_price && compare_at_price > price;
      const soldOut = !variant.available;

      if (onSale) {
        priceWrapper && priceWrapper.classList.add(classes.onSale);
      } else {
        priceWrapper && priceWrapper.classList.remove(classes.onSale);
      }

      if (soldOut) {
        priceWrapper && priceWrapper.classList.add(classes.soldOut);
      } else {
        priceWrapper && priceWrapper.classList.remove(classes.soldOut);
      }

      priceWrapper && priceWrapper.classList.remove("visibility-hidden");
      const pixPct = (window.MinimogSettings && window.MinimogSettings.pix_discount_percentage) || 0;
      const displayPrice = pixPct > 0 ? Math.round((price * (100 - pixPct)) / 100) : price;
      // Só adiciona espaço antes do "no Pix" quando não há preço comparativo (bloco regular visível).
      // Com preço comparativo o flex já dá o gap; o espaço extra deixaria preço e "no Pix" muito afastados.
      const spaceBeforePix = pixPct > 0 && !onSale ? '\u00A0' : '';
      if (salePrice) salePrice.innerHTML = formatMoney(displayPrice, moneyFormat) + spaceBeforePix;

      if (compareAtPrice && compareAtPrice.length && compare_at_price > price) {
        compareAtPrice.forEach((item) => (item.innerHTML = formatMoney(compare_at_price, moneyFormat)));
      } else {
        compareAtPrice.forEach((item) => (item.innerHTML = formatMoney(displayPrice, moneyFormat) + spaceBeforePix));
      }

      if (unit_price_measurement && unitPrice && this.currentVariant) {
        unitPrice.classList.remove("f-hidden");
        const unitPriceContent = `<span>${formatMoney(
          this.currentVariant.unit_price,
          moneyFormat
        )}</span>/<span data-unit-price-base-unit>${this.getBaseUnit()}</span>`;
        unitPrice.innerHTML = unitPriceContent;
      } else {
        unitPrice && unitPrice.classList.add("f-hidden");
      }
    }

    getBaseUnit = () => {
      return this.currentVariant.unit_price_measurement.reference_value === 1
        ? this.currentVariant.unit_price_measurement.reference_unit
        : this.currentVariant.unit_price_measurement.reference_value +
        this.currentVariant.unit_price_measurement.reference_unit;
    };
  }

  customElements.define("pcard-swatch", ProductCardColorSwatch);
}