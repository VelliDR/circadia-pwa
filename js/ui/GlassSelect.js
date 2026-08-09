/**
 * @file GlassSelect.js
 * @description Standard HTML Select elemanlarını Material 3 Glassmorphic custom dropdown bileşenine dönüştürür.
 */

export class GlassSelect {
    constructor(selectId, onChangeCallback) {
        this.nativeSelect = document.getElementById(selectId);
        if (!this.nativeSelect) return;

        this.onChangeCallback = onChangeCallback;
        this.container = null;
        this.trigger = null;
        this.dropdown = null;

        this.init();
    }

    init() {
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
        this.nativeSelect.parentNode.insertBefore(this.container, this.nativeSelect);

        this.buildOptions();
        this.bindEvents();
    }

    buildOptions() {
        this.dropdown.innerHTML = '';
        const children = Array.from(this.nativeSelect.children);

        children.forEach(child => {
            if (child.tagName === 'OPTGROUP') {
                const groupLabel = document.createElement('div');
                groupLabel.className = 'm3-glass-group-label';
                groupLabel.textContent = child.label;
                this.dropdown.appendChild(groupLabel);

                Array.from(child.children).forEach(opt => {
                    this.createOptionElement(opt);
                });
            } else if (child.tagName === 'OPTION') {
                this.createOptionElement(child);
            }
        });

        this.updateTriggerLabel();
    }

    createOptionElement(opt) {
        const item = document.createElement('div');
        item.className = `m3-glass-option ${opt.selected ? 'selected' : ''}`;
        item.textContent = opt.textContent;
        item.dataset.value = opt.value;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
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
        const selectedOpt = this.nativeSelect.options[this.nativeSelect.selectedIndex];
        const labelElem = this.trigger.querySelector('.m3-glass-label');
        if (selectedOpt && labelElem) {
            labelElem.textContent = selectedOpt.textContent;
        }

        // Tıklanan seçeneği highlight et
        const options = this.dropdown.querySelectorAll('.m3-glass-option');
        options.forEach(opt => {
            if (opt.dataset.value === this.nativeSelect.value) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
    }

    bindEvents() {
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Dışarı tıklandığında kapat
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
    }

    toggle() {
        // Ekrandaki diğer açık glass select'leri kapat
        document.querySelectorAll('.m3-glass-select-container').forEach(c => {
            if (c !== this.container) c.classList.remove('open');
        });
        this.container.classList.toggle('open');
    }

    close() {
        this.container.classList.remove('open');
    }

    refresh() {
        this.buildOptions();
    }
}