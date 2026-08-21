/**
 * @file main.ts
 * @description Circadia PWA Ana Uygulama Sınıfı. State yönetimi, event listener'lar,
 * ikili uyku simülasyonu, GlassSelect entegrasyonu ve render döngüsünü yönetir.
 */

import { DRINK_DATABASE, CUP_SIZES } from './db/drinkDatabase';
import { Pharmacokinetics } from './engine/Pharmacokinetics';
import { ToleranceEngine, ToleranceKey } from './engine/ToleranceEngine';
import { InteractiveChart } from './ui/InteractiveChart';
import { GlassSelect } from './ui/GlassSelect';
import { initDB, migrateFromLocalStorage, DrinkRecord } from './store/db';
import { IDBPDatabase } from 'idb';
import './main.css';

class CircadiaApp {
    pk: Pharmacokinetics;
    tolerance: ToleranceEngine;
    chart: InteractiveChart;
    
    drinkHistory: DrinkRecord[] = [];
    weightKg: number = 70;
    cigsPerDay: number = 0;
    toleranceKey: ToleranceKey = 'MEDIUM';
    isQuit: boolean = false;
    daysQuit: number = 1;
    priorCigs: number = 20;
    isOCP: boolean = false;
    isRedShift: boolean = false;

    glassDrinkSelect?: GlassSelect;
    glassCupSelect?: GlassSelect;
    glassTolSelect?: GlassSelect;

    db!: IDBPDatabase<any>;

    constructor() {
        this.pk = new Pharmacokinetics();
        this.tolerance = new ToleranceEngine();
        this.chart = new InteractiveChart('caffeineChart');

        this.start();
    }

    async start() {
        await migrateFromLocalStorage();
        this.db = await initDB();

        this.drinkHistory = await this.db.getAll('history') || [];
        
        const getSetting = async (key: string, defaultVal: any) => {
            const val = await this.db.get('settings', key);
            return val !== undefined ? val : defaultVal;
        };

        this.weightKg = parseInt(await getSetting('circadia_weight', 70), 10) || 70;
        this.cigsPerDay = parseInt(await getSetting('circadia_cigs', 0), 10) || 0;
        this.toleranceKey = await getSetting('circadia_tolerance', 'MEDIUM') as ToleranceKey;
        
        const isQuitRaw = await getSetting('circadia_is_quit', false);
        this.isQuit = typeof isQuitRaw === 'string' ? JSON.parse(isQuitRaw) : isQuitRaw;
        
        this.daysQuit = parseInt(await getSetting('circadia_days_quit', 1), 10) || 1;
        this.priorCigs = parseInt(await getSetting('circadia_prior_cigs', 20), 10) || 20;
        
        const isOCPRaw = await getSetting('circadia_is_ocp', false);
        this.isOCP = typeof isOCPRaw === 'string' ? JSON.parse(isOCPRaw) : isOCPRaw;
        
        const isRedShiftRaw = await getSetting('circadia_red_shift', false);
        this.isRedShift = typeof isRedShiftRaw === 'string' ? JSON.parse(isRedShiftRaw) : isRedShiftRaw;

        this.tolerance.setTolerance(this.toleranceKey);

        this.requestPersistentStorage();
        this.initUI();
        this.applyRedShift();
        this.renderAll();

        setInterval(() => this.renderAll(), 60000);

        window.addEventListener('resize', () => {
            // Chart.js automatically handles responsive resize.
            // No need to manually clear and re-scale canvas here anymore.
        });
    }

    async saveSetting(key: string, value: any) {
        await this.db.put('settings', value, key);
    }

    requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then(isPersisted => {
                console.log(`Circadia Depolama Koruması: ${isPersisted ? 'Aktif (Persistent)' : 'Geçici'}`);
            });
        }
    }

    initUI() {
        const drinkSelect = document.getElementById('select-drink') as HTMLSelectElement;
        const cupSelect = document.getElementById('select-cup') as HTMLSelectElement;

        // 1. İçecek Listesini Kategorili Doldur
        if (drinkSelect && drinkSelect.children.length === 0) {
            const categories = [...new Set(DRINK_DATABASE.map(d => d.category))];
            categories.forEach(cat => {
                const group = document.createElement('optgroup');
                group.label = `--- ${cat.toUpperCase()} ---`;
                DRINK_DATABASE.filter(d => d.category === cat).forEach(drink => {
                    const opt = document.createElement('option');
                    opt.value = drink.id;
                    opt.textContent = `${drink.name} (~${drink.baseCaffeineMg} mg)`;
                    group.appendChild(opt);
                });
                drinkSelect.appendChild(group);
            });
        }

        // 2. Bardak Boyutlarını Doldur
        if (cupSelect && cupSelect.children.length === 0) {
            Object.keys(CUP_SIZES).forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = CUP_SIZES[key].name;
                cupSelect.appendChild(opt);
            });
        }

        // 3. Form Inputlarına Kayıtlı Değerleri Yükle
        const inputWeight = document.getElementById('input-weight') as HTMLInputElement;
        if (inputWeight) inputWeight.value = this.weightKg.toString();

        const inputCigs = document.getElementById('input-cigs') as HTMLInputElement;
        if (inputCigs) inputCigs.value = this.cigsPerDay.toString();

        const selectTol = document.getElementById('select-tolerance') as HTMLSelectElement;
        if (selectTol) selectTol.value = this.toleranceKey;

        const chkQuit = document.getElementById('chk-quit') as HTMLInputElement;
        if (chkQuit) chkQuit.checked = this.isQuit;

        const inputDaysQuit = document.getElementById('input-days-quit') as HTMLInputElement;
        if (inputDaysQuit) inputDaysQuit.value = this.daysQuit.toString();

        const inputPriorCigs = document.getElementById('input-prior-cigs') as HTMLInputElement;
        if (inputPriorCigs) inputPriorCigs.value = this.priorCigs.toString();

        const chkOCP = document.getElementById('chk-ocp') as HTMLInputElement;
        if (chkOCP) chkOCP.checked = this.isOCP;

        this.updateQuitBoxVisibility();

        // 4. Native Select Elemanlarını Material 3 Glassmorphism Dropdown Bileşenlerine Dönüştür
        this.glassDrinkSelect = new GlassSelect('select-drink', () => this.renderAll());
        this.glassCupSelect = new GlassSelect('select-cup', () => this.renderAll());
        this.glassTolSelect = new GlassSelect('select-tolerance', async (val) => {
            this.toleranceKey = val as ToleranceKey;
            this.tolerance.setTolerance(this.toleranceKey);
            await this.saveSetting('circadia_tolerance', this.toleranceKey);
            this.renderAll();
        });

        // 5. Event Listeners
        const btnAdd = document.getElementById('btn-add-drink');
        if (btnAdd) btnAdd.addEventListener('click', () => this.addDrink());

        const btnRedShift = document.getElementById('btn-red-shift');
        if (btnRedShift) {
            btnRedShift.addEventListener('click', async () => {
                this.isRedShift = !this.isRedShift;
                await this.saveSetting('circadia_red_shift', this.isRedShift);
                this.applyRedShift();
            });
        }

        // Yedekleme ve Geri Yükleme
        const btnExport = document.getElementById('btn-export');
        if (btnExport) btnExport.addEventListener('click', () => this.exportData());

        const btnImportTrigger = document.getElementById('btn-import-trigger');
        const inputImport = document.getElementById('input-import') as HTMLInputElement;
        if (btnImportTrigger && inputImport) {
            btnImportTrigger.addEventListener('click', () => inputImport.click());
            inputImport.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                if (target.files && target.files.length > 0) {
                    this.importData(target.files[0]);
                }
            });
        }

        // Form Girdi Dinleyicileri
        if (inputWeight) {
            inputWeight.addEventListener('input', async (e) => {
                const target = e.target as HTMLInputElement;
                this.weightKg = parseInt(target.value, 10) || 70;
                await this.saveSetting('circadia_weight', this.weightKg);
                this.renderAll();
            });
        }

        if (inputCigs) {
            inputCigs.addEventListener('input', async (e) => {
                const target = e.target as HTMLInputElement;
                this.cigsPerDay = parseInt(target.value, 10) || 0;
                await this.saveSetting('circadia_cigs', this.cigsPerDay);
                this.updateQuitBoxVisibility();
                this.renderAll();
            });
        }

        if (chkQuit) {
            chkQuit.addEventListener('change', async (e) => {
                const target = e.target as HTMLInputElement;
                this.isQuit = target.checked;
                await this.saveSetting('circadia_is_quit', this.isQuit);
                this.updateQuitBoxVisibility();
                this.renderAll();
            });
        }

        if (inputDaysQuit) {
            inputDaysQuit.addEventListener('input', async (e) => {
                const target = e.target as HTMLInputElement;
                this.daysQuit = parseInt(target.value, 10) || 1;
                await this.saveSetting('circadia_days_quit', this.daysQuit);
                this.renderAll();
            });
        }

        if (inputPriorCigs) {
            inputPriorCigs.addEventListener('input', async (e) => {
                const target = e.target as HTMLInputElement;
                this.priorCigs = parseInt(target.value, 10) || 20;
                await this.saveSetting('circadia_prior_cigs', this.priorCigs);
                this.renderAll();
            });
        }

        if (chkOCP) {
            chkOCP.addEventListener('change', async (e) => {
                const target = e.target as HTMLInputElement;
                this.isOCP = target.checked;
                await this.saveSetting('circadia_is_ocp', this.isOCP);
                this.renderAll();
            });
        }
    }

    exportData() {
        const payload = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            history: this.drinkHistory,
            weightKg: this.weightKg,
            cigsPerDay: this.cigsPerDay,
            toleranceKey: this.toleranceKey,
            isQuit: this.isQuit,
            daysQuit: this.daysQuit,
            priorCigs: this.priorCigs,
            isOCP: this.isOCP,
            isRedShift: this.isRedShift
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `circadia_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importData(file: File) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            if (!e.target || typeof e.target.result !== 'string') return;
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data.history)) {
                    
                    // Clear existing db
                    await this.db.clear('history');
                    for (const record of data.history) {
                        await this.db.put('history', record);
                    }
                    
                    if (data.weightKg !== undefined) await this.saveSetting('circadia_weight', data.weightKg);
                    if (data.cigsPerDay !== undefined) await this.saveSetting('circadia_cigs', data.cigsPerDay);
                    if (data.toleranceKey) await this.saveSetting('circadia_tolerance', data.toleranceKey);
                    if (data.isQuit !== undefined) await this.saveSetting('circadia_is_quit', data.isQuit);
                    if (data.daysQuit !== undefined) await this.saveSetting('circadia_days_quit', data.daysQuit);
                    if (data.priorCigs !== undefined) await this.saveSetting('circadia_prior_cigs', data.priorCigs);
                    if (data.isOCP !== undefined) await this.saveSetting('circadia_is_ocp', data.isOCP);
                    if (data.isRedShift !== undefined) await this.saveSetting('circadia_red_shift', data.isRedShift);

                    alert('✅ Veriler başarıyla geri yüklendi!');
                    location.reload();
                } else {
                    throw new Error('Geçersiz dosya biçimi.');
                }
            } catch (err) {
                alert('⚠️ Geçersiz veya bozuk yedek dosyası!');
            }
        };
        reader.readAsText(file);
    }

    applyRedShift() {
        const metaTheme = document.getElementById('meta-theme-color');
        if (this.isRedShift) {
            document.body.classList.add('red-shift');
            if (metaTheme) metaTheme.setAttribute('content', '#000000');
        } else {
            document.body.classList.remove('red-shift');
            if (metaTheme) metaTheme.setAttribute('content', '#0b0f17');
        }
        this.renderAll();
    }

    updateQuitBoxVisibility() {
        const quitContainer = document.getElementById('quit-smoking-container');
        const quitDetails = document.getElementById('quit-details');

        if (this.cigsPerDay === 0) {
            if (quitContainer) quitContainer.style.display = 'block';
            if (quitDetails) quitDetails.style.display = this.isQuit ? 'block' : 'none';
        } else {
            if (quitContainer) quitContainer.style.display = 'none';
            if (quitDetails) quitDetails.style.display = 'none';
        }
    }

    async addDrink() {
        const customNameElem = document.getElementById('input-custom-name') as HTMLInputElement;
        const customMgElem = document.getElementById('input-custom-mg') as HTMLInputElement;

        let finalCaffeine = 0;
        let drinkName = '';

        if (customNameElem && customNameElem.value.trim() !== '' && customMgElem && customMgElem.value.trim() !== '') {
            drinkName = customNameElem.value.trim();
            finalCaffeine = parseInt(customMgElem.value, 10) || 0;
            customNameElem.value = '';
            customMgElem.value = '';
        } else {
            const drinkSelect = document.getElementById('select-drink') as HTMLSelectElement;
            const cupSelect = document.getElementById('select-cup') as HTMLSelectElement;
    
            if (!drinkSelect || !cupSelect) return;
    
            const drinkObj = DRINK_DATABASE.find(d => d.id === drinkSelect.value);
            const cupObj = CUP_SIZES[cupSelect.value];
    
            if (!drinkObj || !cupObj) return;
    
            finalCaffeine = drinkObj.baseCaffeineMg;
            if (drinkObj.isVolumeScaled) {
                finalCaffeine = Math.round(finalCaffeine * cupObj.multiplier);
            }
            drinkName = drinkObj.name;
        }

        const stomachState = (document.querySelector('input[name="stomach-state"]:checked') as HTMLInputElement)?.value as 'empty' | 'full' || 'empty';

        const newRecord: DrinkRecord = {
            id: Date.now(),
            name: drinkName + (stomachState === 'full' ? ' (Tok)' : ''),
            caffeineMg: finalCaffeine,
            timestamp: Date.now(),
            stomachState: stomachState
        };

        this.drinkHistory.push(newRecord);
        await this.db.put('history', newRecord);
        this.renderAll();
    }

    async deleteDrink(id: number) {
        this.drinkHistory = this.drinkHistory.filter(item => item.id !== id);
        await this.db.delete('history', id);
        this.renderAll();
    }

    renderAll() {
        const now = Date.now();

        // Aktif Kafein Yükü
        const activeCaffeine = Math.round(
            this.pk.getTotalActiveCaffeine(
                this.drinkHistory,
                now,
                this.cigsPerDay,
                this.isQuit,
                this.daysQuit,
                this.priorCigs,
                this.isOCP
            )
        );

        // 1. Sağlık Uyarısı Pankartı
        const healthStatus = this.tolerance.getHealthStatus(activeCaffeine, this.weightKg);
        const bannerElem = document.getElementById('health-banner');
        const titleElem = document.getElementById('health-banner-title');
        const msgElem = document.getElementById('health-banner-msg');

        if (bannerElem && healthStatus) {
            if (healthStatus.level !== 'SAFE') {
                bannerElem.style.display = 'block';
                bannerElem.style.backgroundColor = healthStatus.bgColor;
                bannerElem.style.borderColor = healthStatus.borderColor;

                if (titleElem) {
                    titleElem.textContent = healthStatus.title;
                    titleElem.style.color = healthStatus.color;
                }

                if (msgElem) {
                    msgElem.textContent = healthStatus.message;
                    msgElem.style.color = 'var(--text-main)';
                }
            } else {
                bannerElem.style.display = 'none';
            }
        }

        // 2. Metrikler & Uyarılma Durumu
        const activeElem = document.getElementById('active-caffeine');
        if (activeElem) activeElem.textContent = `${activeCaffeine} mg`;

        const stimStatus = this.tolerance.getStimulationStatus(activeCaffeine);
        const stimElem = document.getElementById('stimulation-status');
        if (stimElem) {
            stimElem.textContent = stimStatus.isStimulated
                ? `⚡ Aktif Odak Modu (Eşik: ${stimStatus.thresholdMg} mg)`
                : `🌙 Eşik Altında (Odak için +${stimStatus.deficitMg} mg gerekli)`;
        }

        // 3. İkili Uyku Tahmini (A: Mevcut vs B: Seçili İçecek İçilirse)
        const sleepTimeMs = this.pk.estimateTimeToThreshold(
            this.drinkHistory,
            20,
            this.cigsPerDay,
            this.isQuit,
            this.daysQuit,
            this.priorCigs,
            this.isOCP
        );

        const sleepElem = document.getElementById('sleep-time');
        if (sleepElem) {
            if (sleepTimeMs <= now) {
                sleepElem.textContent = 'Şu An';
            } else {
                const sleepDate = new Date(sleepTimeMs);
                const h = sleepDate.getHours().toString().padStart(2, '0');
                const m = sleepDate.getMinutes().toString().padStart(2, '0');
                sleepElem.textContent = `${h}:${m}`;
            }
        }

        const drinkSelect = document.getElementById('select-drink') as HTMLSelectElement;
        const cupSelect = document.getElementById('select-cup') as HTMLSelectElement;
        const simSleepElem = document.getElementById('sleep-time-simulated');

        if (drinkSelect && cupSelect && simSleepElem) {
            const drinkObj = DRINK_DATABASE.find(d => d.id === drinkSelect.value);
            const cupObj = CUP_SIZES[cupSelect.value];

            if (drinkObj && cupObj) {
                let simCaffeine = drinkObj.baseCaffeineMg;
                if (drinkObj.isVolumeScaled) {
                    simCaffeine = Math.round(simCaffeine * cupObj.multiplier);
                }

                const simulatedHistory = [
                    ...this.drinkHistory,
                    { id: 99999, name: 'Sim', caffeineMg: simCaffeine, timestamp: now }
                ];

                const simSleepTimeMs = this.pk.estimateTimeToThreshold(
                    simulatedHistory,
                    20,
                    this.cigsPerDay,
                    this.isQuit,
                    this.daysQuit,
                    this.priorCigs,
                    this.isOCP
                );

                if (simSleepTimeMs <= now) {
                    simSleepElem.textContent = 'Şu An';
                } else {
                    const simSleepDate = new Date(simSleepTimeMs);
                    const simHours = simSleepDate.getHours().toString().padStart(2, '0');
                    const simMinutes = simSleepDate.getMinutes().toString().padStart(2, '0');
                    simSleepElem.textContent = `${simHours}:${simMinutes}`;
                }
            }
        }

        // 4. CYP1A2 Enzim Durum Yazısı
        const effHalfLife = this.pk.calculateEffectiveHalfLife(
            this.cigsPerDay,
            this.isQuit,
            this.daysQuit,
            this.priorCigs,
            this.isOCP
        ).toFixed(1);

        const cypElem = document.getElementById('cyp-status');
        if (cypElem) {
            let ocpTag = this.isOCP ? ' + OCP (2x)' : '';
            if (this.cigsPerDay === 0 && this.isQuit && this.daysQuit < 14) {
                cypElem.textContent = `🚭 Sigara Bırakıldı (Gün ${this.daysQuit}/14): Yarı Ömür ${effHalfLife} Saat${ocpTag}`;
            } else {
                cypElem.textContent = `CYP1A2: Yarı Ömür ${effHalfLife} Saat (${this.cigsPerDay} Sigara/Gün)${ocpTag}`;
            }
        }

        // 5. Canvas Grafiği Çizimi
        if (this.chart) {
            this.chart.render(
                this.pk,
                this.drinkHistory,
                this.cigsPerDay,
                this.tolerance.currentTolerance.thresholdMg,
                20,
                this.isQuit,
                this.daysQuit,
                this.priorCigs,
                this.isOCP
            );
        }

        // 6. Tüketim Geçmişi Listesi
        const historyList = document.getElementById('history-list');
        if (historyList) {
            if (this.drinkHistory.length === 0) {
                historyList.innerHTML = '<li style="color: var(--text-muted); font-size: 0.85rem;">Henüz içecek eklenmedi.</li>';
                return;
            }

            historyList.innerHTML = [...this.drinkHistory].reverse().map(item => {
                const d = new Date(item.timestamp);
                const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                return `
                    <li class="history-item">
                        <div class="history-info">
                            <span class="history-time">${timeStr}</span>
                            <span>${item.name}</span>
                        </div>
                        <div class="history-actions">
                            <strong>+${item.caffeineMg} mg</strong>
                            <button class="btn-delete" data-id="${item.id}" title="Kaydı Sil" aria-label="${item.name} kaydını sil">✕</button>
                        </div>
                    </li>
                `;
            }).join('');

            historyList.querySelectorAll('.btn-delete').forEach(btn => {
                (btn as HTMLButtonElement).onclick = async (e) => {
                    const id = parseInt((e.currentTarget as HTMLButtonElement).getAttribute('data-id') || '0', 10);
                    await this.deleteDrink(id);
                };
            });
        }
    }
}

// Uygulamayı Başlat
window.addEventListener('DOMContentLoaded', () => new CircadiaApp());