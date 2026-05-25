class MFreeShippingProgress extends HTMLElement {
  constructor() {
    super();
    this.progressBar = this.querySelector('.m-free-shipping-progress__bar-fill');
    this.messageElement = this.querySelector('.m-free-shipping-progress__message');
    this.lockIcon = this.querySelector('.m-free-shipping-progress__lock-icon');
    this.cartTotal = parseFloat(this.dataset.cartTotal) || 0;
    this.threshold = parseFloat(this.dataset.threshold) || 350;
    this.barStyle = this.dataset.style || 'default';
    this.isUpdating = false;

    this.init();
  }

  init() {
    this.updateProgress();
    this.listenForCartUpdates();
    this.observeCartChanges();
  }

  updateProgress() {
    const progressPercentage = Math.min((this.cartTotal / this.threshold) * 100, 100);
    const remainingAmount = Math.max(this.threshold - this.cartTotal, 0);
    const isFreeShipping = this.cartTotal >= this.threshold;

    // Atualizar a barra de progresso
    if (this.progressBar) {
      this.progressBar.style.setProperty('--progress-percentage', `${progressPercentage}%`);
    }

    // Atualizar a mensagem apenas se mudou
    if (this.messageElement) {
      const newMessage = isFreeShipping
        ? this.getLocalizedMessage('success')
        : this.getLocalizedMessage('remaining', remainingAmount);

      const currentMessage = this.messageElement.textContent.trim();

      // Só atualiza se a mensagem realmente mudou
      if (currentMessage !== newMessage) {
        // Remover <br> se o estilo for inline
        let processedMessage = newMessage;
        if (this.barStyle === 'inline') {
          processedMessage = newMessage.replace(/<br\s*\/?>/gi, ' ');
        }
        
        if (isFreeShipping) {
          this.messageElement.innerHTML = `
            <span class="m-free-shipping-progress__success">
              ${processedMessage}
            </span>
          `;
        } else {
          this.messageElement.innerHTML = `
            <span class="m-free-shipping-progress__remaining">
              ${processedMessage}
            </span>
          `;
        }
      }
    }

    // Mostrar/ocultar a barra baseado no total do carrinho
    const shouldShow = this.cartTotal > 0;
    const isCurrentlyVisible = this.style.display !== 'none';

    if (shouldShow !== isCurrentlyVisible) {
      this.style.display = shouldShow ? 'block' : 'none';
    }

    // Esconder cadeado quando atingir o valor (estilo inline)
    if (this.barStyle === 'inline' && this.lockIcon) {
      if (isFreeShipping) {
        this.lockIcon.hidden = true;
      } else {
        this.lockIcon.hidden = false;
      }
    }
  }

  getLocalizedMessage(type, amount = 0) {
    // Tentar usar as traduções do Shopify primeiro
    if (window.Shopify && window.Shopify.translation) {
      try {
        if (type === 'success') {
          return window.Shopify.translation.cart.general.free_shipping_progress.success;
        } else {
          const formattedAmount = this.formatCurrency(amount);
          let message = window.Shopify.translation.cart.general.free_shipping_progress.remaining.replace('{{ amount }}', formattedAmount);
          // Remover <br> se o estilo for inline
          if (this.barStyle === 'inline') {
            message = message.replace(/<br\s*\/?>/gi, ' ');
          }
          return message;
        }
      } catch (e) {
        // Fallback para mensagens hardcoded
      }
    }

    // Fallback para mensagens hardcoded
    const locale = document.documentElement.lang || 'en';

    if (type === 'success') {
      return locale === 'pt-BR'
        ? 'Frete grátis Sul/Sudeste e R$9,90 demais regiões'
        : 'Congratulations! You\'ve earned Free Shipping';
    } else {
      const formattedAmount = this.formatCurrency(amount, locale);
      const message = locale === 'pt-BR'
        ? `Faltam ${formattedAmount} para você ganhar o Frete Grátis`
        : `Add ${formattedAmount} more to get free shipping`;
      
      // Remover <br> se o estilo for inline
      if (this.barStyle === 'inline') {
        return message.replace(/<br\s*\/?>/gi, ' ');
      }
      return message;
    }
  }

  formatCurrency(amount, locale = null) {
    if (!locale) {
      locale = document.documentElement.lang || 'en';
    }

    if (locale === 'pt-BR') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(amount);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    }
  }

  listenForCartUpdates() {
    // Escutar eventos de atualização do carrinho do Minimog
    if (window.MinimogEvents && window.MinimogTheme && window.MinimogTheme.pubSubEvents) {
      window.MinimogEvents.subscribe(window.MinimogTheme.pubSubEvents.cartUpdate, (cartData) => {
        if (cartData && cartData.total_price !== undefined) {
          this.cartTotal = cartData.total_price / 100;
          this.updateProgress();
        }
      });

      // Escutar quando o cart-drawer é aberto
      window.MinimogEvents.subscribe(window.MinimogTheme.pubSubEvents.openCartDrawer, () => {
        // Aguardar um pouco para o cart-drawer ser renderizado
        setTimeout(() => {
          this.updateCartTotal();
        }, 300);
      });
    }

    // Escutar eventos personalizados
    document.addEventListener('cart:updated', (event) => {
      if (event.detail && event.detail.cart) {
        this.cartTotal = event.detail.cart.total_price / 100;
        this.updateProgress();
      }
    });

    // Escutar quando o cart-drawer é atualizado
    document.addEventListener('DOMContentLoaded', () => {
      const cartDrawer = document.querySelector('m-cart-drawer');
      if (cartDrawer) {
        // Observar mudanças no cart-drawer
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
              // Verificar se o carrinho foi atualizado
              setTimeout(() => {
                this.updateCartTotal();
              }, 100);
            }
          });
        });

        observer.observe(cartDrawer, {
          childList: true,
          subtree: true
        });

        // Observar mudanças na classe do cart-drawer para detectar quando abre/fecha
        const cartDrawerObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              if (cartDrawer.classList.contains('m-cart-drawer--active')) {
                // Aguardar um pouco para o cart-drawer ser renderizado
                setTimeout(() => {
                  this.updateCartTotal();
                }, 300);
              }
            }
          });
        });

        cartDrawerObserver.observe(cartDrawer, {
          attributes: true,
          attributeFilter: ['class']
        });
      }
    });

    // Escutar mudanças nos inputs de quantidade
    document.addEventListener('change', (event) => {
      if (event.target.matches('input[data-index]')) {
        // Aguardar um pouco para o carrinho ser atualizado
        setTimeout(() => {
          this.updateCartTotal();
        }, 500);
      }
    });

    // Escutar mudanças no carrinho via MutationObserver
    this.observeCartChanges();
  }

  observeCartChanges() {
    // Observar mudanças no total do carrinho
    const cartTotalElement = document.querySelector('[data-cart-subtotal-price]');
    if (cartTotalElement) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            // Extrair o valor do total do carrinho
            const totalText = cartTotalElement.textContent || '';
            const totalMatch = totalText.match(/[\d,]+\.?\d*/);
            if (totalMatch) {
              const newTotal = parseFloat(totalMatch[0].replace(/,/g, ''));
              if (!isNaN(newTotal) && newTotal !== this.cartTotal) {
                this.cartTotal = newTotal;
                this.updateProgress();
              }
            }
          }
        });
      });

      observer.observe(cartTotalElement, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    // Observar mudanças no contador de itens do carrinho
    const cartCountElements = document.querySelectorAll('.m-cart-count-bubble');
    cartCountElements.forEach(element => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const itemCount = parseInt(element.textContent) || 0;
            if (itemCount === 0) {
              this.cartTotal = 0;
              this.updateProgress();
            }
          }
        });
      });

      observer.observe(element, {
        childList: true,
        characterData: true
      });
    });
  }

  updateCartTotal() {
    // Evitar múltiplas chamadas simultâneas
    if (this.isUpdating) return;
    this.isUpdating = true;

    // Buscar o total atual do carrinho
    fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        const newTotal = cart.total_price / 100;

        // Só atualiza se o total realmente mudou
        if (newTotal !== this.cartTotal) {
          this.cartTotal = newTotal;
          this.updateProgress();
        }
      })
      .catch(error => {
        console.error('Erro ao atualizar total do carrinho:', error);
      })
      .finally(() => {
        this.isUpdating = false;
      });
  }
}

customElements.define('m-free-shipping-progress', MFreeShippingProgress);
