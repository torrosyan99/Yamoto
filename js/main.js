(() => {
    'use strict';

    const focusableSelector = 'a[href], button, input, select, textarea, [tabindex]';

    function focusableElements(container) {
        return [...container.querySelectorAll(focusableSelector)].filter(element =>
            element.tabIndex >= 0 && !element.disabled &&
            !element.closest('[inert]') && element.getClientRects().length > 0
        );
    }

    function trapFocus(event, container) {
        if (event.key !== 'Tab') return;
        const elements = focusableElements(container);
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
            event.preventDefault();
            container.focus();
        } else if (!container.contains(document.activeElement) ||
            (event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
        }
    }

    function init() {
        const menu = document.querySelector('.header__menu');
        const overlay = document.querySelector('.header__overlay');
        const openButton = document.querySelector('.header__menu-button');
        const closeButton = document.querySelector('.header__menu-close');
        const modal = document.querySelector('.modal');
        const modalContent = modal?.querySelector('.modal__content');
        const mobileViewport = window.matchMedia('(max-width: 1400px)');
        let modalTrigger = null;
        let activeSelect = null;

        function setMenu(open, restoreFocus = false) {
            if (!menu) return;
            const wasOpen = menu.classList.contains('active');
            open = open && mobileViewport.matches;
            menu.classList.toggle('active', open);
            overlay?.classList.toggle('active', open);
            document.body.classList.toggle('body-menu-overflow', open);
            openButton?.setAttribute('aria-expanded', String(open));
            menu.inert = mobileViewport.matches && !open;
            if (open) focusableElements(menu)[0]?.focus();
            else if (wasOpen && restoreFocus) openButton?.focus();
        }

        function closeSelect(restoreFocus = false) {
            if (!activeSelect) return;
            const button = activeSelect;
            activeSelect = null;
            button.classList.remove('active');
            button.setAttribute('aria-expanded', 'false');
            button.closest('.select').querySelector('.select__list').inert = true;
            if (restoreFocus) button.focus();
        }

        function setModal(open, trigger = null) {
            if (!modal || !modalContent) return;
            const wasOpen = modal.classList.contains('active');
            closeSelect();
            if (open && !wasOpen) {
                modalTrigger = trigger || document.activeElement;
                setMenu(false);
            }
            modal.classList.toggle('active', open);
            modal.inert = !open;
            modal.setAttribute('aria-hidden', String(!open));
            document.body.classList.toggle('body-overflow', open);
            if (open) (focusableElements(modalContent)[0] || modalContent).focus();
            else if (wasOpen && modalTrigger?.isConnected) modalTrigger.focus();
        }

        if (menu) {
            menu.id ||= 'header-menu';
            openButton?.setAttribute('aria-controls', menu.id);
            openButton?.setAttribute('aria-label', 'Открыть меню');
            closeButton?.setAttribute('aria-label', 'Закрыть меню');
            setMenu(false);
            mobileViewport.addEventListener('change', () => setMenu(false));
        }
        openButton?.addEventListener('click', () => setMenu(true));
        closeButton?.addEventListener('click', () => setMenu(false, true));
        overlay?.addEventListener('click', () => setMenu(false, true));

        if (modal && modalContent) {
            modalContent.setAttribute('role', 'dialog');
            modalContent.setAttribute('aria-modal', 'true');
            modalContent.tabIndex = -1;
            const title = modalContent.querySelector('.title');
            if (title) {
                title.id ||= 'order-dialog-title';
                modalContent.setAttribute('aria-labelledby', title.id);
            }
            const modalClose = modal.querySelector('.modal__close');
            modalClose?.setAttribute('aria-label', 'Закрыть окно');
            modalClose?.addEventListener('click', () => setModal(false));
            modal.addEventListener('click', event => {
                if (!modalContent.contains(event.target)) setModal(false);
            });
            setModal(false);
        }

        document.querySelectorAll('.select').forEach((select, index) => {
            const button = select.querySelector('.select__button');
            const list = select.querySelector('.select__list');
            const label = select.querySelector('.select__active-value');
            if (!button || !list || !label) return;
            list.id ||= 'select-options-' + index;
            list.inert = true;
            button.setAttribute('aria-controls', list.id);
            button.setAttribute('aria-expanded', 'false');
            let input = select.querySelector('input[type="hidden"]');
            if (!input) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = select.dataset.name || 'model';
                input.defaultValue = label.textContent.trim() === 'Модель' ? '' : label.textContent.trim();
                select.append(input);
            }
            const defaultLabel = label.textContent;
            button.addEventListener('click', () => {
                const shouldOpen = activeSelect !== button;
                closeSelect();
                if (shouldOpen) {
                    activeSelect = button;
                    button.classList.add('active');
                    button.setAttribute('aria-expanded', 'true');
                    list.inert = false;
                }
            });
            list.addEventListener('click', event => {
                const option = event.target.closest('.select__list-button');
                if (!option || !list.contains(option)) return;
                label.textContent = option.textContent.trim();
                input.value = option.dataset.value || label.textContent;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                closeSelect(true);
            });
            select.addEventListener('keydown', event => {
                if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                if (activeSelect !== button) button.click();
                const options = [...list.querySelectorAll('.select__list-button:not(:disabled)')];
                const current = options.indexOf(document.activeElement);
                let next = event.key === 'ArrowUp' ? current - 1 : current + 1;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End' || (current === -1 && event.key === 'ArrowUp')) next = options.length - 1;
                options[(next + options.length) % options.length]?.focus();
            });
            select.closest('form')?.addEventListener('reset', () => {
                label.textContent = defaultLabel;
                if (activeSelect === button) closeSelect();
            });
        });

        document.addEventListener('click', event => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (activeSelect && !activeSelect.closest('.select').contains(target)) closeSelect();
            const trigger = target.closest('.catalog__button, .header__box-button');
            if (trigger) setModal(true, trigger);
            if (target.closest('.header__link')) setMenu(false, true);
        });
        document.addEventListener('focusin', event => {
            if (activeSelect && !activeSelect.closest('.select').contains(event.target)) closeSelect();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                if (activeSelect) closeSelect(true);
                else if (modal?.classList.contains('active')) setModal(false);
                else if (menu?.classList.contains('active')) setMenu(false, true);
                else return;
                event.preventDefault();
            } else if (modal?.classList.contains('active')) trapFocus(event, modalContent);
            else if (menu?.classList.contains('active')) trapFocus(event, menu);
        });

        document.querySelectorAll('form.form').forEach(form => {
            const fields = [...form.querySelectorAll('input:not([type="hidden"]), textarea, select')];
            form.noValidate = true;

            function validateField(field) {
                if (!field.willValidate) return true;
                const blank = field.required && typeof field.value === 'string' && !field.value.trim();
                const valid = !blank && field.validity.valid;
                field.classList.toggle('error', !valid);
                field.setAttribute('aria-invalid', String(!valid));
                return valid;
            }

            form.addEventListener('submit', event => {
                event.preventDefault();
                const invalidFields = fields.filter(field => !validateField(field));
                if (invalidFields.length) {
                    invalidFields[0].focus();
                    return;
                }
                // Preserve the demo behavior until a submission endpoint is connected.
                form.reset();
            });
            form.addEventListener('input', event => {
                if (fields.includes(event.target) && event.target.hasAttribute('aria-invalid')) {
                    validateField(event.target);
                }
            });
            form.addEventListener('reset', () => {
                fields.forEach(field => {
                    field.classList.remove('error');
                    field.removeAttribute('aria-invalid');
                });
            });
        });

        if (typeof window.Fancybox?.bind === 'function') {
            window.Fancybox.bind('[data-fancybox="generators"]', {
                Thumbs: false,
                Toolbar: true,
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
