// src/db/drinkDatabase.ts
/**
 * @file drinkDatabase.ts
 * @description Kaynaklı içecek, kafein, polifenol/tanen ve farmakopeik biyoaktif veritabanı.
 *
 * Miktar modeli:
 *  - `volume`: Kafein ve polifenol miktarı hacimle (ml) doğrusal ölçeklenir (`mg / 100 ml`).
 *  - `count` : Kafein ve polifenol miktarı doz biriminden gelir (shot, kaşık, gram, paket, fincan, tablet).
 *              Su veya süt eklemek baz kafein dozunu değiştirmez (`mg / birim`).
 *
 * Veri Kaynakları & Standartlar:
 *  - USDA FoodData Central (SR Legacy 2018-04 & FNDDS 2024-10, mg/100 g).
 *  - TÜRKOMP (Ulusal Gıda Kompozisyon Veri Tabanı).
 *  - Avrupa Farmakopesi (Ph. Eur. 10.0 / 11.0, Genel Monograf 1434 "Plantae ad ptisanam" ve drog monografları).
 *  - EMA/HMPC, ESCOP ve WHO monografları: demleme ekstraksiyon kinetiği ve porsiyon başına net biyoaktif miktarları.
 *  - Polifenol ve emilim inhibisyonu: Hurrell et al. (1999), Morck et al. (1983), Ahmad Fuzi et al. (2017).
 */

export type DoseMode = 'volume' | 'count';

export type ValueBasis = 'USDA' | 'USDA (yakın eşdeğer)' | 'Akademik HPLC' | 'Farmakope / EMA Monografı' | 'Etiket' | 'Etiket / Formülasyon Analizi';

export type IronInhibitionClass = 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'NONE';

export type InteractionLevel = 'HIGH' | 'MODERATE' | 'NONE';

export type DrinkCategoryGroup = 'all' | 'favorites' | 'coffee' | 'tea' | 'mono_herbal' | 'blend' | 'energy';

export interface ServingOption {
    id: string;
    label: string;
    /** volume modunda ml, count modunda birim adedi */
    amount: number;
}

export interface SourceValue {
    value: number | null;
    unit: 'mg/100 g' | 'mg/100 ml';
    ref: string;
    note?: string;
}

export interface DrinkSources {
    usda: SourceValue;
    turkomp: SourceValue;
}

export interface PolyphenolProfile {
    /** volume modunda mg/100 ml; count modunda mg/birim */
    polyphenolMgPerUnit: number;
    ironInhibitionClass: IronInhibitionClass;
    /** Tek öğün izotop çalışmalarındaki referans non-hem demir inhibisyon aralığı (%) */
    referenceInhibitionPct: [number, number];
    dominantCompounds: string;
    folateInteraction: InteractionLevel;
    thiamineInteraction: InteractionLevel;
    supportsMilkModifier: boolean;
}

export interface BioactiveProfile {
    /** Kupa / porsiyon başına düşen primer etken maddeler (mg) */
    primaryActives: string;
    /** Sekonder matris ve yardımcı biyoaktifler */
    secondaryActives?: string;
    /** Form/laksatif çayları için kümülatif antranoid glikoziti (mg) */
    anthranoidsMg?: number;
    /** Rezene/anason için mikrogram estragol (µg) - EMA sınırı 50 µg/gün */
    estragolUg?: number;
    /** Tıbbi adaçayı için tuyon miktarı (mg) */
    thujoneMg?: number;
    /** Granül çaylar için ilave serbest şeker (g) */
    sugarG?: number;
    /** Porsiyon kalorisi (kcal) */
    caloriesKcal?: number;
    /** Kritik klinik veya regülatör güvenlik uyarısı */
    clinicalSafetyAlert?: string;
}

export interface Drink {
    id: string;
    name: string;
    category: string;
    categoryGroup: 'coffee' | 'tea' | 'mono_herbal' | 'blend' | 'energy';
    mode: DoseMode;
    /** volume: mg / 100 ml — count: mg / birim */
    caffeineMgPerUnit: number;
    /** Gösterim birimi (ml, shot, çay kaşığı, g, paket, fincan, tablet) */
    unitLabel: string;
    servings: ServingOption[];
    defaultServingId: string;
    valueBasis: ValueBasis;
    sources: DrinkSources;
    polyphenols: PolyphenolProfile;
    tags?: string[];
    bioactives?: BioactiveProfile;
}

export const TURKOMP_NO_CAFFEINE: SourceValue = {
    value: null,
    unit: 'mg/100 g',
    ref: 'TÜRKOMP Ulusal Gıda Kompozisyon Veri Tabanı',
    note: 'kafein verisi yok'
};

// --- USDA FoodData Central referansları ---
const USDA_REFS = {
    BREWED: { value: 40, unit: 'mg/100 g', ref: 'FDC 171890 — Coffee, brewed, tap water' },
    ESPRESSO: { value: 212, unit: 'mg/100 g', ref: 'FDC 171891 — Coffee, espresso, restaurant-prepared' },
    LATTE: { value: 36, unit: 'mg/100 g', ref: 'FDC 2710386 — Coffee, Latte (sütlü toplam sıvı)' },
    CAPPUCCINO: { value: 36, unit: 'mg/100 g', ref: 'FDC 2710472 — Coffee, Cappuccino (sütlü toplam sıvı)' },
    MACCHIATO: { value: 142, unit: 'mg/100 g', ref: 'FDC 2710382 — Coffee, macchiato' },
    CUBAN: { value: 199, unit: 'mg/100 g', ref: 'FDC 2710381 — Coffee, Cuban (moka tipi)' },
    TURKISH_PROXY: { value: 37, unit: 'mg/100 g', ref: 'FDC 2710377 — FNDDS tarif tahmini; cezve HPLC ~85 mg/100 ml', note: 'tarif tahmini' },
    COLD_BREW_PROXY: { value: 40, unit: 'mg/100 g', ref: 'FDC 2710375 — Brewed coffee referansı; ticari etiket ~43 mg/100 ml' },
    NITRO_PROXY: { value: null, unit: 'mg/100 ml', ref: 'USDA kaydı yok; ticari etiket ~56 mg/100 ml', note: 'kayıt yok' },
    MENENGIC: { value: 0, unit: 'mg/100 g', ref: 'FDC 2710486 — Coffee substitute (kafeinsiz)' },
    INSTANT_POWDER: { value: 3142, unit: 'mg/100 g', ref: 'FDC 171893 — Coffee, instant, regular, kuru toz (hazır sıvı: 26 mg/100 g)' },
    INSTANT_SWEET_POWDER: { value: 608, unit: 'mg/100 g', ref: 'FDC 2710482 — Instant coffee, pre-sweetened, kuru karışım' },
    INSTANT_3IN1_POWDER: { value: 404, unit: 'mg/100 g', ref: 'FDC 2710483 — Instant coffee, pre-lightened & sweetened, kuru karışım' },
    BLACK_TEA: { value: 20, unit: 'mg/100 g', ref: 'FDC 173227 — Tea, black, brewed (sallama/infüzyon)' },
    GREEN_TEA: { value: 12, unit: 'mg/100 g', ref: 'FDC 171917 — Tea, green, brewed' },
    OOLONG_PROXY: { value: 16, unit: 'mg/100 g', ref: 'FDC 174120 — Tea, Oolong, brewed' },
    HERBAL_ZERO: { value: 0, unit: 'mg/100 g', ref: 'FDC 173232 — Tea, herb, brewed' },
    CHAMOMILE_ZERO: { value: 0, unit: 'mg/100 g', ref: 'FDC 174156 — Tea, herb, chamomile, brewed' },
    HOT_COCOA: { value: 3, unit: 'mg/100 g', ref: 'FDC 2705472 — Hot chocolate / cocoa, hazır içecek (kuru kakao: 230 mg/100 g)' },
    ENERGY: { value: 29, unit: 'mg/100 g', ref: 'FDC 173210 — Energy drink (Red Bull referansı)' },
    COLA: { value: 9, unit: 'mg/100 g', ref: 'FDC 174852 — Carbonated beverage, cola, regular' },
    NO_DIRECT_USDA: { value: null, unit: 'mg/100 g', ref: 'USDA FDC doğrudan kayıt yok', note: 'doğrudan kayıt yok' }
} satisfies Record<string, SourceValue>;

const pairSources = (usda: SourceValue, turkompNote?: string): DrinkSources => ({
    usda,
    turkomp: turkompNote
        ? { ...TURKOMP_NO_CAFFEINE, note: turkompNote }
        : TURKOMP_NO_CAFFEINE
});

// --- Porsiyon Şablonları ---
const COFFEE_CUPS: ServingOption[] = [
    { id: 'small', label: 'Küçük Fincan / Bardak (180 ml)', amount: 180 },
    { id: 'medium', label: 'Orta Kupa (250 ml)', amount: 250 },
    { id: 'large', label: 'Büyük Kupa (350 ml)', amount: 350 },
    { id: 'xl', label: 'XL Termos / Mug (475 ml)', amount: 475 }
];

const TEA_CUPS: ServingOption[] = [
    { id: 'tulip', label: 'İnce Belli Bardak (100 ml)', amount: 100 },
    { id: 'large_tulip', label: 'Büyük Çay Bardağı / Ajda (140 ml)', amount: 140 },
    { id: 'cup', label: 'Fincan (180 ml)', amount: 180 },
    { id: 'mug', label: 'Kupa (250 ml)', amount: 250 },
    { id: 'large_mug', label: 'Büyük Kupa (350 ml)', amount: 350 }
];

