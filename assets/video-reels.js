/* ALOFT CUSTOM: Video Reels — fullscreen modal playback, one at a time */

if (!customElements.get("m-video-reels")) {
  class MVideoReels extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.cards = this.querySelectorAll(".m-video-reel");
      this.enableSlider = this.dataset.enableSlider === "true";
      this.items = this.dataset.items || 4;

      // Modal elements
      const section = this.closest(".m-video-reels-section");
      this.modal = section && section.querySelector("[data-video-modal]");
      this.modalVideo = this.modal && this.modal.querySelector("[data-modal-video]");

      this.cards.forEach((card) => {
        const playBtn = card.querySelector(".m-video-reel__play");
        const video = card.querySelector(".m-video-reel__video");
        if (!playBtn) return;

        playBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.openModal(video);
        });
      });

      // Close modal events
      if (this.modal) {
        this.modal.querySelectorAll("[data-modal-close]").forEach((btn) => {
          btn.addEventListener("click", () => this.closeModal());
        });

        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && this.modal.classList.contains("is-open")) {
            this.closeModal();
          }
        });
      }

      if (this.enableSlider) {
        this.initSlider();
      }
    }

    openModal(sourceVideo) {
      if (!this.modal || !this.modalVideo) return;

      // Copy source from card video to modal video
      if (sourceVideo) {
        this.modalVideo.src = sourceVideo.querySelector("source")
          ? sourceVideo.querySelector("source").src
          : sourceVideo.src;
      }

      this.modal.classList.add("is-open");
      document.body.style.overflow = "hidden";

      this.modalVideo.muted = false;
      this.modalVideo.currentTime = 0;
      this.modalVideo.play().catch(() => {
        this.modalVideo.muted = true;
        this.modalVideo.play().then(() => {
          this.modalVideo.muted = false;
        });
      });
    }

    closeModal() {
      if (!this.modal || !this.modalVideo) return;

      this.modalVideo.pause();
      this.modalVideo.src = "";
      this.modal.classList.remove("is-open");
      document.body.style.overflow = "";
    }

    initSlider() {
      const container = this.querySelector(".swiper-container");
      if (!container || typeof MinimogLibs === "undefined") return;

      this.slider = new MinimogLibs.Swiper(container, {
        slidesPerView: "auto",
        spaceBetween: -15,
        loop: true,
        centeredSlides: true,
        breakpoints: {
          768: {
            slidesPerView: parseInt(this.items) >= 3 ? 3 : parseInt(this.items),
            spaceBetween: parseInt(this.dataset.gap) || 20,
            centeredSlides: false,
          },
          1280: {
            slidesPerView: parseInt(this.items),
            spaceBetween: parseInt(this.dataset.gap) || 20,
            centeredSlides: false,
          },
        },
      });
    }
  }

  customElements.define("m-video-reels", MVideoReels);
}
