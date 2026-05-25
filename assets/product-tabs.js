/**
 * Abas de produto (m-product-tabs): sliders, load more e botão no header.
 *
 * Modificações em relação ao tema base:
 * - initHeaderButton(): inicializa o botão no header (data-header-button-wrapper).
 *   Se buttonType === "load", delega o clique em [data-load-more-product] para
 *   handleLoadMore(activeTab), usando o activeTabId guardado no wrapper.
 * - updateHeaderButton(tabId): mantém o botão do header em sync com a aba ativa.
 *   Tipo "link" → atualiza o href com a URL da coleção da aba; tipo "load" →
 *   grava activeTabId e url no wrapper para o load more. Chamado ao trocar de aba
 *   e na inicialização (primeira aba).
 * - Shopify.designMode: ao selecionar um bloco .m-tab-content no editor, define
 *   a aba ativa (setActiveTab) para o editor refletir a aba selecionada.
 */
if (!customElements.get("m-product-tabs")) {
  class MProductTabs extends HTMLElement {
    constructor() {
      super();
      this.selectors = {
        loadMoreBtn: "[data-load-more-product]",
        productsContainer: "[data-products-container]",
        tabContent: [".m-tab-content"],
      };
      this.tabSliders = [];
      this.sliderEnabled = this.dataset.enableSlider === "true";
      this.mobileSliderDisable = this.dataset.mobileDisableSlider === "true";
      this.buttonType = this.dataset.buttonType;
      this.domNodes = queryDomNodes(this.selectors, this);
      this.showPagination = this.dataset.showPagination === "true";
      this.showNavigation = this.dataset.showNavigation === "true";
      this.items = this.dataset.items;
    }

    connectedCallback() {
      this.init();
    }

    init() {
      if (this.sliderEnabled) {
        for (let block of this.domNodes.tabContent) {
          this.initSliderByScreenSize(block);
          document.addEventListener("matchMobile", () => {
            this.initSliderByScreenSize(block);
          });
          document.addEventListener("unmatchMobile", () => {
            this.initSliderByScreenSize(block);
          });
        }
      }
      if (!this.sliderEnabled && this.buttonType === "load") {
        this.canLoad = true;
        this.currentPage = 1;

        for (let block of this.domNodes.tabContent) {
          this.initLoadMore(block);
        }
      }
      if (MinimogTheme.config.mqlMobile && this.mobileSliderDisable && this.buttonType === "load") {
        this.canLoad = true;
        this.currentPage = 1;
        for (let block of this.domNodes.tabContent) {
          this.initLoadMore(block);
        }
      }
      document.addEventListener("matchMobile", () => {
        if (MinimogTheme.config.mqlMobile && this.mobileSliderDisable && this.buttonType === "load") {
          this.canLoad = true;
          this.currentPage = 1;
          for (let block of this.domNodes.tabContent) {
            this.initLoadMore(block);
          }
        }
      });
      this.initTabs();
      this.initMobileSelect();
      this.initHeaderButton();

      if (Shopify.designMode) {
        document.addEventListener("shopify:block:select", (event) => {
          const blockSelectedIsTab = event.target.classList.contains("m-tab-content");
          if (!blockSelectedIsTab) return;
          const dataIndex = event.target && event.target.dataset.index;
          this.tabs.setActiveTab(dataIndex);
        });
      }
    }

    initHeaderButton() {
      const headerButtonWrapper = this.querySelector("[data-header-button-wrapper]");
      if (!headerButtonWrapper) return;
      
      if (this.buttonType === "load") {
        addEventDelegate({
          context: headerButtonWrapper,
          selector: "[data-load-more-product]",
          handler: (e) => {
            e.preventDefault();
            const activeTabId = headerButtonWrapper.dataset.activeTabId;
            if (activeTabId) {
              const activeTab = this.querySelector("#" + activeTabId);
              if (activeTab) {
                this.handleLoadMore(activeTab);
              }
            }
          },
        });
      }
    }

    initTabs() {
      this.tabs = new MinimogTheme.Tabs(this, (target) => {
        const tabId = target.getAttribute("href");
        const slider = this.querySelector(tabId + " .swiper-container");
        const controlsContainer = this.querySelector(tabId + " .m-slider-controls");
        // trigger update slider
        slider && slider.swiper && slider.swiper.update();
        const firstItem = slider && (slider.querySelector(".m-image") || slider.querySelector(".m-placeholder-svg"));
        if (firstItem && controlsContainer) {
          const itemHeight = firstItem.clientHeight;
          controlsContainer.style.setProperty("--offset-top", parseInt(itemHeight) / 2 + "px");
        }
        
        // Update header button if it exists
        this.updateHeaderButton(tabId);

        // ALOFT CUSTOM: Bind header nav arrows to active tab slider
        this.bindHeaderNav(slider);
      });

      // Initialize header button with first tab
      if (this.domNodes.tabContent.length > 0) {
        const firstTab = this.domNodes.tabContent[0];
        const firstTabId = firstTab.getAttribute("id");
        this.updateHeaderButton("#" + firstTabId);
        // Bind header nav to first tab slider (wait for swiper init)
        const firstSlider = firstTab.querySelector(".swiper-container");
        const tryBind = () => {
          if (firstSlider && firstSlider.swiper) {
            this.bindHeaderNav(firstSlider);
          } else {
            setTimeout(tryBind, 100);
          }
        };
        setTimeout(tryBind, 200);
      }
    }

    // ALOFT CUSTOM: Bind header nav arrows to the active tab's swiper
    bindHeaderNav(sliderContainer) {
      const headerNav = this.querySelector(".m-section__header-nav .m-slider-controls");
      if (!headerNav) return;
      const prevBtn = headerNav.querySelector(".m-slider-controls__button-prev");
      const nextBtn = headerNav.querySelector(".m-slider-controls__button-next");
      if (!prevBtn || !nextBtn) return;
      // Clone to remove old listeners
      const newPrev = prevBtn.cloneNode(true);
      const newNext = nextBtn.cloneNode(true);
      prevBtn.parentNode.replaceChild(newPrev, prevBtn);
      nextBtn.parentNode.replaceChild(newNext, nextBtn);
      if (sliderContainer && sliderContainer.swiper) {
        newPrev.addEventListener("click", () => sliderContainer.swiper.slidePrev());
        newNext.addEventListener("click", () => sliderContainer.swiper.slideNext());
      }
    }

    updateHeaderButton(tabId) {
      const headerButtonWrapper = this.querySelector("[data-header-button-wrapper]");
      if (!headerButtonWrapper) return;
      
      const activeTab = this.querySelector(tabId);
      if (!activeTab) return;
      
      const headerButton = headerButtonWrapper.querySelector("[data-header-button]");
      if (!headerButton) return;
      
      const collectionUrl = activeTab.dataset.url;
      
      if (this.buttonType === "link") {
        // Update link href
        headerButton.href = collectionUrl;
      } else if (this.buttonType === "load") {
        // Store reference to active tab
        headerButtonWrapper.dataset.activeTabId = activeTab.id;
        headerButtonWrapper.dataset.url = collectionUrl;
      }
    }

    initSliderByScreenSize(sliderContainer) {
      const mobileDisableSlider = this.dataset.mobileDisableSlider === "true";
      const slider = sliderContainer.querySelector(".m-mixed-layout__wrapper");
      const controlsContainer = sliderContainer.querySelector(".m-slider-controls");

      if (MinimogTheme.config.mqlMobile && mobileDisableSlider) {
        controlsContainer && controlsContainer.classList.add("m:hidden");
        slider.classList.remove("swiper-container");
        if (slider.swiper) slider.swiper.destroy(false, true);
      } else {
        controlsContainer && controlsContainer.classList.remove("m:hidden");
        setTimeout(() => {
          this.initSlider(sliderContainer);
        });
      }
    }

    initSlider(sliderContainer) {
      const layoutWrapper = sliderContainer.querySelector(".m-product-list");
      const swiper = sliderContainer && sliderContainer.querySelector(".m-mixed-layout__wrapper");
      const controlsContainer = sliderContainer.querySelector(".m-slider-controls");
      const prevButton = controlsContainer && controlsContainer.querySelector(".m-slider-controls__button-prev");
      const nextButton = controlsContainer && controlsContainer.querySelector(".m-slider-controls__button-next");
      const slideItemsLength =
        sliderContainer &&
        sliderContainer.querySelector(".swiper-wrapper") &&
        sliderContainer.querySelector(".swiper-wrapper").childElementCount;
      if (parseInt(this.items) >= slideItemsLength) {
        controlsContainer && controlsContainer.classList.add("m:hidden");
        layoutWrapper.classList.add("m-mixed-layout--mobile-grid");
        return;
      }

      swiper && swiper.classList.add("swiper-container");

      let slider = new MinimogLibs.Swiper(swiper, {
        slidesPerView: "auto",
        showPagination: this.showPagination,
        showNavigation: this.showNavigation,
        loop: this.enableFlashsale ? false : true,
        pagination: this.showPagination
          ? {
              el: sliderContainer.querySelector(".swiper-pagination"),
              clickable: true,
            }
          : false,
        breakpoints: {
          768: {
            slidesPerView: parseInt(this.items) >= 3 ? 3 : parseInt(this.items),
          },
          992: {
            slidesPerView: parseInt(this.items) >= 4 ? 4 : parseInt(this.items),
          },
          1280: {
            slidesPerView: parseInt(this.items),
          },
        },
        threshold: 2,
        on: {
          init: function () {
            setTimeout(() => {
              // Calculate controls position
              const firstItem =
                sliderContainer.querySelector(".m-image") || sliderContainer.querySelector(".m-placeholder-svg");
              if (firstItem && controlsContainer) {
                const itemHeight = firstItem.clientHeight;
                controlsContainer.style.setProperty("--offset-top", parseInt(itemHeight) / 2 + "px");

                prevButton.classList.remove("m:hidden");
                nextButton.classList.remove("m:hidden");
              }
            }, 200);
          },
          breakpoint: (swiper, breakpointParams) => {
            if (controlsContainer) {
              const { slidesPerView } = breakpointParams;
              if (slideItemsLength > slidesPerView) {
                controlsContainer.classList.remove("m:hidden");
                swiper.allowTouchMove = true;
              } else {
                controlsContainer.classList.add("m:hidden");
                swiper.allowTouchMove = false;
              }
            }
          },
        },
      });

      if (slider && this.showNavigation) {
        prevButton && prevButton.addEventListener("click", () => slider.slidePrev());
        nextButton && nextButton.addEventListener("click", () => slider.slideNext());
      }
    }

    initMobileSelect() {
      this.select = this.querySelector("[data-tab-select]");
      this.select.addEventListener("change", () => {
        this.tabs.setActiveTab(parseInt(this.select.value));
        const slider = this.tabs && this.tabs.currentTab && this.tabs.currentTab.querySelector(".swiper-container");
        const controlsContainer =
          this.tabs && this.tabs.currentTab && this.tabs.currentTab.querySelector(".m-slider-controls");
        const prevButton = controlsContainer && controlsContainer.querySelector(".m-slider-controls__button-prev");
        const nextButton = controlsContainer && controlsContainer.querySelector(".m-slider-controls__button-next");
        slider && slider.swiper && slider.swiper.update();
        const firstItem = slider && slider.querySelector(".m-image");
        if (firstItem && controlsContainer) {
          const itemHeight = firstItem.clientHeight;
          controlsContainer.style.setProperty("--offset-top", parseInt(itemHeight) / 2 + "px");

          prevButton.classList.remove("m:hidden");
          nextButton.classList.remove("m:hidden");
        }
      });
    }

    initLoadMore(wrapper) {
      addEventDelegate({
        context: wrapper,
        selector: this.selectors.loadMoreBtn,
        handler: (e) => {
          e.preventDefault();
          this.handleLoadMore(wrapper);
        },
      });
    }

    handleLoadMore(wrapper) {
      const loadBtn = wrapper.querySelector(this.selectors.loadMoreBtn);
      const productsContainer = wrapper.querySelector(this.selectors.productsContainer);

      let currentPage = wrapper.dataset.page;
      currentPage = parseInt(currentPage);
      const totalPages = wrapper.dataset.totalPages;
      this.toggleLoading(loadBtn, true);

      const url = wrapper.dataset.url;
      const dataUrl = `${url}?page=${currentPage + 1}&section_id=${this.id}`;
      fetchCache(dataUrl).then((html) => {
        currentPage++;
        wrapper.dataset.page = currentPage;
        this.toggleLoading(loadBtn, false);
        const dom = generateDomFromString(html);
        const tabId = wrapper.getAttribute("id");
        const products = dom.querySelector(`#${tabId} ${this.selectors.productsContainer}`);

        if (products) {
          Array.from(products.childNodes).forEach((product) => productsContainer.appendChild(product));
        }

        if (currentPage >= parseInt(totalPages)) loadBtn && loadBtn.remove();
      });

      // Remove button focus
      loadBtn.blur();
    }

    toggleLoading(loadBtn, status) {
      if (!loadBtn) return;
      if (status) {
        loadBtn.classList.add("m-spinner-loading");
      } else {
        loadBtn.classList.remove("m-spinner-loading");
      }
    }
  }
  customElements.define("m-product-tabs", MProductTabs);
}