const HERBAL_CUPS: ServingOption[] = [
    { id: 'cup', label: 'Fincan (180 ml)', amount: 180 },
    { id: 'mug', label: 'Standart Kupa (250 ml)', amount: 250 },
    { id: 'large_mug', label: 'Büyük Kupa (350 ml)', amount: 350 }
];

const CANS: ServingOption[] = [
    { id: 'can250', label: 'Standart Kutu (250 ml)', amount: 250 },
    { id: 'can355', label: 'Orta Kutu (355 ml)', amount: 355 },
    { id: 'can500', label: 'Büyük Kutu (500 ml)', amount: 500 }
];

const COLA_SIZES: ServingOption[] = [
    { id: 'glass200', label: 'Su Bardağı (200 ml)', amount: 200 },
    { id: 'can330', label: 'Kutu (330 ml)', amount: 330 },
    { id: 'bottle500', label: 'Pet Şişe (500 ml)', amount: 500 }
];

const counts = (unit: string, values: number[]): ServingOption[] =>
    values.map(v => ({ id: `x${v}`, label: `${v.toLocaleString('tr-TR')} ${unit}`, amount: v }));

const SHOTS = counts('shot', [1, 2, 3, 4]);
const ESPRESSO_ML_PER_SHOT = 30;
const ESPRESSO_MG_PER_SHOT = (USDA_REFS.ESPRESSO.value * ESPRESSO_ML_PER_SHOT) / 100; // 63.6 mg (~64 mg)

