/**
 * @file main.ts
 * @description Circadia PWA Ana Uygulama Sınıfı.
 * Faz 0–4: Hacim/Birim bazlı kafein ve polifenol hesaplama, (USDA | TÜRKOMP) kaynak karşılaştırması,
 * isteğe bağlı öğün/takviye emilim pencereleri, kalsiyum/VDR dengesi ve uygulama içi tıklanabilir sayaç.
 */

import {
    DRINK_DATABASE,
    Drink,
    calculateCaffeineMg,
    calculatePolyphenolMg,
    getServing,
    getDefaultCaffeineMg,
    formatSourceComparison,
    isIntrinsicMilkDrink
} from './db/drinkDatabase';
import { Pharmacokinetics } from './engine/Pharmacokinetics';
import { ToleranceEngine, ToleranceKey, DailyWindowMode } from './engine/ToleranceEngine';
import { AbsorptionEngine } from './engine/AbsorptionEngine';
import { InteractiveChart } from './ui/InteractiveChart';
import { GlassSelect } from './ui/GlassSelect';
import {
    initDB,
    migrateFromLocalStorage,
    DrinkRecord,
    MealRecord,
    MealType,
    MealMatrixType,
    SupplementRecord,
    SupplementType,
    NutritionProfile,
    DEFAULT_NUTRITION_PROFILE,
    DietType,
    SpecialCondition,
    CalciumIntakeLevel,
    CircadiaDB
} from './store/db';
import { escapeHtml } from './utils/security';
import { IDBPDatabase } from 'idb';
import './main.css';

interface InAppTimerState {
    endTimestamp: number | null;
    label: string;
    notifiedComplete?: boolean;
}

const MEAL_LABELS: Record<MealType, string> = {
    breakfast: 'Kahvaltı',
    lunch: 'Öğle Yemeği',
    dinner: 'Akşam Yemeği',
    snack: 'Ara Öğün'
};

const SUPPLEMENT_LABELS: Record<SupplementType, string> = {
    iron: 'Demir Takviyesi',
    folate: 'Folik Asit (B9)',
    thiamine: 'Tiamin (B1)',
    calcium: 'Kalsiyum Takviyesi'
};

class CircadiaApp {
    pk: Pharmacokinetics;
    tolerance: ToleranceEngine;
    absorption: AbsorptionEngine;
    chart: InteractiveChart;

    drinkHistory: DrinkRecord[] = [];
    mealHistory: MealRecord[] = [];
    supplementHistory: SupplementRecord[] = [];

    weightKg: number = 70;
    cigsPerDay: number = 0;
    toleranceKey: ToleranceKey = 'MEDIUM';
    dailyWindowMode: DailyWindowMode = 'midnight';
    isQuit: boolean = false;
    daysQuit: number = 1;
    priorCigs: number = 20;
    isOCP: boolean = false;
    isRedShift: boolean = false;
    nutritionProfile: NutritionProfile = { ...DEFAULT_NUTRITION_PROFILE };

    timerState: InAppTimerState = { endTimestamp: null, label: '' };
    lastSuggestedSmartMinutes: number = 0;

    glassDrinkSelect?: GlassSelect;
    glassCupSelect?: GlassSelect;
    glassTolSelect?: GlassSelect;

    db!: IDBPDatabase<CircadiaDB>;

    constructor() {
        this.pk = new Pharmacokinetics();
        this.tolerance = new ToleranceEngine();
        this.absorption = new AbsorptionEngine();
        this.chart = new InteractiveChart('caffeineChart');

        this.start();
    }

    private get isPregnantProfile(): boolean {
        return this.nutritionProfile.specialCondition === 'pregnant';
    }

