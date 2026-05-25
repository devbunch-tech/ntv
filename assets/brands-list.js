if (!customElements.get("m-brand-list")) {
  class MBrandList extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      const enableSlider = this.dataset.enableSlider === "true";
      if (!enableSlider) return;
      const wrapper = this.querySelector("[data-wrapper]");
      wrapper.classList.add("swiper-wrapper");
      this.initSlider();
    }

    initSlider() {
      const autoplay = this.dataset.enableAutoplay === "true";
      const autoplaySpeed = this.dataset.autoplaySpeed;
      const items = parseInt(this.dataset.items);
      const itemsTablet = parseInt(this.dataset.itemsTablet) || (items > 3 ? 3 : items);
      const itemsMobile = parseInt(this.dataset.itemsMobile) || 2;
      const mobileOnly = this.dataset.mobileOnlySlider === "true";
      const tabletItems = mobileOnly ? items : itemsTablet;
      const slideContainer = this.querySelector(".swiper-container");
      if (slideContainer) {
        this.slider = new MinimogLibs.Swiper(slideContainer, {
          slidesPerView: itemsMobile,
          slidesPerGroup: 1,
          autoplay: autoplay
            ? {
                delay: parseInt(autoplaySpeed) * 1000,
                disableOnInteraction: false,
              }
            : false,
          loop: true,
          navigation: {
            nextEl: this.querySelector(".swiper-button-next"),
            prevEl: this.querySelector(".swiper-button-prev"),
          },
          pagination: {
            el: this.querySelector(".swiper-pagination"),
            clickable: true,
          },
          breakpoints: {
            768: {
              slidesPerView: tabletItems,
            },
            1024: {
              slidesPerView: items,
            },
          },
        });

        if (mobileOnly && this.slider && this.slider.autoplay) {
          const updateAutoplay = () => {
            if (window.innerWidth >= 768) {
              this.slider.autoplay.stop && this.slider.autoplay.stop();
            } else if (autoplay) {
              this.slider.autoplay.start && this.slider.autoplay.start();
            }
          };
          updateAutoplay();
          window.addEventListener("resize", updateAutoplay);
        }
      }
    }
  }

  customElements.define("m-brand-list", MBrandList);
}
