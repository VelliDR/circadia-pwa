/**
 * @file GlassSelect.ts
 * @description Standard HTML Select elemanlarını Material 3 Glassmorphic custom dropdown bileşenine dönüştürür.
 */

export class GlassSelect {
    nativeSelect: HTMLSelectElement;
    onChangeCallback?: (value: string) => void;
    container: HTMLDivElement | null;
    trigger: HTMLDivElement | null;
    dropdown: HTMLDivElement | null;

    constructor(selectId: string, onChangeCallback?: (value: string) => void) {
        this.nativeSelect = document.getElementById(selectId) as HTMLSelectElement;
        if (!this.nativeSelect) {
            this.container = null;
            this.trigger = null;
            this.dropdown = null;
            return;
        }

        this.onChangeCallback = onChangeCallback;
        this.container = null;
        this.trigger = null;
        this.dropdown = null;

        this.init();
    }

    init() {
        if (!this.nativeSelect) return;
        
        // Native select'i gizle
        this.nativeSelect.style.display = 'none';

        // Wrapper oluştur
        this.container = document.createElement('div');
        this.container.className = 'm3-glass-select-container';

        // Trigger Butonu
        this.trigger = document.createElement('div');
        this.trigger.className = 'm3-glass-trigger';
        this.trigger.innerHTML = `
            <span class="m3-glass-label">Seçiniz</span>
            <span class="m3-glass-arrow">▼</span>
        `;

        // Dropdown Paneli
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'm3-glass-dropdown';

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

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.nativeSelect) return;
            
            this.nativeSelect.value = opt.value;
            
            // Native change eventini tetikle
            this.nativeSelect.dispatchEvent(new Event('change'));

            this.updateTriggerLabel();
            this.close();

            if (this.onChangeCallback) {
                this.onChangeCallback(opt.value);
            }
        });

        this.dropdown.appendChild(item);
    }

    updateTriggerLabel() {
        if (!this.nativeSelect || !this.trigger || !this.dropdown) return;
        
        const selectedOpt = this.nativeSelect.options[this.nativeSelect.selectedIndex];
        const labelElem = this.trigger.querySelector('.m3-glass-label');
        if (selectedOpt && labelElem) {
            labelElem.textContent = selectedOpt.textContent;
        }

        // Tıklanan seçeneği highlight et
        const options = this.dropdown.querySelectorAll('.m3-glass-option');
        options.forEach(opt => {
            if ((opt as HTMLElement).dataset.value === this.nativeSelect.value) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
    }

    bindEvents() {
        if (!this.trigger || !this.container) return;
        
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Dışarı tıklandığında kapat
        document.addEventListener('click', (e) => {
            if (this.container && !this.container.contains(e.target as Node)) {
                this.close();
            }
        });
    }

    toggle() {
        if (!this.container) return;
        
        // Ekrandaki diğer açık glass select'leri kapat
        document.querySelectorAll('.m3-glass-select-container').forEach(c => {
            if (c !== this.container) c.classList.remove('open');
        });
        this.container.classList.toggle('open');
    }

    close() {
        if (this.container) {
            this.container.classList.remove('open');
        }
    }

    refresh() {
        this.buildOptions();
    }
}