export const DRINK_DATABASE: Drink[] = [
    // =========================================================================
    // 1. ESPRESSO TABANLI (categoryGroup: 'coffee')
    // =========================================================================
    {
        id: 'espresso',
        name: 'Espresso',
        category: 'Espresso',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: ESPRESSO_MG_PER_SHOT,
        unitLabel: 'shot (30 ml)',
        servings: SHOTS,
        defaultServingId: 'x1',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.ESPRESSO),
        polyphenols: {
            polyphenolMgPerUnit: 90,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [39, 72],
            dominantCompounds: 'Klorojenik asit, kafeik asit, kafein',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'espresso', 'enerji', 'odak', 'hızlı kafein']
    },
    {
        id: 'americano',
        name: 'Americano',
        category: 'Espresso',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: ESPRESSO_MG_PER_SHOT,
        unitLabel: 'shot',
        servings: SHOTS,
        defaultServingId: 'x2',
        valueBasis: 'USDA (yakın eşdeğer)',
        sources: pairSources(USDA_REFS.ESPRESSO),
        polyphenols: {
            polyphenolMgPerUnit: 90,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [39, 72],
            dominantCompounds: 'Klorojenik asit, kafeik asit, kafein',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'americano', 'espresso', 'enerji', 'odak']
    },
    {
        id: 'latte',
        name: 'Latte / Flat White (Sütlü)',
        category: 'Espresso',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: ESPRESSO_MG_PER_SHOT,
        unitLabel: 'shot',
        servings: SHOTS,
        defaultServingId: 'x2',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.LATTE, 'süt için Ca verisi var, kafein verisi yok'),
        polyphenols: {
            polyphenolMgPerUnit: 90,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [50, 78],
            dominantCompounds: 'Klorojenik asit + süt kalsiyumu (DMT1 rekabeti)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: false
        },
        tags: ['kahve', 'latte', 'sütlü', 'flat white', 'espresso']
    },
    {
        id: 'cappuccino',
        name: 'Cappuccino (Sütlü)',
        category: 'Espresso',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: ESPRESSO_MG_PER_SHOT,
        unitLabel: 'shot',
        servings: SHOTS,
        defaultServingId: 'x2',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.CAPPUCCINO, 'süt için Ca verisi var, kafein verisi yok'),
        polyphenols: {
            polyphenolMgPerUnit: 90,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [50, 78],
            dominantCompounds: 'Klorojenik asit + süt kalsiyumu (DMT1 rekabeti)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: false
        },
        tags: ['kahve', 'cappuccino', 'sütlü', 'köpüklü', 'espresso']
    },
    {
        id: 'cortado_macchiato',
        name: 'Cortado / Espresso Macchiato',
        category: 'Espresso',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: ESPRESSO_MG_PER_SHOT,
        unitLabel: 'shot',
        servings: SHOTS,
        defaultServingId: 'x1',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.MACCHIATO),
        polyphenols: {
            polyphenolMgPerUnit: 90,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [45, 75],
            dominantCompounds: 'Klorojenik asit + az süt kalsiyumu',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: false
        },
        tags: ['kahve', 'cortado', 'macchiato', 'sütlü', 'espresso']
    },

    // =========================================================================
    // 2. FİLTRE & MANUEL DEMLEME (categoryGroup: 'coffee')
    // =========================================================================
    {
        id: 'filter_coffee',
        name: 'Filtre / Drip Kahve',
        category: 'Demleme',
        categoryGroup: 'coffee',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.BREWED.value,
        unitLabel: 'ml',
        servings: COFFEE_CUPS,
        defaultServingId: 'medium',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.BREWED),
        polyphenols: {
            polyphenolMgPerUnit: 85,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [39, 72],
            dominantCompounds: 'Klorojenik asit, kafeik asit, kafein',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'filtre kahve', 'drip', 'ofis', 'enerji', 'odak']
    },
    {
        id: 'v60_pour_over',
        name: 'V60 / Chemex Pour-Over',
        category: 'Demleme',
        categoryGroup: 'coffee',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.BREWED.value,
        unitLabel: 'ml',
        servings: COFFEE_CUPS,
        defaultServingId: 'medium',
        valueBasis: 'USDA (yakın eşdeğer)',
        sources: pairSources(USDA_REFS.BREWED),
        polyphenols: {
            polyphenolMgPerUnit: 85,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [39, 72],
            dominantCompounds: 'Klorojenik asit, kafeik asit, kafein',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'v60', 'chemex', 'pour over', 'nitelikli kahve']
    },
    {
        id: 'french_press',
        name: 'French Press Kahve',
        category: 'Demleme',
        categoryGroup: 'coffee',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.BREWED.value,
        unitLabel: 'ml',
        servings: COFFEE_CUPS,
        defaultServingId: 'medium',
        valueBasis: 'USDA (yakın eşdeğer)',
        sources: pairSources(USDA_REFS.BREWED),
        polyphenols: {
            polyphenolMgPerUnit: 90,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [39, 72],
            dominantCompounds: 'Klorojenik asit, kafeik asit, diterpenler',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'french press', 'demleme', 'ev']
    },
    {
        id: 'aeropress',
        name: 'Aeropress Kahve',
        category: 'Demleme',
        categoryGroup: 'coffee',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.BREWED.value,
        unitLabel: 'ml',
        servings: COFFEE_CUPS,
        defaultServingId: 'small',
        valueBasis: 'USDA (yakın eşdeğer)',
        sources: pairSources(USDA_REFS.BREWED),
        polyphenols: {
            polyphenolMgPerUnit: 85,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [39, 72],
            dominantCompounds: 'Klorojenik asit, kafeik asit',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'aeropress', 'demleme']
    },
    {
        id: 'moka_pot',
        name: 'Moka Pot Ekstraktı',
        category: 'Demleme',
        categoryGroup: 'coffee',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.CUBAN.value,
        unitLabel: 'ml',
        servings: [
            { id: 'moka50', label: '1 Moka Fincanı (50 ml)', amount: 50 },
            { id: 'moka100', label: '2 Moka Fincanı (100 ml)', amount: 100 }
        ],
        defaultServingId: 'moka50',
        valueBasis: 'USDA (yakın eşdeğer)',
        sources: pairSources(USDA_REFS.CUBAN),
        polyphenols: {
            polyphenolMgPerUnit: 180,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [45, 75],
            dominantCompounds: 'Yoğun klorojenik asit, kafeik asit, kafein',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'moka pot', 'italyan', 'yoğun']
    },
    {
        id: 'cold_brew',
        name: 'Cold Brew (Soğuk Demleme)',
        category: 'Demleme',
        categoryGroup: 'coffee',
        mode: 'volume',
        caffeineMgPerUnit: 43,
        unitLabel: 'ml',
        servings: COFFEE_CUPS,
        defaultServingId: 'large',
        valueBasis: 'Etiket',
        sources: pairSources(USDA_REFS.COLD_BREW_PROXY),
        polyphenols: {
            polyphenolMgPerUnit: 75,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [39, 70],
            dominantCompounds: 'Klorojenik asit, kafein',
            folateInteraction: 'NONE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'cold brew', 'soğuk kahve', 'yaz']
    },
    {
        id: 'nitro_cold_brew',
        name: 'Nitro Cold Brew',
        category: 'Demleme',
        categoryGroup: 'coffee',
        mode: 'volume',
        caffeineMgPerUnit: 56,
        unitLabel: 'ml',
        servings: COFFEE_CUPS,
        defaultServingId: 'large',
        valueBasis: 'Etiket',
        sources: pairSources(USDA_REFS.NITRO_PROXY),
        polyphenols: {
            polyphenolMgPerUnit: 80,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [39, 70],
            dominantCompounds: 'Klorojenik asit, kafein',
            folateInteraction: 'NONE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'nitro', 'soğuk kahve', 'yüksek kafein']
    },

    // =========================================================================
    // 3. GELENEKSEL & TÜRK KAHVESİ (categoryGroup: 'coffee')
    // =========================================================================
    {
        id: 'turkish_coffee',
        name: 'Türk Kahvesi (Cezve)',
        category: 'Geleneksel',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: 60,
        unitLabel: 'fincan (~65 ml)',
        servings: counts('fincan (~65 ml)', [1, 2, 3]),
        defaultServingId: 'x1',
        valueBasis: 'Akademik HPLC',
        sources: pairSources(USDA_REFS.TURKISH_PROXY, 'kafein verisi yok; cezve HPLC ~60 mg/fincan'),
        polyphenols: {
            polyphenolMgPerUnit: 130,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [50, 78],
            dominantCompounds: 'Filtresiz klorojenik asit, kafeik asit, telve polifenolleri',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'türk kahvesi', 'cezve', 'geleneksel', 'telve']
    },
    {
        id: 'turkish_coffee_double',
        name: 'Duble / Süvari Türk Kahvesi',
        category: 'Geleneksel',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: 115,
        unitLabel: 'duble fincan (~120 ml)',
        servings: counts('duble fincan', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'Akademik HPLC',
        sources: pairSources(USDA_REFS.TURKISH_PROXY, 'kafein verisi yok'),
        polyphenols: {
            polyphenolMgPerUnit: 240,
            ironInhibitionClass: 'VERY_HIGH',
            referenceInhibitionPct: [60, 83],
            dominantCompounds: 'Yüksek doz klorojenik asit, kafeik asit',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: false
        },
        tags: ['kahve', 'duble türk kahvesi', 'süvari', 'geleneksel']
    },
    {
        id: 'dibek_coffee',
        name: 'Dibek Kahvesi',
        category: 'Geleneksel',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: 40,
        unitLabel: 'fincan',
        servings: counts('fincan', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'Etiket',
        sources: pairSources(USDA_REFS.NO_DIRECT_USDA),
        polyphenols: {
            polyphenolMgPerUnit: 90,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [35, 60],
            dominantCompounds: 'Seyreltilmiş kahve polifenolleri, kakule/bitkisel bileşenler',
            folateInteraction: 'NONE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'dibek', 'kakule', 'geleneksel']
    },
    {
        id: 'menengic_coffee',
        name: 'Menengiç Kahvesi (Kafeinsiz)',
        category: 'Geleneksel',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: 0,
        unitLabel: 'fincan',
        servings: counts('fincan', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'USDA (yakın eşdeğer)',
        sources: pairSources(USDA_REFS.MENENGIC),
        polyphenols: {
            polyphenolMgPerUnit: 70,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [30, 55],
            dominantCompounds: 'Pistacia terebinthus flavonoidleri ve fenolik asitler',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'menengiç', 'kafeinsiz', 'çitlembik', 'geleneksel']
    },

    // =========================================================================
    // 4. GRANÜL & HAZIR KAHVELER (categoryGroup: 'coffee')
    // =========================================================================
    {
        id: 'granule_classic',
        name: 'Granül / Çözünebilir Kahve (Classic)',
        category: 'Granül',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: (USDA_REFS.INSTANT_POWDER.value / 100) * 2, // ~63 mg / 2 g kaşık
        unitLabel: 'tepeleme çay kaşığı (~2 g)',
        servings: counts('çay kaşığı (~2 g)', [1, 1.5, 2, 3]),
        defaultServingId: 'x1',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.INSTANT_POWDER),
        polyphenols: {
            polyphenolMgPerUnit: 160,
            ironInhibitionClass: 'VERY_HIGH',
            referenceInhibitionPct: [72, 83],
            dominantCompounds: 'Konsantre klorojenik asit izomerleri, melanoidinler (Morck 1983: %83 blokaj)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'nescafe', 'granül', 'çözünebilir', 'hızlı']
    },
    {
        id: 'granule_gold',
        name: 'Granül Kahve (Gold / Freeze-Dried)',
        category: 'Granül',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: (USDA_REFS.INSTANT_POWDER.value / 100) * 2,
        unitLabel: 'tepeleme çay kaşığı (~2 g)',
        servings: counts('çay kaşığı (~2 g)', [1, 1.5, 2, 3]),
        defaultServingId: 'x1',
        valueBasis: 'USDA (yakın eşdeğer)',
        sources: pairSources(USDA_REFS.INSTANT_POWDER),
        polyphenols: {
            polyphenolMgPerUnit: 155,
            ironInhibitionClass: 'VERY_HIGH',
            referenceInhibitionPct: [70, 83],
            dominantCompounds: 'Klorojenik asit, kafeik asit',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['kahve', 'gold', 'nescafe gold', 'freeze dried', 'granül']
    },
    {
        id: 'granule_2in1',
        name: 'Hazır Kahve (2\'si 1 Arada)',
        category: 'Granül',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: (USDA_REFS.INSTANT_SWEET_POWDER.value / 100) * 10,
        unitLabel: 'paket (~10 g)',
        servings: counts('paket (~10 g)', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.INSTANT_SWEET_POWDER),
        polyphenols: {
            polyphenolMgPerUnit: 130,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [60, 80],
            dominantCompounds: 'Çözünebilir kahve polifenolleri',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['kahve', '2si 1 arada', 'kremalı', 'şekersiz krema']
    },
    {
        id: 'granule_3in1',
        name: 'Hazır Kahve (3\'ü 1 Arada)',
        category: 'Granül',
        categoryGroup: 'coffee',
        mode: 'count',
        caffeineMgPerUnit: (USDA_REFS.INSTANT_3IN1_POWDER.value / 100) * 17.5,
        unitLabel: 'paket (~17,5 g)',
        servings: counts('paket (~17,5 g)', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.INSTANT_3IN1_POWDER),
        polyphenols: {
            polyphenolMgPerUnit: 120,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [60, 80],
            dominantCompounds: 'Çözünebilir kahve polifenolleri',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: false
        },
        tags: ['kahve', '3ü 1 arada', 'şekerli', 'kremalı', 'tatlı']
    },

    // =========================================================================
    // 5. GERÇEK ÇAYLAR (Camellia sinensis & Mate — categoryGroup: 'tea')
    // =========================================================================
    {
        id: 'black_tea_turkish',
        name: 'Demleme Siyah Çay (Çaydanlık / Türk Usulü)',
        category: 'Çaylar',
        categoryGroup: 'tea',
        mode: 'volume',
        caffeineMgPerUnit: 32,
        unitLabel: 'ml',
        servings: TEA_CUPS,
        defaultServingId: 'tulip',
        valueBasis: 'Akademik HPLC',
        sources: pairSources(USDA_REFS.BLACK_TEA, 'kuru çay kodu 11.02.0002 var, kafein verisi yok; TGK kuru çay ≥%1,6'),
        polyphenols: {
            polyphenolMgPerUnit: 135,
            ironInhibitionClass: 'VERY_HIGH',
            referenceInhibitionPct: [59, 94],
            dominantCompounds: 'Tanenler (galloil esterleri), teaflavinler, tearubiginler (%79-94 demir blokajı)',
            folateInteraction: 'HIGH',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['çay', 'türk çayı', 'demleme', 'ince belli', 'siyah çay'],
        bioactives: {
            primaryActives: 'Teaflavinler (15–35 mg), Tearubiginler / Tanenler (70–140 mg), Kafein (32 mg/100 ml)',
            secondaryActives: 'L-Teanin (10–20 mg), rezidüel kateşinler, gallik asit',
            clinicalSafetyAlert: 'Yüksek tanen/polifenol içerir; non-hem demir emilimini %79–94 oranında baskılar. Yemekten 1-2 saat ayırınız.'
        }
    },
    {
        id: 'black_tea_bag',
        name: 'Siyah Çay (Sallama / Poşet)',
        category: 'Çaylar',
        categoryGroup: 'tea',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.BLACK_TEA.value,
        unitLabel: 'ml',
        servings: TEA_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.BLACK_TEA, 'kuru çay kodu 11.02.0002 var, kafein verisi yok'),
        polyphenols: {
            polyphenolMgPerUnit: 100,
            ironInhibitionClass: 'VERY_HIGH',
            referenceInhibitionPct: [59, 94],
            dominantCompounds: 'Polimerize polifenoller, galloil esterleri, tanenler',
            folateInteraction: 'HIGH',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        },
        tags: ['çay', 'siyah çay', 'poşet çay', 'sallama çay'],
        bioactives: {
            primaryActives: 'Teaflavinler, tearubiginler, kafein (20 mg/100 ml)',
            secondaryActives: 'L-Teanin, gallik asit'
        }
    },
    {
        id: 'green_tea',
        name: 'Yeşil Çay (Demleme / Yaprak)',
        category: 'Çaylar',
        categoryGroup: 'tea',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.GREEN_TEA.value,
        unitLabel: 'ml',
        servings: TEA_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.GREEN_TEA),
        polyphenols: {
            polyphenolMgPerUnit: 75,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [25, 45],
            dominantCompounds: 'Monomerik kateşinler (EGCG 45–90 mg, EGC 25–50 mg, ECG, EC)',
            folateInteraction: 'HIGH',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: true
        },
        tags: ['yeşil çay', 'egcg', 'antioksidan', 'metabolizma', 'folat karşıtı'],
        bioactives: {
            primaryActives: 'Toplam kateşin (100–220 mg/kupa), EGCG (45–90 mg), EGC (25–50 mg), Kafein (30–50 mg)',
            secondaryActives: 'L-Teanin (15–30 mg), klorojenik asit',
            clinicalSafetyAlert: 'EGCG kateşinleri DHFR ve PCFT üzerinden folik asit (B9) emilimini baskılar; gebelikte folat hapıyla aynı anda içmeyiniz.'
        }
    },
    {
        id: 'matcha',
        name: 'Matcha Çayı (Tam Yaprak Tozu)',
        category: 'Çaylar',
        categoryGroup: 'tea',
        mode: 'count',
        caffeineMgPerUnit: 32,
        unitLabel: 'g toz',
        servings: counts('g toz', [1, 1.5, 2, 3]),
        defaultServingId: 'x1.5',
        valueBasis: 'Akademik HPLC',
        sources: pairSources(USDA_REFS.NO_DIRECT_USDA),
        polyphenols: {
            polyphenolMgPerUnit: 135,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [50, 75],
            dominantCompounds: 'Tam yaprak EGCG ve galloil kateşinler',
            folateInteraction: 'HIGH',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: true
        },
        tags: ['matcha', 'japon çayı', 'antioksidan', 'egcg', 'enerji', 'l-teanin']
    },
    {
        id: 'yerba_mate',
        name: 'Yerba Mate Çayı',
        category: 'Çaylar',
        categoryGroup: 'tea',
        mode: 'volume',
        caffeineMgPerUnit: 35,
        unitLabel: 'ml',
        servings: TEA_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Akademik HPLC',
        sources: pairSources(USDA_REFS.NO_DIRECT_USDA),
        polyphenols: {
            polyphenolMgPerUnit: 95,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [50, 75],
            dominantCompounds: 'Klorojenik asit türevleri, kafeoilkinik asitler, teobromin',
            folateInteraction: 'MODERATE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: false
        },
        tags: ['mate', 'yerba mate', 'güney amerika', 'enerji', 'odak']
    },
    {
        id: 'white_tea',
        name: 'Beyaz Çay / Oolong',
        category: 'Çaylar',
        categoryGroup: 'tea',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.OOLONG_PROXY.value,
        unitLabel: 'ml',
        servings: TEA_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'USDA (yakın eşdeğer)',
        sources: pairSources(USDA_REFS.OOLONG_PROXY),
        polyphenols: {
            polyphenolMgPerUnit: 65,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [25, 50],
            dominantCompounds: 'Kateşinler ve kısmi okside polifenoller',
            folateInteraction: 'MODERATE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: false
        },
        tags: ['beyaz çay', 'oolong', 'hafif', 'antioksidan']
    },

    // =========================================================================
    // 6. MONO-BİTKİSEL ÇAYLAR (Ph. Eur. / EMA / ESCOP — categoryGroup: 'mono_herbal')
    // =========================================================================
    {
        id: 'chamomile_tea',
        name: 'Mayıs Papatyası Çayı (Matricaria recutita)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.CHAMOMILE_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 55,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [47, 47],
            dominantCompounds: 'Apigenin-7-glukozit (2.5–5.5 mg), bisabolol (0.6–1.4 mg), kamazulen, müsilaj (Hurrell: %47 blokaj)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['papatya', 'uyku', 'rahatlama', 'sakinleştirici', 'mide', 'spazm', 'gaz'],
        bioactives: {
            primaryActives: 'Apigenin-7-O-glukozit (2.5–5.5 mg), (-)-α-Bisabolol / oksitleri (0.15–0.45 mg), Kamazulen (0.05–0.15 mg)',
            secondaryActives: 'Müsilaj polisakkaritleri (40–90 mg), Herniarin / Umbelliferon (0.3–0.8 mg)',
            clinicalSafetyAlert: 'GABA-A benzodiazepin reseptör modülatörü apigenin içerir; hafif sedatif ve antispazmodiktir.'
        }
    },
    {
        id: 'peppermint_tea',
        name: 'Tıbbi Nane Çayı (Mentha piperita)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 110,
            ironInhibitionClass: 'VERY_HIGH',
            referenceInhibitionPct: [84, 84],
            dominantCompounds: 'Rozmarinik asit (12–25 mg), eriyositrin (26–45 mg), mentol (1.1–2.8 mg) (Hurrell: %84 demir blokajı)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: false
        },
        tags: ['nane', 'tıbbi nane', 'mentol', 'sindirim', 'gaz', 'mide', 'ferahlatıcı', 'demir karşıtı'],
        bioactives: {
            primaryActives: 'Mentol (1.1–2.8 mg), Menton (0.6–1.5 mg), Rozmarinik asit (12–25 mg), Eriyositrin (26–45 mg)',
            secondaryActives: '1,8-Sineol, mentil asetat, hesperidin, kafeik asit',
            clinicalSafetyAlert: 'TRPM8 agonisti ve kalsiyum kanal blokörüdür. Polifenolleri non-hem demiri %84 oranında bloke eder; yemekle içmeyiniz.'
        }
    },
    {
        id: 'spearmint_tea',
        name: 'Bahçe Nanesi / Taze Nane Çayı (Mentha spicata)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 95,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [70, 78],
            dominantCompounds: 'R-(-)-Karvon (%50–70), rozmarinik asit (15–35 mg), flavonoidler (mentolsüz nane)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: false
        },
        tags: ['bahçe nanesi', 'taze nane', 'karvon', 'antiandrojenik', 'sindirim', 'gaz'],
        bioactives: {
            primaryActives: 'R-(-)-Karvon (3.0–7.0 mg), Rozmarinik asit (15–35 mg), Limonen',
            secondaryActives: 'Luteolin glikozitleri, klorojenik asit',
            clinicalSafetyAlert: 'Mentol içermez; yüksek rozmarinik asit içeriğiyle antiandrojenik (hirsutizm) ve eklem sağlığı çalışmalarında kullanılır.'
        }
    },
    {
        id: 'lemon_balm_tea',
        name: 'Oğulotu / Melisa Çayı (Melissa officinalis)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 85,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [55, 75],
            dominantCompounds: 'Rozmarinik asit (15–35 mg), hidroksisinamik asitler (60–110 mg), sitral (0.2–0.8 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: false
        },
        tags: ['melisa', 'oğulotu', 'uyku', 'stres', 'anksiyete', 'sakinleştirici', 'gaba'],
        bioactives: {
            primaryActives: 'Rozmarinik asit (15–35 mg), Toplam hidroksisinamik türevi (60–110 mg), Sitral / sitronellal (0.2–0.8 mg)',
            secondaryActives: 'Luteolin-7-glukozit, hiperozit, ursolik asit',
            clinicalSafetyAlert: 'GABA transaminaz (GABA-T) enzimini inhibe ederek endojen GABA seviyesini artırır; doğal anksiyolitiktir.'
        }
    },
    {
        id: 'sage_tea_medicinal',
        name: 'Tıbbi Adaçayı (Salvia officinalis — Tuyonlu)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 90,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [55, 75],
            dominantCompounds: 'Rozmarinik asit (15–35 mg), Lamiaceae tanenleri (45–75 mg), karnosik asit',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: false
        },
        tags: ['adaçayı', 'tıbbi adaçayı', 'boğaz', 'terleme', 'tuyonlu', 'antiseptik'],
        bioactives: {
            primaryActives: 'α- ve β-Tuyon (0.8–3.0 mg), d-Kafur (0.5–1.8 mg), Rozmarinik asit (15–35 mg)',
            secondaryActives: '1,8-Sineol (0.5–1.5 mg), karnosik asit, karnosol (3–8 mg)',
            thujoneMg: 1.8,
            clinicalSafetyAlert: '⚠️ Nörotoksik monoterpen keton tuyon içerir (0.8–3.0 mg/kupa). Epilepsi hastalarında ve gebelikte kullanılmaz; Anadolu Adaçayı tercih edilmelidir.'
        }
    },
    {
        id: 'sage_tea_anatolian',
        name: 'Anadolu / Elma Adaçayı (Salvia triloba — Güvenli Tür)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 90,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [55, 75],
            dominantCompounds: '1,8-Sineol (2.0–5.5 mg), rozmarinik asit (18–40 mg), düşük tuyon (<0.1 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: false
        },
        tags: ['adaçayı', 'anadolu adaçayı', 'elma adaçayı', 'salvia triloba', 'boğaz', 'sineol', 'güvenli'],
        bioactives: {
            primaryActives: '1,8-Sineol / Ökaliptol (2.0–5.5 mg), Rozmarinik asit (18–40 mg), Hidroksisinamik asitler (50–85 mg)',
            secondaryActives: 'Tuyon (<0.1 mg — ihmal edilebilir), salvigenin, karnosol',
            thujoneMg: 0.05,
            clinicalSafetyAlert: '🛡️ Güvenli adaçayı türüdür: %40–60 1,8-sineol içerir, tuyon oranı <%1 düzeyindedir; solunum ve boğaz antiseptiğidir.'
        }
    },
    {
        id: 'linden_tea',
        name: 'Ihlamur Çiçeği Çayı (Tilia cordata)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 65,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [52, 52],
            dominantCompounds: 'Tilirozit (3–8 mg), müsilaj polisakkaritleri (40–100 mg), rutin/hiperozit (Hurrell: %52 blokaj)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['ıhlamur', 'boğaz', 'öksürük', 'müsilaj', 'soğuk algınlığı', 'demulsen', 'göğüs yumuşatıcı'],
        bioactives: {
            primaryActives: 'Toplam flavonoid (15–30 mg: tilirozit, rutin, hiperozit), Çözünür müsilaj (40–100 mg)',
            secondaryActives: 'Kondanse tanenler (prosiyanidin B2, 20–45 mg), uçucu farnezol',
            clinicalSafetyAlert: 'Müsilaj polisakkaritleri orofaringeal mukozayı kaplayarak kuru öksürük refleksini dindirir.'
        }
    },
    {
        id: 'fennel_bitter_tea',
        name: 'Acı Rezene Çayı (Foeniculum vulgare var. vulgare)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 40,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [25, 45],
            dominantCompounds: 'trans-Anetol (5.5–7.0 mg), (+)-fenkon (1.5–2.2 mg), kafeoilkinik asitler',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['rezene', 'acı rezene', 'gaz', 'spazm', 'sindirim', 'şişkinlik', 'estragol'],
        bioactives: {
            primaryActives: 'trans-Anetol (5.5–7.0 mg), (+)-Fenkon (1.5–2.2 mg), Kafeoilkinik asitler (12–25 mg)',
            secondaryActives: 'Estragol (metil kavikol, 75–100 µg/kupa)',
            estragolUg: 85,
            clinicalSafetyAlert: '⚠️ Estragol içerir (75–100 µg/kupa; EMA üst sınırı 50 µg/gün). 4 yaş altı bebeklerde kontrendikedir; yetişkinlerde kısa süreli tüketilmelidir.'
        }
    },
    {
        id: 'fennel_sweet_tea',
        name: 'Tatlı Rezene Çayı (Foeniculum vulgare var. dulce)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 40,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [25, 40],
            dominantCompounds: 'trans-Anetol (3.7–4.5 mg), mikeliyanin, düşük fenkon (<0.4 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['rezene', 'tatlı rezene', 'gaz', 'spazm', 'sindirim', 'karminatif'],
        bioactives: {
            primaryActives: 'trans-Anetol (3.7–4.5 mg), Kafeoilkinik asitler (10–22 mg)',
            secondaryActives: 'Estragol (25–45 µg/kupa), fenkon (<0.4 mg)',
            estragolUg: 35,
            clinicalSafetyAlert: 'Acı rezeneye göre estragol ve fenkon oranı belirgin düşüktür; hafif karminatif ve spazmolitiktir.'
        }
    },
    {
        id: 'anise_tea',
        name: 'Anason Meyvesi Çayı (Pimpinella anisum)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 45,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [25, 45],
            dominantCompounds: 'trans-Anetol (5.0–6.5 mg), anisaldehit, klorojenik asit türevleri',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['anason', 'gaz', 'spazm', 'sindirim', 'karminatif', 'balgam söktürücü'],
        bioactives: {
            primaryActives: 'trans-Anetol (5.0–6.5 mg), Anisaldehit (0.1–0.3 mg), Klorojenik asit/rutin (12–20 mg)',
            secondaryActives: 'Estragol (30–60 µg/kupa)',
            estragolUg: 45,
            clinicalSafetyAlert: 'Bronşiyal sekretomotorik ve gastrointestinal karminatif etki gösterir. 12 yaş altı çocuklarda önerilmez.'
        }
    },
    {
        id: 'caraway_tea',
        name: 'Kimyon Meyvesi Çayı (Carum carvi)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 40,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [20, 40],
            dominantCompounds: 'S-(+)-Karvon (4.5–8.0 mg), limonen (2.5–5.0 mg) (estragolsüz güvenli karminatif)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['kimyon', 'karvon', 'gaz', 'karminatif', 'bebek dostu', 'estragolsüz'],
        bioactives: {
            primaryActives: 'S-(+)-Karvon (4.5–8.0 mg), Limonen (2.5–5.0 mg)',
            secondaryActives: 'Kafeoil türevleri (10–18 mg); estragol içermez',
            clinicalSafetyAlert: 'Estragol riski taşımayan en güvenli karminatiftir; düz kas spazmını çözer.'
        }
    },
    {
        id: 'passionflower_tea',
        name: 'Passiflora / Çarkıfelek Çayı (Passiflora incarnata)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 70,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [30, 50],
            dominantCompounds: 'C-Glikozil flavonlar (viteksin, izoviteksin, şaftozit — 18–35 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['passiflora', 'çarkıfelek', 'uyku', 'anksiyete', 'sakinleştirici', 'stres'],
        bioactives: {
            primaryActives: 'Viteksin eşdeğeri C-glikozil flavonlar (18–35 mg: viteksin, izoviteksin, şaftozit)',
            secondaryActives: 'İz harman indol alkaloidleri (<10–50 µg), maltol',
            clinicalSafetyAlert: 'GABA reseptör kompleksine bağlanarak huzursuzluk ve zihinsel gerginliği yatıştırır.'
        }
    },
    {
        id: 'hops_tea',
        name: 'Şerbetçiotu Çiçeği Çayı (Humulus lupulus)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 55,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [30, 50],
            dominantCompounds: 'Humulon / lupulon acı asitleri (8–18 mg), 2-metil-3-bütan-2-ol, ksantohumol',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['şerbetçiotu', 'uyku', 'sedatif', 'acı reçine', 'gaba', 'fitoöstrojen'],
        bioactives: {
            primaryActives: 'İzo-α-asit ve acı asit türevleri (8–18 mg), 2-Metil-3-bütan-2-ol (0.15–0.50 mg)',
            secondaryActives: 'Ksantohumol (0.15–0.40 mg), Fitoöstrojen 8-prenilnaringenin (10–30 µg)',
            clinicalSafetyAlert: 'GABA-A reseptörlerini doğrudan aktive eden 2-metil-3-bütan-2-ol oluşturur; uykuya dalış süresini kısaltır.'
        }
    },
    {
        id: 'st_johns_wort_tea',
        name: 'Sarı Kantaron Çayı (Hypericum perforatum)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 85,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [50, 75],
            dominantCompounds: 'Hiperisinler (0.4–1.2 mg), hiperforin (1.5–4.0 mg), rutin/hiperozit (35–65 mg)',
            folateInteraction: 'MODERATE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: false
        },
        tags: ['sarı kantaron', 'depresyon', 'ruh hali', 'hiperisin', 'ilaç etkileşimi', 'cyp3a4'],
        bioactives: {
            primaryActives: 'Hiperisin + psödohiperisin (0.4–1.2 mg), Hiperforin (1.5–4.0 mg), Rutin/hiperozit (35–65 mg)',
            secondaryActives: 'Oligomerik prosiyanidinler (80–150 mg), Amentoflavon',
            clinicalSafetyAlert: '⚠️ CYP3A4 ve P-glikoprotein indüksiyonu yapabilir; doğum kontrol hapı, antidepresan, antikoagülan ve immünsüpresan ilaçlarla birlikte kullanılmaz.'
        }
    },
    {
        id: 'lavender_tea',
        name: 'Lavanta Çiçeği Çayı (Lavandula angustifolia)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 50,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [30, 50],
            dominantCompounds: 'Linalil asetat (1.0–2.2 mg), linalool (0.8–2.0 mg), rozmarinik asit (2.5–4.5 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['lavanta', 'uyku', 'huzur', 'aromaterapi', 'stres', 'sakinleştirici'],
        bioactives: {
            primaryActives: 'Linalil asetat (1.0–2.2 mg), Linalool (0.8–2.0 mg), Uçucu yağ (3.0–6.0 mg)',
            secondaryActives: 'Rozmarinik asit (2.5–4.5 mg), umbelliferon/herniarin kumarinleri (12–25 mg)',
            clinicalSafetyAlert: 'Voltaj kapılı kalsiyum kanallarını modüle ederek sempatik aktiviteyi yatıştırır.'
        }
    },
    {
        id: 'thyme_tea',
        name: 'Tıbbi Kekik Çayı (Thymus vulgaris)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 75,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [45, 68],
            dominantCompounds: 'Timol / karvakrol (1.5–3.5 mg), rozmarinik asit (15–30 mg), sirkumaritin',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: false
        },
        tags: ['kekik', 'tıbbi kekik', 'timol', 'öksürük', 'bronşit', 'boğaz', 'antiseptik'],
        bioactives: {
            primaryActives: 'Timol + karvakrol (1.5–3.5 mg), Rozmarinik asit (15–30 mg)',
            secondaryActives: 'Sirkumaritin, timusin (2–5 mg bronkodilatör flavonoit)',
            clinicalSafetyAlert: 'Solunum yolu mukolitik ve bronkospazmolitik ajanlarından biridir; güçlü antimikrobiyaldir.'
        }
    },
    {
        id: 'eucalyptus_tea',
        name: 'Ökaliptüs Yaprağı Çayı (Eucalyptus globulus)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 80,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [50, 70],
            dominantCompounds: '1,8-Sineol (4.0–9.0 mg), ögloballer ve makrokarpal tanenleri (30–60 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: false
        },
        tags: ['ökaliptüs', 'sineol', 'nefes', 'sinüs', 'balgam söktürücü', 'boğaz'],
        bioactives: {
            primaryActives: '1,8-Sineol / Ökaliptol (4.0–9.0 mg)',
            secondaryActives: 'Hidrolize olabilen tanenler (30–60 mg: ögloballer, makrokarpaller)',
            clinicalSafetyAlert: 'Mukolitik ve sekretolitik etkilidir; solunum yollarını açar.'
        }
    },
    {
        id: 'ginger_tea',
        name: 'Zencefil Çayı (Zingiber officinale)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 50,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [30, 50],
            dominantCompounds: '6-Gingerol (3.5–10 mg), 6-şogaol (0.8–2.5 mg), α-zingiberen',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: true
        },
        tags: ['zencefil', 'gingerol', 'bulantı', 'bağışıklık', 'mide', 'ısıtıcı', 'iltihap'],
        bioactives: {
            primaryActives: 'Toplam gingerol + şogaol (5.0–14.0 mg: 6-gingerol 3.5–10 mg, 6-şogaol 0.8–2.5 mg)',
            secondaryActives: 'α-Zingiberen uçucu yağı (2.5–5.0 mg), zingeron, 6-paradol',
            clinicalSafetyAlert: '5-HT3 antagonizmasıyla antiemetik (bulantı önleyici), COX-2/5-LOX inhibisyonuyla anti-inflamatuardır.'
        }
    },
    {
        id: 'licorice_tea',
        name: 'Meyan Kökü Çayı (Glycyrrhiza glabra)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 60,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [35, 55],
            dominantCompounds: 'Glisirizin / glisirizik asit (50–70 mg), likiritin (12–25 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['meyan', 'meyan kökü', 'glisirizin', 'mide', 'reflü', 'ülser', 'öksürük'],
        bioactives: {
            primaryActives: '18β-Glisirizik asit tuzları (50–70 mg/kupa)',
            secondaryActives: 'Likiritin, izolikiritin (12–25 mg), H. pylori anti-adezif polisakkaritleri (30–60 mg)',
            clinicalSafetyAlert: '⚠️ Kronik yüksek tüketimde 11β-HSD2 inhibisyonu ile psödohiperaldosteronizm (tansiyon yükselmesi / potasyum kaybı) yapabilir. Hipertansiyonda dikkat!'
        }
    },
    {
        id: 'senna_tea',
        name: 'Sinameki Yaprağı Çayı (Senna alexandrina)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 45,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [30, 50],
            dominantCompounds: 'Sennozit A, A1, B (15–30 mg/kupa terapötik tam laksatif dozu)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['sinameki', 'laksatif', 'kabızlık', 'sennozit', 'barsak'],
        bioactives: {
            primaryActives: 'Sennozit A ve B (15–30 mg — EMA tam terapötik dozu)',
            secondaryActives: 'Rein-8-O-glukozit, kemferol glikozitleri (10–20 mg), müsilaj',
            anthranoidsMg: 22,
            clinicalSafetyAlert: '🚨 Akut kontakt laksatif: 1–2 haftadan uzun sürekli kullanmayınız. Kolon atonisi ve hipokalemi riski doğurur.'
        }
    },
    {
        id: 'frangula_tea',
        name: 'Barut Ağacı Kabuğu Çayı (Rhamnus frangula)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 50,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [30, 50],
            dominantCompounds: 'Glukofrangulin A ve B, frangulin A ve B (20–30 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['barut ağacı', 'frangula', 'laksatif', 'kabızlık', 'glukofrangulin'],
        bioactives: {
            primaryActives: 'Glukofrangulin A+B (20–30 mg eşdeğeri hidroksiantrasen glikoziti)',
            secondaryActives: 'Kondanse tanenler (8–18 mg), frangula-emodin',
            anthranoidsMg: 25,
            clinicalSafetyAlert: '🚨 Hidroksiantrasen laksatifidir; 1–2 haftayı aşan kronik kullanımdan kaçınılmalıdır.'
        }
    },
    {
        id: 'hibiscus_tea',
        name: 'Hibiskus / Bamya Çiçeği Çayı (Hibiscus sabdariffa)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 85,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [45, 65],
            dominantCompounds: 'Hibiskus ve sitrik asit (250–450 mg), delfinidin/siyanidin sambubiyozit (20–40 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['hibiskus', 'bamya çiçeği', 'ekşi çay', 'tansiyon', 'antioksidan', 'c vitamini'],
        bioactives: {
            primaryActives: 'Organik asitler (250–450 mg: hibiskus asidi, sitrik asit), Antosiyaninler (20–40 mg)',
            secondaryActives: 'Asidik müsilaj polisakkaritleri (100–180 mg), protokateşuik asit (15–30 mg)',
            clinicalSafetyAlert: 'ACE inhibitörü ve diüretik etkili antosiyaninler içerir; hafif tansiyon düşürücüdür.'
        }
    },
    {
        id: 'rosehip_tea',
        name: 'Kuşburnu Meyvesi Çayı (Rosa canina)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 70,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [30, 48],
            dominantCompounds: 'L-Askorbik asit / C vit (6–25 mg), malik/sitrik asit ve pektin (150–300 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['kuşburnu', 'c vitamini', 'bağışıklık', 'antioksidan', 'grip', 'eklem'],
        bioactives: {
            primaryActives: 'L-Askorbik asit (6–25 mg C vitamini), Proantosiyanidinler (40–90 mg)',
            secondaryActives: 'Malik ve sitrik asit, çözünür pektin (150–300 mg), tilirozit, likopen (<%5 suya geçer)'
        }
    },
    {
        id: 'echinacea_tea',
        name: 'Ekinezya Otu Çayı (Echinacea purpurea)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 65,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [35, 55],
            dominantCompounds: 'Sikoik ve kaftarik asit (8–25 mg), arabinogalaktan polisakkaritleri (30–70 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['ekinezya', 'bağışıklık', 'soğuk algınlığı', 'grip', 'immünomodülatör'],
        bioactives: {
            primaryActives: 'Sikoik asit + kaftarik asit (8–25 mg), Arabinogalaktan polisakkaritleri (30–70 mg)',
            secondaryActives: 'İz alkamidler (0.05–0.25 mg), klorojenik asit',
            clinicalSafetyAlert: 'Fagositozu ve non-spesifik bağışıklığı uyarır; otoimmün hastalıklarda hekime danışılmalıdır.'
        }
    },
    {
        id: 'birch_leaf_tea',
        name: 'Huş Ağacı Yaprağı Çayı (Betula pendula)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 65,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [30, 50],
            dominantCompounds: 'Hiperozit, avikülarin (22–50 mg flavonoid), potasyum tuzları (40–80 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['huş ağacı', 'ödem', 'diüretik', 'böbrek', 'idrar yolları', 'su atıcı'],
        bioactives: {
            primaryActives: 'Hiperozit eşdeğeri flavonoidler (22–50 mg), Potasyum (40–80 mg)',
            secondaryActives: 'Klorojenik asit ve tanenler (30–60 mg), dammaran saponinleri',
            clinicalSafetyAlert: 'Böbrek epitelini tahriş etmeden su atılımını (akuarezi) artıran farmakopeik drogtur.'
        }
    },
    {
        id: 'nettle_tea',
        name: 'Isırgan Yaprağı Çayı (Urtica dioica)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 55,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [30, 50],
            dominantCompounds: 'Kafeoilmalik ve klorojenik asit (8–20 mg), potasyum (45–80 mg), silisik asit',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['ısırgan', 'ödem', 'diüretik', 'eklem', 'romatizma', 'böbrek'],
        bioactives: {
            primaryActives: 'Kafeoilmalik asit + klorojenik asit (8–20 mg), Rutin/izokersitrin (10–25 mg)',
            secondaryActives: 'Çözünür silisik asit (10–20 mg), Potasyum (45–80 mg)'
        }
    },
    {
        id: 'pennyroyal_tea',
        name: 'Yarpuz Çayı (Mentha pulegium)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 95,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [73, 73],
            dominantCompounds: 'Monomerik flavonoidler, fenolik asitler (Hurrell 1999: %73 blokaj)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['yarpuz', 'yaban nanesi', 'demir karşıtı']
    },
    {
        id: 'vervain_tea',
        name: 'Mine Çiçeği Çayı (Verbena officinalis)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 75,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [59, 59],
            dominantCompounds: 'Verbaskozit, fenolik glikozitler (Hurrell 1999: %59 blokaj)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['mine çiçeği', 'verbena', 'rahatlatıcı', 'demir karşıtı']
    },
    {
        id: 'rooibos_tea',
        name: 'Rooibos Çayı (Kafeinsiz · Düşük Tanenli Güvenli Seçenek)',
        category: 'Mono-Bitkisel',
        categoryGroup: 'mono_herbal',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 8,
            ironInhibitionClass: 'NONE',
            referenceInhibitionPct: [0, 5],
            dominantCompounds: 'Aspalatin (4–12 mg), notofagin, orientin (galloil/tanen oranı çok düşük — demir emilimini bozmaz)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: true
        },
        tags: ['rooibos', 'kırmızı çay', 'kafeinsiz', 'demirsiz', 'anemi dostu', 'güvenli', 'antioksidan'],
        bioactives: {
            primaryActives: 'Aspalatin (4–12 mg fermente, 20–40 mg yeşil rooibos), Notofagin (1–4 mg)',
            secondaryActives: 'Orientin, izoorientin, rutin (toplam 60–100 mg polifenol; kondanse tanen yok)',
            clinicalSafetyAlert: '🛡️ Yemekle birlikte tüketildiğinde demir ve folat emilimini bozmayan tek bilimsel güvenli sıcak içecektir.'
        }
    },

    // =========================================================================
    // 7. HAZIR KARIŞIM ÇAYLAR (Polyherbal Blends — categoryGroup: 'blend')
    // =========================================================================
    {
        id: 'blend_form_classic',
        name: 'Form & Zayıflama Çayı (Doğadan Form / Kiraz Saplı)',
        category: 'Hazır Karışım',
        categoryGroup: 'blend',
        mode: 'count',
        caffeineMgPerUnit: 0,
        unitLabel: 'süzen poşet (2.0 g)',
        servings: counts('süzen poşet (2.0 g)', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 140,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [55, 75],
            dominantCompounds: 'Sennozitler, glukofrangulinler, hiperozit, arbutin, anetol (19.5–24.5 mg antranoid)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: false
        },
        tags: ['form', 'zayıflama', 'form çayı', 'laksatif', 'ödem', 'sinameki', 'kiraz sapı', 'diyet'],
        bioactives: {
            primaryActives: 'Aktif antranoidler (19.5–24.5 mg: Sennozit A+B 10.5–13.5 mg + Glukofrangulin A+B 9.0–11.0 mg)',
            secondaryActives: 'Hiperozit/rutin (8–15 mg), Arbutin (2.0–4.5 mg), trans-Anetol/fenkon (0.8–1.2 mg kolik önleyici tampon)',
            anthranoidsMg: 22,
            clinicalSafetyAlert: '🚨 Tam terapötik laksatif dozdur (19.5–24.5 mg antranoid). 14 günden uzun süreli kronik kullanım kolon tembelliğine ve potasyum kaybına yol açabilir.'
        }
    },
    {
        id: 'blend_winter_fruit_spice',
        name: 'Kış Çayı — Portakal, Elma & Tarçınlı (Doğadan vb.)',
        category: 'Hazır Karışım',
        categoryGroup: 'blend',
        mode: 'count',
        caffeineMgPerUnit: 0,
        unitLabel: 'süzen poşet (1.7 g)',
        servings: counts('süzen poşet (1.7 g)', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 120,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [50, 70],
            dominantCompounds: 'Hibiskus organik asitleri (65–110 mg), öjenol (2.0–3.0 mg), sinnamaldehit, glisirizin',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['kış çayı', 'portakal tarçın', 'tarçın', 'karanfil', 'öjenol', 'boğaz', 'grip', 'soğuk algınlığı'],
        bioactives: {
            primaryActives: 'Öjenol (2.0–3.0 mg lokal anestezik), Sinnamaldehit (0.8–1.6 mg), Glisirizik asit (4.5–6.5 mg)',
            secondaryActives: 'Organik asitler (65–110 mg), Antosiyaninler (6–12 mg), 6-Gingerol (0.5–1.2 mg), Piperin',
            clinicalSafetyAlert: 'Karanfilden gelen öjenol farenks mukozasında voltaj kapılı sodyum kanallarını bloke ederek boğaz ağrısında lokal analjezik/antiseptik etki gösterir.'
        }
    },
    {
        id: 'blend_winter_traditional',
        name: 'Kış Çayı — Geleneksel Ihlamur & Zencefilli',
        category: 'Hazır Karışım',
        categoryGroup: 'blend',
        mode: 'count',
        caffeineMgPerUnit: 0,
        unitLabel: 'süzen poşet (1.8 g)',
        servings: counts('süzen poşet (1.8 g)', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 110,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [45, 68],
            dominantCompounds: 'Ihlamur müsilajı (20–35 mg), 6-gingerol/şogaol (1.5–3.5 mg), öjenol (3.0–4.5 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['kış çayı', 'ıhlamur zencefil', 'öksürük', 'boğaz', 'demulsen', 'soğuk algınlığı', 'grip'],
        bioactives: {
            primaryActives: 'Çözünür müsilaj (20–35 mg demulsen), 6-Gingerol + şogaol (1.5–3.5 mg), Öjenol (3.0–4.5 mg)',
            secondaryActives: 'Tilirozit / rutin (8–15 mg), C vitamini (2–6 mg), Sinnamaldehit (0.6–1.2 mg)'
        }
    },
    {
        id: 'blend_relax_passiflora',
        name: 'Uyku & Rahatlatıcı Çay (Doğadan Relax Passifloralı 9 Bitkili)',
        category: 'Hazır Karışım',
        categoryGroup: 'blend',
        mode: 'count',
        caffeineMgPerUnit: 0,
        unitLabel: 'süzen poşet (1.35 g)',
        servings: counts('süzen poşet (1.35 g)', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 90,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [45, 68],
            dominantCompounds: 'Rozmarinik asit (2.6–5.5 mg), viteksin (1.1–2.0 mg), apigenin, kalifornidin, valerenik asit',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['relax', 'uyku', 'rahatlatıcı', 'passiflora', 'melisa', 'valerian', 'kediotu', 'şerbetçiotu', 'stres'],
        bioactives: {
            primaryActives: 'Rozmarinik asit (2.6–5.5 mg GABA-T inhibitörü), Viteksin (1.1–2.0 mg), Apigenin (0.3–0.6 mg)',
            secondaryActives: 'Kalifornidin (0.4–0.9 mg), Şerbetçiotu acı asidi (0.7–1.5 mg), Valerenik asit (0.08–0.20 mg), Hiperforin (<0.08 mg)',
            clinicalSafetyAlert: 'GABA-T inhibisyonu ve GABA-A allosterik modülasyonuyla çok hedefli sedatif sinerji sağlar. Sarı kantaron mikrodozda olduğundan (<0.08 mg) ilaç etkileşimi tetiklemez.'
        }
    },
    {
        id: 'blend_lactation_granule',
        name: 'Emziren Anne Çayı (Granül Ekstre — Humana Still-Tee vb.)',
        category: 'Hazır Karışım',
        categoryGroup: 'blend',
        mode: 'count',
        caffeineMgPerUnit: 0,
        unitLabel: '2 tatlı kaşığı (~9 g / 200 ml)',
        servings: counts('tatlı kaşığı (~4.5 g)', [2, 4]),
        defaultServingId: 'x2',
        valueBasis: 'Etiket / Formülasyon Analizi',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 30,
            ironInhibitionClass: 'LOW',
            referenceInhibitionPct: [15, 30],
            dominantCompounds: 'Keçisedefi galegini, çemenotu diosgenini, rezene trans-anetolü, C vitamini (38.2 mg)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['emziren anne', 'still tee', 'humana', 'süt artırıcı', 'galaktagog', 'şekerli', 'granül'],
        bioactives: {
            primaryActives: 'Keçisedefi galegin türevi (0.5–2.0 mg prolaktin uyarıcı), Çemenotu diosgenin (3.0–7.5 mg), trans-Anetol (2.5–5.0 mg), C vitamini (38.2 mg)',
            secondaryActives: 'Estragol (15–40 µg/kupa)',
            sugarG: 7.9,
            caloriesKcal: 35,
            clinicalSafetyAlert: '🍬 Ağırlıkça %97 karbonhidrattır: Kupa başına 7.9 g ilave sükroz şekeri (35 kcal) içerir. Gestasyonel diyabet veya insülin direncinde süzen poşet formu tercih ediniz.'
        }
    },
    {
        id: 'blend_lactation_bag',
        name: 'Emziren Anne Çayı (Süzen Poşet — Şekersiz)',
        category: 'Hazır Karışım',
        categoryGroup: 'blend',
        mode: 'count',
        caffeineMgPerUnit: 0,
        unitLabel: 'süzen poşet (2.0 g)',
        servings: counts('süzen poşet (2.0 g)', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 50,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [25, 45],
            dominantCompounds: 'trans-Anetol (4.5–6.5 mg), (+)-karvon (1.5–2.5 mg), fenkon, rozmarinik asit',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['emziren anne', 'anne çayı', 'şekersiz', 'süzen poşet', 'süt artırıcı', 'galaktagog', 'gaz'],
        bioactives: {
            primaryActives: 'trans-Anetol (4.5–6.5 mg), (+)-Karvon (1.5–2.5 mg), (+)-Fenkon (0.8–1.5 mg)',
            secondaryActives: 'Estragol (40–75 µg/kupa), Çemenotu diosgenin türevleri, rozmarinik asit; 0 g şeker (0 kcal)',
            estragolUg: 55,
            clinicalSafetyAlert: '0 kalori ve 0 g şeker içerir; prolaktin salgılanmasını desteklerken maternal glisemik yük oluşturmaz.'
        }
    },
    {
        id: 'blend_digestive',
        name: 'Sindirim Çayı (Species digestivae — Nane, Rezene, Papatya)',
        category: 'Hazır Karışım',
        categoryGroup: 'blend',
        mode: 'count',
        caffeineMgPerUnit: 0,
        unitLabel: 'süzen poşet (2.0 g)',
        servings: counts('süzen poşet (2.0 g)', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 90,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [45, 68],
            dominantCompounds: 'Mentol (1.5–3.0 mg), trans-anetol/karvon (2.0–3.5 mg), apigenin (0.8–1.5 mg), glisirizin',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['sindirim', 'mide', 'hazımsızlık', 'gaz', 'spazm', 'yemek sonrası', 'karminatif'],
        bioactives: {
            primaryActives: 'Mentol + menton (1.5–3.0 mg), trans-Anetol + karvon (2.0–3.5 mg), Apigenin-7-glukozit (0.8–1.5 mg)',
            secondaryActives: 'Glisirizik asit (5.0–10.0 mg), Eriyositrin, rozmarinik asit',
            clinicalSafetyAlert: 'EMA Species digestivae monografına uygundur; L-tipi kalsiyum kanallarını bloke ederek yemek sonrası spazm ve gazı çözer.'
        }
    },
    {
        id: 'blend_detox_mate',
        name: 'Detoks Çayı (Yeşil Çay & Mate Bazlı)',
        category: 'Hazır Karışım',
        categoryGroup: 'blend',
        mode: 'count',
        caffeineMgPerUnit: 30, // 22-38 mg kafein / poşet
        unitLabel: 'süzen poşet (1.8 g)',
        servings: counts('süzen poşet (1.8 g)', [1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'Farmakope / EMA Monografı',
        sources: pairSources(USDA_REFS.NO_DIRECT_USDA),
        polyphenols: {
            polyphenolMgPerUnit: 110,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [50, 72],
            dominantCompounds: 'EGCG kateşinleri (20–40 mg), klorojenik asit (25–45 mg), kafein (22–38 mg), gingerol',
            folateInteraction: 'HIGH',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: false
        },
        tags: ['detoks', 'yeşil çay', 'mate', 'ödem', 'metabolizma', 'enerji', 'termogenez', 'kafeinli'],
        bioactives: {
            primaryActives: 'Yeşil çay kateşinleri (45–85 mg: EGCG 20–40 mg), Klorojenik ve dikafeoilkinik asit (25–45 mg), Kafein (22–38 mg)',
            secondaryActives: 'L-Teanin (6–12 mg), 6-Gingerol (0.5–1.2 mg), Potasyum (25–40 mg)',
            clinicalSafetyAlert: 'Kafein ve EGCG içerir. Termogenezi ve su atılımını destekler. Yüksek kateşin nedeniyle folat takviyesiyle aynı anda alınmamalıdır.'
        }
    },

    // =========================================================================
    // 8. ENERJİ İÇECEKLERİ & DİĞERLERİ (categoryGroup: 'energy')
    // =========================================================================
    {
        id: 'hot_cocoa',
        name: 'Kakao / Sıcak Çikolata',
        category: 'Diğer',
        categoryGroup: 'energy',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.HOT_COCOA.value,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.HOT_COCOA, 'kuru kakaoda mineral verisi var, kafein verisi yok'),
        polyphenols: {
            polyphenolMgPerUnit: 105,
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [71, 71],
            dominantCompounds: 'Kondanse tanenler, kakao polifenol polimerleri, fitatlar (Hurrell: %71 demir ve çinko blokajı)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: true
        },
        tags: ['kakao', 'sıcak çikolata', 'teobromin', 'tatlı', 'demir karşıtı']
    },
    {
        id: 'energy_drink',
        name: 'Enerji İçeceği',
        category: 'Takviye & Enerji',
        categoryGroup: 'energy',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.ENERGY.value,
        unitLabel: 'ml',
        servings: CANS,
        defaultServingId: 'can250',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.ENERGY, 'kafein verisi yok; TGK tebliğ limiti ≤150 mg/L'),
        polyphenols: {
            polyphenolMgPerUnit: 0,
            ironInhibitionClass: 'NONE',
            referenceInhibitionPct: [0, 0],
            dominantCompounds: 'Kafein, taurin, B vitaminleri (polifenol/tanen içermez)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['enerji içeceği', 'red bull', 'monster', 'taurin', 'yüksek kafein']
    },
    {
        id: 'cola',
        name: 'Kola / Gazlı İçecek',
        category: 'Takviye & Enerji',
        categoryGroup: 'energy',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.COLA.value,
        unitLabel: 'ml',
        servings: COLA_SIZES,
        defaultServingId: 'can330',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.COLA),
        polyphenols: {
            polyphenolMgPerUnit: 0,
            ironInhibitionClass: 'NONE',
            referenceInhibitionPct: [0, 0],
            dominantCompounds: 'Kafein, fosforik asit (polifenol/tanen içermez)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['kola', 'coca cola', 'pepsi', 'gazlı içecek', 'kafeinli gazoz']
    },
    {
        id: 'pre_workout',
        name: 'Pre-Workout / Antrenman Öncesi Toz',
        category: 'Takviye & Enerji',
        categoryGroup: 'energy',
        mode: 'count',
        caffeineMgPerUnit: 200,
        unitLabel: 'ölçek (~200 mg, etikete bakınız)',
        servings: counts('ölçek', [0.5, 1, 1.5, 2]),
        defaultServingId: 'x1',
        valueBasis: 'Etiket',
        sources: pairSources(USDA_REFS.NO_DIRECT_USDA),
        polyphenols: {
            polyphenolMgPerUnit: 0,
            ironInhibitionClass: 'NONE',
            referenceInhibitionPct: [0, 0],
            dominantCompounds: 'Anhidroz kafein (tanen içermez)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['pre workout', 'antrenman', 'fitness', 'spor', 'yüksek kafein']
    },
    {
        id: 'caffeine_pill',
        name: 'Kafein Tableti (200 mg)',
        category: 'Takviye & Enerji',
        categoryGroup: 'energy',
        mode: 'count',
        caffeineMgPerUnit: 200,
        unitLabel: 'tablet',
        servings: counts('tablet', [0.5, 1, 2]),
        defaultServingId: 'x1',
        valueBasis: 'Etiket',
        sources: pairSources(USDA_REFS.NO_DIRECT_USDA),
        polyphenols: {
            polyphenolMgPerUnit: 0,
            ironInhibitionClass: 'NONE',
            referenceInhibitionPct: [0, 0],
            dominantCompounds: 'Saf kafein (polifenol/tanen içermez)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        },
        tags: ['kafein tableti', 'hap', 'saf kafein', 'ilaç', 'takviye']
    }
];

/**
 * Seçilen içecek ve porsiyon için kafein miktarını (mg, yuvarlanmış tam sayı) hesaplar.
 */
export function calculateCaffeineMg(drink: Drink, serving: ServingOption): number {
    const amount = Math.max(0, serving.amount);
    const raw = drink.mode === 'volume'
        ? (drink.caffeineMgPerUnit * amount) / 100
        : drink.caffeineMgPerUnit * amount;
    return Math.round(raw);
}

/**
 * Seçilen içecek ve porsiyon için tahmini toplam polifenol/tanen miktarını (mg) hesaplar.
 */
export function calculatePolyphenolMg(drink: Drink, serving: ServingOption): number {
    const amount = Math.max(0, serving.amount);
    const raw = drink.mode === 'volume'
        ? (drink.polyphenols.polyphenolMgPerUnit * amount) / 100
        : drink.polyphenols.polyphenolMgPerUnit * amount;
    return Math.round(raw);
}

export function getServing(drink: Drink, servingId?: string): ServingOption {
    return drink.servings.find(s => s.id === servingId)
        || drink.servings.find(s => s.id === drink.defaultServingId)
        || drink.servings[0];
}

export function getDefaultCaffeineMg(drink: Drink): number {
    return calculateCaffeineMg(drink, getServing(drink));
}

export function isIntrinsicMilkDrink(drink: Drink): boolean {
    return ['latte', 'cappuccino', 'cortado_macchiato'].includes(drink.id);
}

function formatSingleSource(label: string, src: SourceValue): string {
    if (src.value === null) {
        return `${label}: ${src.note || 'veri yok'}`;
    }
    const valStr = src.value.toLocaleString('tr-TR');
    const suffix = src.note ? ` [${src.note}]` : '';
    return `${label}: ${valStr} ${src.unit}${suffix}`;
}

/**
 * USDA ve TÜRKOMP değerlerini parantez içinde karşılaştırmalı biçimde döndürür.
 * Örn: "(USDA: 40 mg/100 g | TÜRKOMP: kafein verisi yok)"
 */
export function formatSourceComparison(drink: Drink): string {
    const usdaPart = formatSingleSource('USDA', drink.sources.usda);
    const turkompPart = formatSingleSource('TÜRKOMP', drink.sources.turkomp);
    return `(${usdaPart} | ${turkompPart})`;
}

/**
 * İçecekleri arama sorgusuna, kategori grubuna ve sık kullanılanlara göre filtreler.
 * Kullanıcı arama sorgusunda ad, kategori, dominant bileşik veya etiketlerle anında eşleşir.
 */
export function filterDrinks(
    drinks: Drink[] = DRINK_DATABASE,
    query: string = '',
    categoryGroup: DrinkCategoryGroup = 'all',
    favoriteIds: string[] = []
): Drink[] {
    const cleanQuery = query.trim().toLowerCase();

    return drinks.filter(drink => {
        // 1. Kategori filtrelemesi
        if (categoryGroup === 'favorites') {
            if (!favoriteIds.includes(drink.id)) return false;
        } else if (categoryGroup !== 'all') {
            if (drink.categoryGroup !== categoryGroup) return false;
        }

        // 2. Arama sorgusu yoksa kabul et
        if (!cleanQuery) return true;

        // 3. Akıllı metin ve semptom eşleme
        const nameMatch = drink.name.toLowerCase().includes(cleanQuery);
        const catMatch = drink.category.toLowerCase().includes(cleanQuery);
        const tagMatch = drink.tags?.some(tag => tag.toLowerCase().includes(cleanQuery)) ?? false;
        const activeMatch = drink.bioactives?.primaryActives.toLowerCase().includes(cleanQuery) ?? false;
        const secActiveMatch = drink.bioactives?.secondaryActives?.toLowerCase().includes(cleanQuery) ?? false;
        const dominantMatch = drink.polyphenols.dominantCompounds.toLowerCase().includes(cleanQuery);

        return nameMatch || catMatch || tagMatch || activeMatch || secActiveMatch || dominantMatch;
    });
}