    async start() {
        await migrateFromLocalStorage();
        this.db = await initDB();

        this.drinkHistory = (await this.db.getAll('history')) || [];
        this.mealHistory = (await this.db.getAll('meals')) || [];
        this.supplementHistory = (await this.db.getAll('supplements')) || [];

        const getSetting = async (key: string, defaultVal: any) => {
            const val = await this.db.get('settings', key);
            return val !== undefined ? val : defaultVal;
        };

        const rawWeight = parseInt(await getSetting('circadia_weight', 70), 10);
        this.weightKg = Math.max(30, Math.min(250, isNaN(rawWeight) ? 70 : rawWeight));

        const rawCigs = parseInt(await getSetting('circadia_cigs', 0), 10);
        this.cigsPerDay = Math.max(0, Math.min(60, isNaN(rawCigs) ? 0 : rawCigs));

        const savedTol = await getSetting('circadia_tolerance', 'MEDIUM');
        this.toleranceKey = ['LOW', 'MEDIUM', 'HIGH'].includes(savedTol) ? (savedTol as ToleranceKey) : 'MEDIUM';

        const savedWinMode = await getSetting('circadia_daily_window', 'midnight');
        this.dailyWindowMode = savedWinMode === 'rolling24h' ? 'rolling24h' : 'midnight';

        const isQuitRaw = await getSetting('circadia_is_quit', false);
        this.isQuit = typeof isQuitRaw === 'string' ? JSON.parse(isQuitRaw) : Boolean(isQuitRaw);

        const rawDaysQuit = parseInt(await getSetting('circadia_days_quit', 1), 10);
        this.daysQuit = Math.max(1, Math.min(14, isNaN(rawDaysQuit) ? 1 : rawDaysQuit));

        const rawPriorCigs = parseInt(await getSetting('circadia_prior_cigs', 20), 10);
        this.priorCigs = Math.max(1, Math.min(60, isNaN(rawPriorCigs) ? 20 : rawPriorCigs));

        const isOCPRaw = await getSetting('circadia_is_ocp', false);
        this.isOCP = typeof isOCPRaw === 'string' ? JSON.parse(isOCPRaw) : Boolean(isOCPRaw);

        const isRedShiftRaw = await getSetting('circadia_red_shift', false);
        this.isRedShift = typeof isRedShiftRaw === 'string' ? JSON.parse(isRedShiftRaw) : Boolean(isRedShiftRaw);

        const savedProfile = await getSetting('circadia_nutrition_profile', null);
        if (savedProfile && typeof savedProfile === 'object') {
            this.nutritionProfile = {
                dietType: ['omnivore', 'vegetarian', 'vegan'].includes(savedProfile.dietType)
                    ? savedProfile.dietType
                    : 'omnivore',
                specialCondition: ['none', 'ida_risk', 'pregnant', 'postmenopausal', 'iron_overload'].includes(savedProfile.specialCondition)
                    ? savedProfile.specialCondition
                    : 'none',
                calciumIntakeLevel: ['low', 'moderate', 'adequate'].includes(savedProfile.calciumIntakeLevel)
                    ? savedProfile.calciumIntakeLevel
                    : 'adequate'
            };
        }

        const savedTimer = await getSetting('circadia_timer_state', null);
        if (savedTimer && typeof savedTimer === 'object') {
            this.timerState = {
                endTimestamp: typeof savedTimer.endTimestamp === 'number' ? savedTimer.endTimestamp : null,
                label: typeof savedTimer.label === 'string' ? savedTimer.label.slice(0, 80) : '',
                notifiedComplete: Boolean(savedTimer.notifiedComplete)
            };
        }

        this.tolerance.setTolerance(this.toleranceKey);

        this.requestPersistentStorage();
        this.initUI();
        this.applyRedShift();
        this.tickTimer();

        setInterval(() => this.renderAll(), 60000);
        setInterval(() => this.tickTimer(), 1000);
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

    private getSelectedDrink(): Drink {
        const drinkSelect = document.getElementById('select-drink') as HTMLSelectElement | null;
        const found = drinkSelect ? DRINK_DATABASE.find(d => d.id === drinkSelect.value) : undefined;
        return found || DRINK_DATABASE[0];
    }

    private populateServingSelect(drink: Drink) {
        const cupSelect = document.getElementById('select-cup') as HTMLSelectElement | null;
        const cupLabel = document.getElementById('label-select-cup');
        const milkRow = document.getElementById('milk-modifier-row');
        const milkChk = document.getElementById('chk-drink-milk') as HTMLInputElement | null;

        if (!cupSelect) return;

        cupSelect.innerHTML = '';
        drink.servings.forEach(srv => {
            const opt = document.createElement('option');
            opt.value = srv.id;
            const mg = calculateCaffeineMg(drink, srv);
            opt.textContent = `${srv.label} — ${mg} mg kafein`;
            if (srv.id === drink.defaultServingId) {
                opt.selected = true;
            }
            cupSelect.appendChild(opt);
        });

        if (cupLabel) {
            cupLabel.textContent = drink.mode === 'volume'
                ? 'Bardak / İçecek Hacmi (ml)'
                : `Porsiyon / Doz Adedi (${drink.unitLabel})`;
        }

        if (milkRow && milkChk) {
            if (drink.polyphenols.supportsMilkModifier) {
                milkRow.style.display = 'block';
            } else {
                milkRow.style.display = 'none';
                milkChk.checked = false;
            }
        }

        if (this.glassCupSelect) {
            this.glassCupSelect.refresh();
        }
    }

    private resolveSelectedDrinkTimestamp(now: number = Date.now()): number {
        const timeSelect = document.getElementById('select-time-offset') as HTMLSelectElement | null;
        const customTimeInput = document.getElementById('input-custom-time') as HTMLInputElement | null;

        if (!timeSelect) return now;

        if (timeSelect.value === 'custom' && customTimeInput && customTimeInput.value) {
            const [hours, minutes] = customTimeInput.value.split(':').map(Number);
            const customDate = new Date(now);
            customDate.setHours(hours, minutes, 0, 0);
            if (customDate.getTime() > now) {
                customDate.setDate(customDate.getDate() - 1);
            }
            return customDate.getTime();
        }

        const minsOffset = parseInt(timeSelect.value, 10) || 0;
        return now - (minsOffset * 60 * 1000);
    }

    initUI() {
        const drinkSelect = document.getElementById('select-drink') as HTMLSelectElement | null;

        // 1. İçecek Listesini Kategorili Doldur
        if (drinkSelect && drinkSelect.children.length === 0) {
            const categories = [...new Set(DRINK_DATABASE.map(d => d.category))];
            categories.forEach(cat => {
                const group = document.createElement('optgroup');
                group.label = `--- ${cat.toUpperCase()} ---`;
                DRINK_DATABASE.filter(d => d.category === cat).forEach(drink => {
                    const opt = document.createElement('option');
                    opt.value = drink.id;
                    const defaultMg = getDefaultCaffeineMg(drink);
                    opt.textContent = `${drink.name} (~${defaultMg} mg)`;
                    group.appendChild(opt);
                });
                drinkSelect.appendChild(group);
            });
        }

        // 2. İlk İçeceğin Porsiyon Seçeneklerini Doldur
        this.populateServingSelect(this.getSelectedDrink());

        // 3. Kayıtlı Profil Girdilerini Yükle
        const inputWeight = document.getElementById('input-weight') as HTMLInputElement | null;
        if (inputWeight) inputWeight.value = this.weightKg.toString();

        const selectWinMode = document.getElementById('select-daily-window') as HTMLSelectElement | null;
        if (selectWinMode) selectWinMode.value = this.dailyWindowMode;

        const inputCigs = document.getElementById('input-cigs') as HTMLInputElement | null;
        if (inputCigs) inputCigs.value = this.cigsPerDay.toString();

        const selectTol = document.getElementById('select-tolerance') as HTMLSelectElement | null;
        if (selectTol) selectTol.value = this.toleranceKey;

        const chkQuit = document.getElementById('chk-quit') as HTMLInputElement | null;
        if (chkQuit) chkQuit.checked = this.isQuit;

        const inputDaysQuit = document.getElementById('input-days-quit') as HTMLInputElement | null;
        if (inputDaysQuit) inputDaysQuit.value = this.daysQuit.toString();

        const inputPriorCigs = document.getElementById('input-prior-cigs') as HTMLInputElement | null;
        if (inputPriorCigs) inputPriorCigs.value = this.priorCigs.toString();

        const chkOCP = document.getElementById('chk-ocp') as HTMLInputElement | null;
        if (chkOCP) chkOCP.checked = this.isOCP;

        const selectDiet = document.getElementById('select-diet-type') as HTMLSelectElement | null;
        if (selectDiet) selectDiet.value = this.nutritionProfile.dietType;

        const selectCond = document.getElementById('select-special-condition') as HTMLSelectElement | null;
        if (selectCond) selectCond.value = this.nutritionProfile.specialCondition;

        const selectCalc = document.getElementById('select-calcium-level') as HTMLSelectElement | null;
        if (selectCalc) selectCalc.value = this.nutritionProfile.calciumIntakeLevel;

        this.updateQuitBoxVisibility();

        // 4. Zaman Seçici Kontrolleri
        const timeSelect = document.getElementById('select-time-offset') as HTMLSelectElement | null;
        const customTimeInput = document.getElementById('input-custom-time') as HTMLInputElement | null;
        if (timeSelect && customTimeInput) {
            timeSelect.addEventListener('change', () => {
                if (timeSelect.value === 'custom') {
                    customTimeInput.style.display = 'block';
                    const now = new Date();
                    const curH = now.getHours().toString().padStart(2, '0');
                    const curM = now.getMinutes().toString().padStart(2, '0');
                    if (!customTimeInput.value) {
                        customTimeInput.value = `${curH}:${curM}`;
                    }
                } else {
                    customTimeInput.style.display = 'none';
                }
                this.renderAll();
            });
            customTimeInput.addEventListener('change', () => this.renderAll());
        }

        const milkChk = document.getElementById('chk-drink-milk');
        if (milkChk) milkChk.addEventListener('change', () => this.renderAll());

        // 5. GlassSelect Bileşenleri
        this.glassDrinkSelect = new GlassSelect('select-drink', () => {
            this.populateServingSelect(this.getSelectedDrink());
            this.renderAll();
        });
        this.glassCupSelect = new GlassSelect('select-cup', () => this.renderAll());
        this.glassTolSelect = new GlassSelect('select-tolerance', async (val) => {
            this.toleranceKey = val as ToleranceKey;
            this.tolerance.setTolerance(this.toleranceKey);
            await this.saveSetting('circadia_tolerance', this.toleranceKey);
            this.renderAll();
        });

        // 6. Aksiyon Butonları
        document.getElementById('btn-add-drink')?.addEventListener('click', () => this.addDrink());
        document.getElementById('btn-add-meal')?.addEventListener('click', () => this.addMeal());
        document.getElementById('btn-add-supplement')?.addEventListener('click', () => this.addSupplement());

        document.getElementById('btn-red-shift')?.addEventListener('click', async () => {
            this.isRedShift = !this.isRedShift;
            await this.saveSetting('circadia_red_shift', this.isRedShift);
            this.applyRedShift();
        });

        // Yedekleme & İçe Aktarma
        document.getElementById('btn-export')?.addEventListener('click', () => this.exportData());
        const btnImportTrigger = document.getElementById('btn-import-trigger');
        const inputImport = document.getElementById('input-import') as HTMLInputElement | null;
        if (btnImportTrigger && inputImport) {
            btnImportTrigger.addEventListener('click', () => inputImport.click());
            inputImport.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                if (target.files && target.files.length > 0) {
                    this.importData(target.files[0]);
                }
            });
        }

