/**
 * @file GlassSelect.ts
 * @description Standard HTML Select elemanlarını Material 3 Glassmorphic custom dropdown bileşenine dönüştürür.
 * WAI-ARIA combobox standartlarına, klavye erişilebilirliğine (Tab, Enter, Space, Up/Down, Esc) ve ekran okuyuculara uygundur.
 */

export class GlassSelect {
    nativeSelect: HTMLSelectElement;
    onChangeCallback?: (value: string) => void;
    container: HTMLDivElement | null;
    trigger: HTMLDivElement | null;
    dropdown: HTMLDivElement | null;
    private onDocClick: (e: MouseEvent) => void;

    constructor(selectId: string, onChangeCallback?: (value: string) => void) {
        this.nativeSelect = document.getElementById(selectId) as HTMLSelectElement;
        this.onChangeCallback = onChangeCallback;
        this.container = null;
        this.trigger = null;
        this.dropdown = null;
        this.onDocClick = (e: MouseEvent) => {
            if (this.container && !this.container.contains(e.target as Node)) {
                this.close();
            }
        };

        if (this.nativeSelect) {
            this.init();
        }
    }

    init() {
        if (!this.nativeSelect) return;
        
        // Native select'i gizle ama erişilebilirlik için DOM'da tut
        this.nativeSelect.style.display = 'none';

        // Wrapper oluştur
        this.container = document.createElement('div');
        this.container.className = 'm3-glass-select-container';

        // Trigger Butonu (Combobox)
        this.trigger = document.createElement('div');
        this.trigger.className = 'm3-glass-trigger';
        this.trigger.tabIndex = 0;
        this.trigger.setAttribute('role', 'combobox');
        this.trigger.setAttribute('aria-haspopup', 'listbox');
        this.trigger.setAttribute('aria-expanded', 'false');
        this.trigger.setAttribute('aria-label', this.nativeSelect.getAttribute('aria-label') || 'Seçim yapın');
        
        this.trigger.innerHTML = `
            <span class="m3-glass-label">Seçiniz</span>
            <span class="m3-glass-arrow" aria-hidden="true">▼</span>
        `;

        // Dropdown Paneli (Listbox)
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'm3-glass-dropdown';
        this.dropdown.setAttribute('role', 'listbox');

        this.container.appendChild(this.trigger);
        this.container.appendChild(this.dropdown);
        
        if (this.nativeSelect.parentNode) {
            this.nativeSelect.parentNode.insertBefore(this.container, this.nativeSelect);
        }

        this.buildOptions();
        this.bindEvents();
    }

    buildOptions() {
        if (!this.dropdown || !this.nativeSelect) return;
        
        this.dropdown.innerHTML = '';
        const children = Array.from(this.nativeSelect.children);

        children.forEach(child => {
            if (child.tagName === 'OPTGROUP') {
                const optgroup = child as HTMLOptGroupElement;
                const groupLabel = document.createElement('div');
                groupLabel.className = 'm3-glass-group-label';
                groupLabel.textContent = optgroup.label;
                groupLabel.setAttribute('role', 'presentation');
                this.dropdown!.appendChild(groupLabel);

                Array.from(optgroup.children).forEach(opt => {
                    this.createOptionElement(opt as HTMLOptionElement);
                });
            } else if (child.tagName === 'OPTION') {
                this.createOptionElement(child as HTMLOptionElement);
            }
        });

        this.updateTriggerLabel();
    }

    createOptionElement(opt: HTMLOptionElement) {
        if (!this.dropdown) return;
        
        const item = document.createElement('div');
        item.className = `m3-glass-option ${opt.selected ? 'selected' : ''}`;
        item.textContent = opt.textContent;
        item.dataset.value = opt.value;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', opt.selected ? 'true' : 'false');
        item.tabIndex = -1;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectValue(opt.value);
        });

        this.dropdown.appendChild(item);
    }

    selectValue(value: string) {
        if (!this.nativeSelect) return;

        this.nativeSelect.value = value;
        this.nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));

        this.updateTriggerLabel();
        this.close();

        if (this.onChangeCallback) {
            this.onChangeCallback(value);
        }

        if (this.trigger) {
            this.trigger.focus();
        }
    }

    updateTriggerLabel() {
        if (!this.nativeSelect || !this.trigger || !this.dropdown) return;
        
        const selectedOpt = this.nativeSelect.options[this.nativeSelect.selectedIndex];
        const labelElem = this.trigger.querySelector('.m3-glass-label');
        if (selectedOpt && labelElem) {
            labelElem.textContent = selectedOpt.textContent;
        }

        // Tıklanan seçeneği highlight et ve aria-selected güncelle
        const options = this.dropdown.querySelectorAll('.m3-glass-option');
        options.forEach(opt => {
            const isMatch = (opt as HTMLElement).dataset.value === this.nativeSelect.value;
            if (isMatch) {
                opt.classList.add('selected');
                opt.setAttribute('aria-selected', 'true');
            } else {
                opt.classList.remove('selected');
                opt.setAttribute('aria-selected', 'false');
            }
        });
    }

    bindEvents() {
        if (!this.trigger || !this.container) return;
        
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Klavye Gezintisi (A11y: Space, Enter, Up, Down, Escape)
        this.trigger.addEventListener('keydown', (e: KeyboardEvent) => {
            const isOpen = this.container?.classList.contains('open');
            const options = Array.from(this.dropdown?.querySelectorAll('.m3-glass-option') || []) as HTMLElement[];
            const currentIndex = options.findIndex(opt => opt.dataset.value === this.nativeSelect.value);

            switch (e.key) {
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    if (!isOpen) {
                        this.open();
                    } else if (currentIndex >= 0 && options[currentIndex]) {
                        this.selectValue(options[currentIndex].dataset.value || '');
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (!isOpen) {
                        this.open();
                    } else {
                        const nextIndex = (currentIndex + 1) % options.length;
                        this.selectValue(options[nextIndex].dataset.value || '');
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (!isOpen) {
                        this.open();
                    } else {
                        const prevIndex = (currentIndex - 1 + options.length) % options.length;
                        this.selectValue(options[prevIndex].dataset.value || '');
                    }
                    break;
                case 'Escape':
                    if (isOpen) {
                        e.preventDefault();
                        this.close();
                    }
                    break;
            }
        });

        // Dışarı tıklandığında kapat
        document.removeEventListener('click', this.onDocClick);
        document.addEventListener('click', this.onDocClick);
    }

    open() {
        if (!this.container || !this.trigger) return;
        // Ekrandaki diğer açık glass select'leri kapat
        document.querySelectorAll('.m3-glass-select-container').forEach(c => {
            if (c !== this.container) {
                c.classList.remove('open');
                c.querySelector('.m3-glass-trigger')?.setAttribute('aria-expanded', 'false');
            }
        });
        this.container.classList.add('open');
        this.trigger.setAttribute('aria-expanded', 'true');
    }

    close() {
        if (this.container && this.trigger) {
            this.container.classList.remove('open');
            this.trigger.setAttribute('aria-expanded', 'false');
        }
    }

    toggle() {
        if (!this.container) return;
        if (this.container.classList.contains('open')) {
            this.close();
        } else {
            this.open();
        }
    }

    refresh() {
        this.buildOptions();
    }
}