        // Profil Girdi Dinleyicileri
        inputWeight?.addEventListener('input', async (e) => {
            const parsed = parseInt((e.target as HTMLInputElement).value, 10);
            this.weightKg = Math.max(30, Math.min(250, isNaN(parsed) ? 70 : parsed));
            await this.saveSetting('circadia_weight', this.weightKg);
            this.renderAll();
        });

        selectWinMode?.addEventListener('change', async (e) => {
            const val = (e.target as HTMLSelectElement).value;
            this.dailyWindowMode = val === 'rolling24h' ? 'rolling24h' : 'midnight';
            await this.saveSetting('circadia_daily_window', this.dailyWindowMode);
            this.renderAll();
        });

        inputCigs?.addEventListener('input', async (e) => {
            const parsed = parseInt((e.target as HTMLInputElement).value, 10);
            this.cigsPerDay = Math.max(0, Math.min(60, isNaN(parsed) ? 0 : parsed));
            await this.saveSetting('circadia_cigs', this.cigsPerDay);
            this.updateQuitBoxVisibility();
            this.renderAll();
        });

        chkQuit?.addEventListener('change', async (e) => {
            this.isQuit = (e.target as HTMLInputElement).checked;
            await this.saveSetting('circadia_is_quit', this.isQuit);
            this.updateQuitBoxVisibility();
            this.renderAll();
        });

        inputDaysQuit?.addEventListener('input', async (e) => {
            const parsed = parseInt((e.target as HTMLInputElement).value, 10);
            this.daysQuit = Math.max(1, Math.min(14, isNaN(parsed) ? 1 : parsed));
            await this.saveSetting('circadia_days_quit', this.daysQuit);
            this.renderAll();
        });

        inputPriorCigs?.addEventListener('input', async (e) => {
            const parsed = parseInt((e.target as HTMLInputElement).value, 10);
            this.priorCigs = Math.max(1, Math.min(60, isNaN(parsed) ? 20 : parsed));
            await this.saveSetting('circadia_prior_cigs', this.priorCigs);
            this.renderAll();
        });

        chkOCP?.addEventListener('change', async (e) => {
            this.isOCP = (e.target as HTMLInputElement).checked;
            await this.saveSetting('circadia_is_ocp', this.isOCP);
            this.renderAll();
        });

        // Beslenme Profili Dinleyicileri
        const saveNutrProfile = async () => {
            await this.saveSetting('circadia_nutrition_profile', this.nutritionProfile);
            this.renderAll();
        };

        selectDiet?.addEventListener('change', (e) => {
            this.nutritionProfile.dietType = (e.target as HTMLSelectElement).value as DietType;
            saveNutrProfile();
        });
        selectCond?.addEventListener('change', (e) => {
            this.nutritionProfile.specialCondition = (e.target as HTMLSelectElement).value as SpecialCondition;
            saveNutrProfile();
        });
        selectCalc?.addEventListener('change', (e) => {
            this.nutritionProfile.calciumIntakeLevel = (e.target as HTMLSelectElement).value as CalciumIntakeLevel;
            saveNutrProfile();
        });

        // Silme İşlemleri (Event Delegation)
        document.getElementById('history-list')?.addEventListener('click', async (e) => {
            const btn = (e.target as HTMLElement).closest('.btn-delete') as HTMLButtonElement | null;
            if (btn) {
                const id = parseInt(btn.getAttribute('data-id') || '0', 10);
                if (id) await this.deleteDrink(id);
            }
        });

        document.getElementById('nutrition-history-list')?.addEventListener('click', async (e) => {
            const btn = (e.target as HTMLElement).closest('.btn-delete') as HTMLButtonElement | null;
            if (!btn) return;
            const id = parseInt(btn.getAttribute('data-id') || '0', 10);
            const kind = btn.getAttribute('data-kind');
            if (!id) return;
            if (kind === 'meal') await this.deleteMeal(id);
            else if (kind === 'supplement') await this.deleteSupplement(id);
        });

        // Canlı Önizleme Kutusu İçi Akıllı Sayaç Kısayolu
        document.getElementById('drink-live-preview')?.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('.btn-inline-timer') as HTMLButtonElement | null;
            if (btn) {
                const mins = parseInt(btn.getAttribute('data-mins') || '60', 10);
                this.startInAppTimer(mins, 'Güvenli İçecek Penceresi');
                this.openTimerModal();
            }
        });

        // 7. Uygulama İçi Tıklanabilir Pop-up Sayaç Kontrolleri
        const openModal = () => this.openTimerModal();
        document.getElementById('floating-timer-pill')?.addEventListener('click', openModal);
        document.getElementById('btn-open-timer-top')?.addEventListener('click', openModal);
        document.getElementById('btn-quick-meal-timer')?.addEventListener('click', openModal);

        const closeModal = () => this.closeTimerModal();
        document.getElementById('btn-close-timer-modal')?.addEventListener('click', closeModal);
        document.getElementById('btn-done-timer-modal')?.addEventListener('click', closeModal);
        document.getElementById('timer-modal-backdrop')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeTimerModal();
        });

        document.querySelectorAll('.btn-timer-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const mins = parseInt((btn as HTMLElement).getAttribute('data-minutes') || '60', 10);
                this.startInAppTimer(mins, `${mins} dk Emilim Penceresi`);
            });
        });

        document.getElementById('btn-timer-smart')?.addEventListener('click', () => {
            if (this.lastSuggestedSmartMinutes > 0) {
                this.startInAppTimer(this.lastSuggestedSmartMinutes, 'Optimal Emilim Penceresi');
            }
        });

        document.getElementById('btn-cancel-timer')?.addEventListener('click', () => {
            this.clearInAppTimer();
        });

        // 8. Mobil Görünüm Sekmeleri (Takip / Emilim / Profil)
        const tabButtons = document.querySelectorAll('.mobile-tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = (btn as HTMLElement).getAttribute('data-tab') || 'track';
                document.body.setAttribute('data-active-tab', targetTab);
                tabButtons.forEach(b => {
                    const isActive = b === btn;
                    b.classList.toggle('active', isActive);
                    b.setAttribute('aria-selected', isActive ? 'true' : 'false');
                });
                if (targetTab === 'track') {
                    requestAnimationFrame(() => {
                        this.chart.chartInstance?.resize();
                        this.renderAll();
                    });
                }
            });
        });

        let resizeTimer: number | undefined;
        window.addEventListener('resize', () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                this.chart.chartInstance?.resize();
                this.renderAll();
            }, 150);
        });
    }

    // =========================================================================
    // UYGULAMA İÇİ POP-UP EMİLİM SAYACI YÖNETİMİ
    // =========================================================================
    openTimerModal() {
        const backdrop = document.getElementById('timer-modal-backdrop');
        if (backdrop) {
            backdrop.style.display = 'flex';
            this.tickTimer();
        }
    }

    closeTimerModal() {
        const backdrop = document.getElementById('timer-modal-backdrop');
        if (backdrop) backdrop.style.display = 'none';
    }

    async startInAppTimer(minutes: number, label: string) {
        const safeMins = Math.max(1, Math.min(360, Math.round(minutes)));
        this.timerState = {
            endTimestamp: Date.now() + (safeMins * 60 * 1000),
            label,
            notifiedComplete: false
        };
        await this.saveSetting('circadia_timer_state', this.timerState);
        this.tickTimer();
    }

    async clearInAppTimer() {
        this.timerState = { endTimestamp: null, label: '', notifiedComplete: false };
        await this.saveSetting('circadia_timer_state', this.timerState);
        this.tickTimer();
    }

    private formatCountdownMs(remainingMs: number): string {
        const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    tickTimer() {
        const pill = document.getElementById('floating-timer-pill');
        const pillText = document.getElementById('floating-timer-text');
        const clockElem = document.getElementById('timer-countdown-display');
        const statusElem = document.getElementById('timer-status-caption');
        const cancelBtn = document.getElementById('btn-cancel-timer');
        const smartBtn = document.getElementById('btn-timer-smart');

        if (smartBtn) {
            if (this.lastSuggestedSmartMinutes > 0) {
                smartBtn.style.display = 'block';
                smartBtn.innerHTML = `🎯 Akıllı Kur (${this.lastSuggestedSmartMinutes} dk)<br><small>Aktif öğüne göre</small>`;
            } else {
                smartBtn.style.display = 'none';
            }
        }

        if (!this.timerState.endTimestamp) {
            pill?.classList.remove('running', 'completed');
            if (pillText) pillText.textContent = '⏱️ Sayaç';
            if (clockElem) clockElem.textContent = '00:00';
            if (statusElem) statusElem.textContent = 'Aktif sayaç yok. Aşağıdan tek tıkla başlatabilirsiniz.';
            if (cancelBtn) cancelBtn.style.display = 'none';
            return;
        }

        const remainingMs = this.timerState.endTimestamp - Date.now();
        if (cancelBtn) cancelBtn.style.display = 'block';

        if (remainingMs > 0) {
            const formatted = this.formatCountdownMs(remainingMs);
            pill?.classList.add('running');
            pill?.classList.remove('completed');
            if (pillText) pillText.textContent = `⏳ ${formatted}`;
            if (clockElem) clockElem.textContent = formatted;
            const targetTime = new Date(this.timerState.endTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (statusElem) statusElem.textContent = `${this.timerState.label} · Güvenli saat: ${targetTime}`;
        } else {
            pill?.classList.remove('running');
            pill?.classList.add('completed');
            if (pillText) pillText.textContent = '✅ Pencere Açık!';
            if (clockElem) clockElem.textContent = '00:00';
            if (statusElem) statusElem.textContent = '✅ Emilim penceresi tamamlandı! Çay veya kahvenizi güvenle tüketebilirsiniz.';

            if (!this.timerState.notifiedComplete) {
                this.timerState.notifiedComplete = true;
                this.saveSetting('circadia_timer_state', this.timerState);
                this.openTimerModal();
            }
        }
    }

    // =========================================================================
    // YEDEKLEME & GERİ YÜKLEME (v1 / v2 / v3 Uyumlu)
    // =========================================================================
    exportData() {
        const payload = {
            version: '3.0',
            exportDate: new Date().toISOString(),
            history: this.drinkHistory,
            meals: this.mealHistory,
            supplements: this.supplementHistory,
            nutritionProfile: this.nutritionProfile,
            dailyWindowMode: this.dailyWindowMode,
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
                if (!Array.isArray(data.history)) {
                    throw new Error('Geçersiz dosya biçimi.');
                }

                const validatedHistory: DrinkRecord[] = [];
                for (const item of data.history) {
                    if (typeof item.id === 'number' && typeof item.caffeineMg === 'number' && typeof item.timestamp === 'number') {
                        validatedHistory.push({
                            id: item.id,
                            drinkId: typeof item.drinkId === 'string' ? item.drinkId.slice(0, 50) : undefined,
                            name: String(item.name || 'İçecek').slice(0, 120),
                            caffeineMg: Math.max(0, Math.min(2000, item.caffeineMg)),
                            polyphenolMg: typeof item.polyphenolMg === 'number' ? Math.max(0, Math.min(2000, item.polyphenolMg)) : undefined,
                            hasMilk: Boolean(item.hasMilk),
                            effectiveHalfLife: typeof item.effectiveHalfLife === 'number'
                                ? Math.max(0.5, Math.min(24, item.effectiveHalfLife))
                                : undefined,
                            timestamp: item.timestamp,
                            stomachState: item.stomachState === 'full' ? 'full' : 'empty'
                        });
                    }
                }

                await this.db.clear('history');
                for (const record of validatedHistory) {
                    await this.db.put('history', record);
                }

                // İsteğe bağlı öğün kayıtları
                if (Array.isArray(data.meals)) {
                    await this.db.clear('meals');
                    for (const m of data.meals) {
                        if (typeof m.id === 'number' && typeof m.timestamp === 'number') {
                            const mealType: MealType = ['breakfast', 'lunch', 'dinner', 'snack'].includes(m.mealType) ? m.mealType : 'lunch';
                            const matrixType: MealMatrixType = ['plant', 'animal', 'mixed'].includes(m.matrixType) ? m.matrixType : 'plant';
                            await this.db.put('meals', {
                                id: m.id,
                                mealType,
                                matrixType,
                                hasVitaminC: Boolean(m.hasVitaminC),
                                timestamp: m.timestamp,
                                label: String(m.label || MEAL_LABELS[mealType]).slice(0, 80)
                            });
                        }
                    }
                }

                // İsteğe bağlı takviye kayıtları
                if (Array.isArray(data.supplements)) {
                    await this.db.clear('supplements');
                    for (const s of data.supplements) {
                        if (typeof s.id === 'number' && typeof s.timestamp === 'number') {
                            const supplementType: SupplementType = ['iron', 'folate', 'thiamine', 'calcium'].includes(s.supplementType)
                                ? s.supplementType
                                : 'iron';
                            await this.db.put('supplements', {
                                id: s.id,
                                supplementType,
                                timestamp: s.timestamp,
                                label: String(s.label || SUPPLEMENT_LABELS[supplementType]).slice(0, 80)
                            });
                        }
                    }
                }

                if (data.nutritionProfile && typeof data.nutritionProfile === 'object') {
                    await this.saveSetting('circadia_nutrition_profile', {
                        dietType: ['omnivore', 'vegetarian', 'vegan'].includes(data.nutritionProfile.dietType) ? data.nutritionProfile.dietType : 'omnivore',
                        specialCondition: ['none', 'ida_risk', 'pregnant', 'postmenopausal', 'iron_overload'].includes(data.nutritionProfile.specialCondition) ? data.nutritionProfile.specialCondition : 'none',
                        calciumIntakeLevel: ['low', 'moderate', 'adequate'].includes(data.nutritionProfile.calciumIntakeLevel) ? data.nutritionProfile.calciumIntakeLevel : 'adequate'
                    });
                }

                if (data.dailyWindowMode && ['midnight', 'rolling24h'].includes(data.dailyWindowMode)) {
                    await this.saveSetting('circadia_daily_window', data.dailyWindowMode);
                }
                if (typeof data.weightKg === 'number') {
                    await this.saveSetting('circadia_weight', Math.max(30, Math.min(250, data.weightKg)));
                }
                if (typeof data.cigsPerDay === 'number') {
                    await this.saveSetting('circadia_cigs', Math.max(0, Math.min(60, data.cigsPerDay)));
                }
                if (data.toleranceKey && ['LOW', 'MEDIUM', 'HIGH'].includes(data.toleranceKey)) {
                    await this.saveSetting('circadia_tolerance', data.toleranceKey);
                }
                if (data.isQuit !== undefined) await this.saveSetting('circadia_is_quit', Boolean(data.isQuit));
                if (typeof data.daysQuit === 'number') {
                    await this.saveSetting('circadia_days_quit', Math.max(1, Math.min(14, data.daysQuit)));
                }
                if (typeof data.priorCigs === 'number') {
                    await this.saveSetting('circadia_prior_cigs', Math.max(1, Math.min(60, data.priorCigs)));
                }
                if (data.isOCP !== undefined) await this.saveSetting('circadia_is_ocp', Boolean(data.isOCP));
                if (data.isRedShift !== undefined) await this.saveSetting('circadia_red_shift', Boolean(data.isRedShift));

                alert('✅ Veriler başarıyla doğrulandı ve geri yüklendi!');
                location.reload();
            } catch {
                alert('⚠️ Geçersiz veya bozuk yedek dosyası!');
            }
        };
        reader.readAsText(file);
    }

    applyRedShift() {
        const metaTheme = document.getElementById('meta-theme-color');
        const btnRedShift = document.getElementById('btn-red-shift');
        if (this.isRedShift) {
            document.body.classList.add('red-shift');
            if (metaTheme) metaTheme.setAttribute('content', '#000000');
            if (btnRedShift) {
                btnRedShift.textContent = '☀️ Normal Mod';
                btnRedShift.setAttribute('aria-pressed', 'true');
            }
        } else {
            document.body.classList.remove('red-shift');
            if (metaTheme) metaTheme.setAttribute('content', '#0b0f17');
            if (btnRedShift) {
                btnRedShift.textContent = '🔴 Gece Modu';
                btnRedShift.setAttribute('aria-pressed', 'false');
            }
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

    formatSleepTime(timeMs: number, now: number): string {
        if (timeMs <= now) return 'Şu An';
        const maxTime = now + (36 * 60 * 60 * 1000);
        if (timeMs >= maxTime - 60000) return '> 36 Saat';

        const d = new Date(timeMs);
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');

        const nowDate = new Date(now);
        const isSameDay = d.toDateString() === nowDate.toDateString();

        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = d.toDateString() === tomorrow.toDateString();

        if (isSameDay) return `${h}:${m}`;
        if (isTomorrow) return `Yarın ${h}:${m}`;
        return `${d.getDate()}/${d.getMonth() + 1} ${h}:${m}`;
    }

    // =========================================================================
    // KAYIT EKLEME & SİLME (İçecek, İsteğe Bağlı Öğün & Takviye)
    // =========================================================================
    async addDrink() {
        const accordion = document.getElementById('custom-drink-details') as HTMLDetailsElement | null;
        const customNameElem = document.getElementById('input-custom-name') as HTMLInputElement | null;
        const customMgElem = document.getElementById('input-custom-mg') as HTMLInputElement | null;

        let finalCaffeine = 0;
        let finalPolyphenol = 0;
        let drinkName = '';
        let drinkId: string | undefined;
        let hasMilk = false;

        const hasCustomName = customNameElem && customNameElem.value.trim() !== '';
        const hasCustomMg = customMgElem && customMgElem.value.trim() !== '';

        if (accordion && accordion.open && (hasCustomName || hasCustomMg)) {
            if (!hasCustomName || !hasCustomMg) {
                alert('⚠️ Lütfen hem özel içeceğin adını hem de kafein miktarını (mg) eksiksiz giriniz.');
                return;
            }
            const mgVal = parseInt(customMgElem!.value, 10);
            if (isNaN(mgVal) || mgVal < 0 || mgVal > 1500) {
                alert('⚠️ Kafein miktarı 0 ile 1500 mg arasında geçerli bir sayı olmalıdır.');
                return;
            }
            drinkName = customNameElem!.value.trim();
            finalCaffeine = mgVal;
            customNameElem!.value = '';
            customMgElem!.value = '';
            accordion.open = false;
        } else {
            const cupSelect = document.getElementById('select-cup') as HTMLSelectElement | null;
            const milkChk = document.getElementById('chk-drink-milk') as HTMLInputElement | null;
            const drinkObj = this.getSelectedDrink();
            const serving = getServing(drinkObj, cupSelect?.value);

            finalCaffeine = calculateCaffeineMg(drinkObj, serving);
            finalPolyphenol = calculatePolyphenolMg(drinkObj, serving);
            drinkId = drinkObj.id;
            hasMilk = Boolean(milkChk?.checked) || isIntrinsicMilkDrink(drinkObj);

            const milkTag = milkChk?.checked && drinkObj.polyphenols.supportsMilkModifier ? ' · Sütlü' : '';
            drinkName = `${drinkObj.name} (${serving.label}${milkTag})`;
        }

        const recordTimestamp = this.resolveSelectedDrinkTimestamp();
        const stomachState = ((document.querySelector('input[name="stomach-state"]:checked') as HTMLInputElement | null)?.value === 'full')
            ? 'full'
            : 'empty';

        const currentHalfLife = this.pk.calculateEffectiveHalfLife(
            this.cigsPerDay,
            this.isQuit,
            this.daysQuit,
            this.priorCigs,
            this.isOCP,
            this.isPregnantProfile
        );

        const newRecord: DrinkRecord = {
            id: Date.now(),
            drinkId,
            name: drinkName + (stomachState === 'full' ? ' [Tok]' : ''),
            caffeineMg: finalCaffeine,
            polyphenolMg: finalPolyphenol,
            hasMilk,
            effectiveHalfLife: currentHalfLife,
            timestamp: recordTimestamp,
            stomachState
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

    async addMeal() {
        const typeSelect = document.getElementById('select-meal-type') as HTMLSelectElement | null;
        const offsetSelect = document.getElementById('select-meal-offset') as HTMLSelectElement | null;
        const matrixSelect = document.getElementById('select-meal-matrix') as HTMLSelectElement | null;
        const vitcChk = document.getElementById('chk-meal-vitc') as HTMLInputElement | null;

        const mealType = (typeSelect?.value || 'lunch') as MealType;
        const matrixType = (matrixSelect?.value || 'plant') as MealMatrixType;
        const offsetMin = parseInt(offsetSelect?.value || '0', 10) || 0;
        const hasVitaminC = Boolean(vitcChk?.checked);
        const timestamp = Date.now() - (offsetMin * 60 * 1000);

        const matrixBadge = matrixType === 'animal' ? 'Et/Hem' : matrixType === 'mixed' ? 'Karma' : 'Bitkisel';
        const vitTag = hasVitaminC ? ' + C Vit' : '';

        const record: MealRecord = {
            id: Date.now(),
            mealType,
            matrixType,
            hasVitaminC,
            timestamp,
            label: `${MEAL_LABELS[mealType]} (${matrixBadge}${vitTag})`
        };

        this.mealHistory.push(record);
        await this.db.put('meals', record);
        if (vitcChk) vitcChk.checked = false;

        // Öğün sonrası non-hem demir hassasiyeti varsa ve sayaç boşsa otomatik geri sayım başlat
        if (matrixType !== 'animal' && this.nutritionProfile.specialCondition !== 'iron_overload') {
            const targetMins = (this.nutritionProfile.specialCondition === 'ida_risk'
                || this.nutritionProfile.specialCondition === 'pregnant'
                || this.nutritionProfile.dietType !== 'omnivore') ? 90 : 60;
            const remaining = Math.max(0, targetMins - offsetMin);
            if (remaining > 0 && !this.timerState.endTimestamp) {
                await this.startInAppTimer(remaining, `${MEAL_LABELS[mealType]} Sonrası Emilim Koruma`);
            }
        }

        this.renderAll();
    }

    async deleteMeal(id: number) {
        this.mealHistory = this.mealHistory.filter(m => m.id !== id);
        await this.db.delete('meals', id);
        this.renderAll();
    }

    async addSupplement() {
        const typeSelect = document.getElementById('select-supp-type') as HTMLSelectElement | null;
        const offsetSelect = document.getElementById('select-supp-offset') as HTMLSelectElement | null;

        const supplementType = (typeSelect?.value || 'iron') as SupplementType;
        const offsetMin = parseInt(offsetSelect?.value || '0', 10) || 0;
        const timestamp = Date.now() - (offsetMin * 60 * 1000);

        const record: SupplementRecord = {
            id: Date.now(),
            supplementType,
            timestamp,
            label: SUPPLEMENT_LABELS[supplementType]
        };

        this.supplementHistory.push(record);
        await this.db.put('supplements', record);

        const remaining = Math.max(0, 120 - offsetMin);
        if (remaining > 0 && !this.timerState.endTimestamp && this.nutritionProfile.specialCondition !== 'iron_overload') {
            await this.startInAppTimer(remaining, `${SUPPLEMENT_LABELS[supplementType]} Emilim Penceresi`);
        }

        this.renderAll();
    }

    async deleteSupplement(id: number) {
        this.supplementHistory = this.supplementHistory.filter(s => s.id !== id);
        await this.db.delete('supplements', id);
        this.renderAll();
    }

    // =========================================================================
    // ANA RENDER DÖNGÜSÜ
    // =========================================================================
    renderAll() {
        const now = Date.now();
        const isPregnant = this.isPregnantProfile;

        // 1. Kümülatif Kafein Alımı (Gece Yarısı & Son 24 Saat Kayan Pencere)
        const intake = this.tolerance.calculateCumulativeIntake(this.drinkHistory, now, this.dailyWindowMode);
        const dailyLimit = isPregnant ? 200 : 400;

        const dailyLabel = document.getElementById('daily-caffeine-label');
        const dailyElem = document.getElementById('daily-caffeine');
        const rollingNote = document.getElementById('rolling-caffeine-note');

        if (dailyLabel) {
            dailyLabel.textContent = this.dailyWindowMode === 'rolling24h'
                ? 'Son 24 Saat Toplam'
                : 'Bugünkü Toplam Alım';
        }
        if (dailyElem) {
            dailyElem.textContent = `${intake.activeWindowMg} mg`;
            dailyElem.style.color = intake.activeWindowMg >= dailyLimit ? 'var(--warning)' : 'var(--primary)';
        }
        if (rollingNote) {
            rollingNote.textContent = this.dailyWindowMode === 'rolling24h'
                ? `Bugün (00:00'dan beri): ${intake.midnightMg} mg · Sınır: ${dailyLimit} mg`
                : `Son 24 sa (nöbet penceresi): ${intake.rolling24hMg} mg · Sınır: ${dailyLimit} mg`;
        }

        // 2. Anlık Sistemik Aktif Yük (mg) & Plazma Konsantrasyonu (mg/L)
        const activeCaffeineRaw = this.pk.getTotalActiveCaffeine(
            this.drinkHistory,
            now,
            this.cigsPerDay,
            this.isQuit,
            this.daysQuit,
            this.priorCigs,
            this.isOCP,
            isPregnant
        );
        const activeCaffeine = Math.round(activeCaffeineRaw);
        const plasmaMgL = this.pk.calculatePlasmaConcentrationMgL(activeCaffeineRaw, this.weightKg);

        const activeElem = document.getElementById('active-caffeine');
        if (activeElem) activeElem.textContent = `${activeCaffeine} mg`;

        const plasmaElem = document.getElementById('plasma-concentration');
        if (plasmaElem) {
            plasmaElem.textContent = `~${plasmaMgL.toFixed(1).replace('.', ',')} mg/L tahmini plazma`;
        }

        // 3. Klinik Sağlık Pankartı (Kayan 24s ve günlük toplamın büyüğü üzerinden güvenli değerlendirme)
        const safetyCumulativeMg = Math.max(intake.midnightMg, intake.rolling24hMg);
        const healthStatus = this.tolerance.getHealthStatus(activeCaffeine, this.weightKg, safetyCumulativeMg, isPregnant);
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

        // 4. Uyarılma Durumu
        const stimStatus = this.tolerance.getStimulationStatus(activeCaffeine);
        const stimElem = document.getElementById('stimulation-status');
        if (stimElem) {
            stimElem.textContent = stimStatus.isStimulated
                ? `⚡ Aktif Odak Modu (Eşik: ${stimStatus.thresholdMg} mg)`
                : `🌙 Eşik Altında (Odak için +${stimStatus.deficitMg} mg gerekli)`;
        }

        // 5. İkili Uyku Tahmini & Seçili İçecek Canlı Önizleme
        const sleepThreshold = this.tolerance.currentTolerance.sleepThresholdMg;
        const effHalfLifeNum = this.pk.calculateEffectiveHalfLife(
            this.cigsPerDay,
            this.isQuit,
            this.daysQuit,
            this.priorCigs,
            this.isOCP,
            isPregnant
        );

        const sleepTimeMs = this.pk.estimateTimeToThreshold(
            this.drinkHistory,
            sleepThreshold,
            this.cigsPerDay,
            this.isQuit,
            this.daysQuit,
            this.priorCigs,
            this.isOCP,
            isPregnant,
            now
        );

        const sleepElem = document.getElementById('sleep-time');
        if (sleepElem) sleepElem.textContent = this.formatSleepTime(sleepTimeMs, now);

        const selectedDrink = this.getSelectedDrink();
        const cupSelect = document.getElementById('select-cup') as HTMLSelectElement | null;
        const selectedServing = getServing(selectedDrink, cupSelect?.value);
        const milkChk = document.getElementById('chk-drink-milk') as HTMLInputElement | null;
        const hasAddedMilk = Boolean(milkChk?.checked);

        const simCaffeine = calculateCaffeineMg(selectedDrink, selectedServing);
        const simPolyphenol = calculatePolyphenolMg(selectedDrink, selectedServing);
        const candidateTime = this.resolveSelectedDrinkTimestamp(now);

        const simSleepElem = document.getElementById('sleep-time-simulated');
        let simSleepTimeMs = sleepTimeMs;
        if (simSleepElem) {
            const simulatedHistory: DrinkRecord[] = [
                ...this.drinkHistory,
                {
                    id: 999999,
                    name: 'Sim',
                    caffeineMg: simCaffeine,
                    effectiveHalfLife: effHalfLifeNum,
                    timestamp: now
                }
            ];
            simSleepTimeMs = this.pk.estimateTimeToThreshold(
                simulatedHistory,
                sleepThreshold,
                this.cigsPerDay,
                this.isQuit,
                this.daysQuit,
                this.priorCigs,
                this.isOCP,
                isPregnant,
                now
            );
            simSleepElem.textContent = this.formatSleepTime(simSleepTimeMs, now);
        }

        // Canlı Miktar, (USDA | TÜRKOMP) Karşılaştırması ve Emilim Önizleme Kutusu
        const prevCafElem = document.getElementById('preview-caffeine-mg');
        const prevPolyElem = document.getElementById('preview-polyphenol-badge');
        const prevSrcElem = document.getElementById('preview-source-compare');
        const prevSingleWarn = document.getElementById('preview-single-dose-warn');
        const prevAbsAlert = document.getElementById('preview-absorption-alert');

        if (prevCafElem) {
            prevCafElem.textContent = `Hesaplanan Doz: ${simCaffeine} mg kafein`;
        }
        if (prevPolyElem) {
            prevPolyElem.textContent = simPolyphenol > 0
                ? `~${simPolyphenol} mg polifenol (${selectedDrink.polyphenols.ironInhibitionClass === 'NONE' ? 'Düşük tanen' : 'Tanen/Fenolik'})`
                : '0 mg polifenol (Tanensiz)';
        }
        if (prevSrcElem) {
            prevSrcElem.textContent = `Kaynak Karşılaştırması ${formatSourceComparison(selectedDrink)}`;
        }
        if (prevSingleWarn) {
            const doseCheck = this.tolerance.checkSingleDose(simCaffeine, this.weightKg, isPregnant);
            if (doseCheck.exceedsLimit && doseCheck.message) {
                prevSingleWarn.style.display = 'block';
                prevSingleWarn.textContent = `⚡ ${doseCheck.message}`;
            } else {
                prevSingleWarn.style.display = 'none';
            }
        }

        // Besin Emilimi Değerlendirmesi (Öğün girilmemişse hiçbir uyarı göstermez)
        const absEval = this.absorption.evaluateDrinkCandidate(
            selectedDrink,
            selectedServing,
            candidateTime,
            hasAddedMilk,
            this.mealHistory,
            this.supplementHistory,
            this.nutritionProfile
        );

        if (prevAbsAlert) {
            if (absEval.hasMealOrSupplementData && absEval.collisions.length > 0) {
                const top = absEval.collisions[0];
                prevAbsAlert.style.display = 'block';
                prevAbsAlert.className = `absorption-preview-alert sev-${absEval.overallSeverity}`;
                const safeHeadline = escapeHtml(top.headline);
                const safeMech = escapeHtml(top.mechanismNote);
                const safeTip = absEval.mitigationTips[0] ? `<div style="margin-top:4px; opacity:0.9;">💡 ${escapeHtml(absEval.mitigationTips[0])}</div>` : '';
                const timerBtn = top.waitMoreMinutes > 0
                    ? `<button type="button" class="btn-secondary btn-inline-timer" data-mins="${top.waitMoreMinutes}" style="margin-top:6px; padding:6px 10px !important;">⏱️ ${top.waitMoreMinutes} dk Geri Sayım Başlat</button>`
                    : '';
                prevAbsAlert.innerHTML = `<strong>${safeHeadline}</strong><div>${safeMech}</div>${safeTip}${timerBtn}`;
            } else if (absEval.hasMealOrSupplementData) {
                prevAbsAlert.style.display = 'block';
                prevAbsAlert.className = 'absorption-preview-alert sev-NONE';
                prevAbsAlert.textContent = absEval.summaryMessage;
            } else {
                prevAbsAlert.style.display = 'none';
            }
        }

        // Optimal İçecek Penceresi Özeti
        const optWin = this.absorption.getNextOptimalDrinkWindow(
            now,
            selectedDrink,
            selectedServing,
            hasAddedMilk,
            this.mealHistory,
            this.supplementHistory,
            this.nutritionProfile,
            undefined,
            simSleepTimeMs
        );
        this.lastSuggestedSmartMinutes = optWin.waitMinutesForMeals;
        const optChip = document.getElementById('optimal-window-summary');
        if (optChip) {
            if (absEval.hasMealOrSupplementData) {
                optChip.style.display = 'block';
                optChip.textContent = optWin.recommendationText;
            } else {
                optChip.style.display = 'none';
            }
        }

        // Mobil Emilim Sekmesi Rozeti & İçecek Kayıt Sayısı
        const totalNutritionItems = this.mealHistory.length + this.supplementHistory.length;
        const mobBadge = document.getElementById('mobile-nutrition-badge');
        if (mobBadge) {
            if (totalNutritionItems > 0) {
                mobBadge.style.display = 'inline-flex';
                mobBadge.textContent = totalNutritionItems.toString();
            } else {
                mobBadge.style.display = 'none';
            }
        }
        const drinkCountChip = document.getElementById('drink-history-count');
        if (drinkCountChip) {
            drinkCountChip.textContent = `${this.drinkHistory.length} kayıt`;
        }

        // 6. Kalsiyum & VDR Dengesi Kutusu
        const caEval = this.absorption.evaluateDailyCalciumBalance(this.drinkHistory, now, this.nutritionProfile);
        const caHead = document.getElementById('calcium-headline');
        const caDesc = document.getElementById('calcium-detail');
        if (caHead) {
            caHead.textContent = caEval.headline;
            caHead.style.color = caEval.vdrSuppressionRisk === 'HIGH'
                ? 'var(--danger)'
                : caEval.vdrSuppressionRisk === 'MODERATE'
                    ? 'var(--warning)'
                    : 'var(--primary)';
        }
        if (caDesc) {
            const milkInfo = caEval.milkServingsCount > 0
                ? ` (${caEval.milkServingsCount} sütlü porsiyon ile ~+${caEval.estimatedMilkCaOffsetMg} mg Ca telafisi hesaplandı.)`
                : '';
            caDesc.textContent = caEval.detail + milkInfo;
        }

        // 7. Adenozin Rebound (Yalnızca kafeinli içecek geçmişine bakar; bitki çayı yanıltmaz!)
        const caffeinatedDrinks = this.drinkHistory.filter(d => d.caffeineMg > 0);
        const lastCaffeinated = caffeinatedDrinks.length > 0
            ? [...caffeinatedDrinks].sort((a, b) => b.timestamp - a.timestamp)[0]
            : null;
        const withdrawalInfo = this.tolerance.checkWithdrawalRisk(activeCaffeine, lastCaffeinated ? lastCaffeinated.timestamp : null);
        const withdrawalElem = document.getElementById('withdrawal-msg');
        if (withdrawalElem) withdrawalElem.textContent = withdrawalInfo.message;

        // 8. CYP1A2 Enzim Başlığı
        const effHalfLife = effHalfLifeNum.toFixed(1);
        const cypElem = document.getElementById('cyp-status');
        if (cypElem) {
            const modTags = [
                this.isOCP ? 'OCP (~2x)' : '',
                isPregnant ? 'Gebelik CYP1A2↓' : ''
            ].filter(Boolean).join(' + ');
            const suffix = modTags ? ` · ${modTags}` : '';
            if (this.cigsPerDay === 0 && this.isQuit && this.daysQuit < 14) {
                cypElem.textContent = `🚭 Sigara Bırakıldı (Gün ${this.daysQuit}/14): Yarı Ömür ${effHalfLife} sa${suffix}`;
            } else {
                cypElem.textContent = `CYP1A2: Yarı Ömür ${effHalfLife} sa (${this.cigsPerDay} Sigara/Gün)${suffix}`;
            }
        }

        // 9. Grafik Çizimi & Emilim Penceresi Lejantı
        const chartLegend = document.getElementById('chart-window-legend');
        if (chartLegend) {
            chartLegend.style.display = totalNutritionItems > 0 ? 'inline-block' : 'none';
        }
        if (this.chart) {
            this.chart.render(
                this.pk,
                this.drinkHistory,
                this.cigsPerDay,
                this.tolerance.currentTolerance.thresholdMg,
                sleepThreshold,
                this.isQuit,
                this.daysQuit,
                this.priorCigs,
                this.isOCP,
                isPregnant,
                this.mealHistory,
                this.supplementHistory
            );
        }

        // 10. İçecek Geçmişi Listesi (XSS Güvenli)
        this.renderDrinkHistoryList();
        // 11. İsteğe Bağlı Öğün & Takviye Listesi
        this.renderNutritionHistoryList();
        this.tickTimer();
    }

    private splitDrinkTitleAndMeta(rawName: string, polyphenolMg?: number): { title: string; meta: string } {
        const lastOpenIdx = rawName.lastIndexOf(' (');
        let title = rawName;
        const metaParts: string[] = [];

        if (lastOpenIdx > 0 && (rawName.endsWith(')') || rawName.endsWith(') [Tok]'))) {
            const isFullTag = rawName.endsWith(' [Tok]');
            const cleaned = isFullTag ? rawName.slice(0, -6) : rawName;
            const idx = cleaned.lastIndexOf(' (');
            if (idx > 0 && cleaned.endsWith(')')) {
                title = cleaned.slice(0, idx);
                metaParts.push(cleaned.slice(idx + 2, -1));
                if (isFullTag) metaParts.push('Tok karnına');
            }
        }

        if (polyphenolMg && polyphenolMg > 0) {
            metaParts.push(`~${polyphenolMg} mg polifenol`);
        }

        return { title, meta: metaParts.join(' · ') };
    }

    private renderDrinkHistoryList() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        if (this.drinkHistory.length === 0) {
            historyList.innerHTML = '<li class="empty-history-note">Henüz içecek eklenmedi.</li>';
            return;
        }

        historyList.innerHTML = [...this.drinkHistory]
            .sort((a, b) => b.timestamp - a.timestamp)
            .map(item => {
                const d = new Date(item.timestamp);
                const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                const { title, meta } = this.splitDrinkTitleAndMeta(item.name, item.polyphenolMg);
                const safeFull = escapeHtml(item.name);
                const safeTitle = escapeHtml(title);
                const safeMeta = meta ? `<span class="history-meta">${escapeHtml(meta)}</span>` : '';
                return `
                    <li class="history-item">
                        <div class="history-info">
                            <span class="history-time">${timeStr}</span>
                            <div class="history-text">
                                <span class="history-title">${safeTitle}</span>
                                ${safeMeta}
                            </div>
                        </div>
                        <div class="history-actions">
                            <span class="history-mg-badge">+${item.caffeineMg} mg</span>
                            <button type="button" class="btn-delete" data-id="${item.id}" title="Kaydı Sil" aria-label="${safeFull} kaydını sil">✕</button>
                        </div>
                    </li>
                `;
            }).join('');
    }

    private renderNutritionHistoryList() {
        const listElem = document.getElementById('nutrition-history-list');
        if (!listElem) return;

        const combined = [
            ...this.mealHistory.map(m => ({ id: m.id, kind: 'meal' as const, timestamp: m.timestamp, label: m.label, icon: '🍽️' })),
            ...this.supplementHistory.map(s => ({ id: s.id, kind: 'supplement' as const, timestamp: s.timestamp, label: s.label, icon: '💊' }))
        ].sort((a, b) => b.timestamp - a.timestamp);

        if (combined.length === 0) {
            listElem.innerHTML = '<li class="empty-history-note">Kayıtlı öğün veya takviye yok (isteğe bağlı).</li>';
            return;
        }

        listElem.innerHTML = combined.map(item => {
            const d = new Date(item.timestamp);
            const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            const safeLabel = escapeHtml(item.label);
            return `
                <li class="history-item">
                    <div class="history-info">
                        <span class="history-time">${timeStr}</span>
                        <div class="history-text">
                            <span class="history-title">${item.icon} ${safeLabel}</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        <button type="button" class="btn-delete" data-kind="${item.kind}" data-id="${item.id}" title="Kaydı Sil" aria-label="${safeLabel} kaydını sil">✕</button>
                    </div>
                </li>
            `;
        }).join('');
    }
}

window.addEventListener('DOMContentLoaded', () => new CircadiaApp());