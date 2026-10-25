// src/db/drinkDatabase.ts
/**
 * @file drinkDatabase.ts
 * @description Kaynaklı içecek, kafein ve polifenol/tanen veritabanı (Faz 0 & Faz 1).
 *
 * Miktar modeli:
 *  - `volume`: Kafein ve polifenol miktarı hacimle (ml) doğrusal ölçeklenir (`mg / 100 ml`).
 *  - `count` : Kafein ve polifenol miktarı doz biriminden gelir (shot, kaşık, gram, paket, fincan, tablet).
 *              Su veya süt eklemek baz kafein dozunu değiştirmez (`mg / birim`).
 *
 * Veri Kaynakları:
 *  - USDA FoodData Central (SR Legacy 2018-04 & FNDDS 2024-10, mg/100 g; içecek yoğunluğu ≈ 1 g/ml).
 *  - TÜRKOMP (Ulusal Gıda Kompozisyon Veri Tabanı): ~100 bileşenlik ulusal tabloda "kafein" parametresi
 *    bulunmamaktadır; karşılaştırma şeffaflığı için açıkça belirtilir.
 *  - Polifenol ve emilim inhibisyonu verileri: Hurrell et al. (1999), Morck et al. (1983),
 *    Ahmad Fuzi et al. (2017), Alemdaroglu et al. (2008), Somogyi et al. (1976), Lazrak et al. (2021).
 */

export type DoseMode = 'volume' | 'count';

export type ValueBasis = 'USDA' | 'USDA (yakın eşdeğer)' | 'Akademik HPLC' | 'Etiket';

export type IronInhibitionClass = 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'NONE';

export type InteractionLevel = 'HIGH' | 'MODERATE' | 'NONE';

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

export interface Drink {
    id: string;
    name: string;
    category: string;
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
    // 1. ESPRESSO TABANLI (Kafein shot adedinden gelir; su/süt kafeini artırmaz)
    // =========================================================================
    {
        id: 'espresso',
        name: 'Espresso',
        category: 'Espresso',
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
        }
    },
    {
        id: 'americano',
        name: 'Americano',
        category: 'Espresso',
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
        }
    },
    {
        id: 'latte',
        name: 'Latte / Flat White (Sütlü)',
        category: 'Espresso',
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
            supportsMilkModifier: false // Zaten sütlü
        }
    },
    {
        id: 'cappuccino',
        name: 'Cappuccino (Sütlü)',
        category: 'Espresso',
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
        }
    },
    {
        id: 'cortado_macchiato',
        name: 'Cortado / Espresso Macchiato',
        category: 'Espresso',
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
        }
    },

    // =========================================================================
    // 2. FİLTRE & MANUEL DEMLEME (Hacimle doğrusal ölçeklenir: mg/100 ml)
    // =========================================================================
    {
        id: 'filter_coffee',
        name: 'Filtre / Drip Kahve',
        category: 'Demleme',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.BREWED.value,
        unitLabel: 'ml',
        servings: COFFEE_CUPS,
        defaultServingId: 'medium',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.BREWED),
        polyphenols: {
            polyphenolMgPerUnit: 85, // ~200 mg / 240 ml kupa (Hurrell 1999; Morck 1983)
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [39, 72],
            dominantCompounds: 'Klorojenik asit, kafeik asit, kafein',
            folateInteraction: 'NONE',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        }
    },
    {
        id: 'v60_pour_over',
        name: 'V60 / Chemex Pour-Over',
        category: 'Demleme',
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
        }
    },
    {
        id: 'french_press',
        name: 'French Press Kahve',
        category: 'Demleme',
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
        }
    },
    {
        id: 'aeropress',
        name: 'Aeropress Kahve',
        category: 'Demleme',
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
        }
    },
    {
        id: 'moka_pot',
        name: 'Moka Pot Ekstraktı',
        category: 'Demleme',
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
        }
    },
    {
        id: 'cold_brew',
        name: 'Cold Brew (Soğuk Demleme)',
        category: 'Demleme',
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
        }
    },
    {
        id: 'nitro_cold_brew',
        name: 'Nitro Cold Brew',
        category: 'Demleme',
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
        }
    },

    // =========================================================================
    // 3. GELENEKSEL & TÜRK KAHVESİ
    // =========================================================================
    {
        // Cezvede hazırlanan ~65 ml Türk kahvesi HPLC çalışmalarında ~55-65 mg kafein içerir (~85 mg/100 ml).
        id: 'turkish_coffee',
        name: 'Türk Kahvesi (Cezve)',
        category: 'Geleneksel',
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
        }
    },
    {
        id: 'turkish_coffee_double',
        name: 'Duble / Süvari Türk Kahvesi',
        category: 'Geleneksel',
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
        }
    },
    {
        id: 'dibek_coffee',
        name: 'Dibek Kahvesi',
        category: 'Geleneksel',
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
        }
    },
    {
        id: 'menengic_coffee',
        name: 'Menengiç Kahvesi (Kafeinsiz)',
        category: 'Geleneksel',
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
        }
    },

    // =========================================================================
    // 4. GRANÜL & HAZIR KAHVELER (Morck 1983: %83 non-hem demir inhibisyonu)
    // =========================================================================
    {
        // USDA FDC 171893: 3142 mg / 100 g kuru toz → 2 g tepeleme çay kaşığı ≈ 63 mg kafein
        id: 'granule_classic',
        name: 'Granül / Çözünebilir Kahve (Classic)',
        category: 'Granül',
        mode: 'count',
        caffeineMgPerUnit: (USDA_REFS.INSTANT_POWDER.value / 100) * 2,
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
        }
    },
    {
        id: 'granule_gold',
        name: 'Granül Kahve (Gold / Freeze-Dried)',
        category: 'Granül',
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
        }
    },
    {
        // USDA FDC 2710482: 608 mg / 100 g → ~11 g tekli poşet ≈ 67 mg (TR piyasa kremalı 2'si 1 arada ~11 g ≈ 55-65 mg)
        id: 'granule_2in1',
        name: 'Hazır Kahve (2\'si 1 Arada)',
        category: 'Granül',
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
        }
    },
    {
        // USDA FDC 2710483: 404 mg / 100 g → 17.5 g paket ≈ 71 mg
        id: 'granule_3in1',
        name: 'Hazır Kahve (3\'ü 1 Arada)',
        category: 'Granül',
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
        }
    },

    // =========================================================================
    // 5. ÇAYLAR (Camellia sinensis & Yerba Mate)
    // =========================================================================
    {
        // Geleneksel çaydanlıkta demlenip sulandırılan Türk çayı HPLC verilerinde 100 ml'de ~30-35 mg kafein içerir.
        id: 'black_tea_turkish',
        name: 'Demleme Siyah Çay (Çaydanlık / Türk Usulü)',
        category: 'Çaylar',
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
            dominantCompounds: 'Tanenler (galloil esterleri), teaflavinler, tearubiginler',
            folateInteraction: 'HIGH',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        }
    },
    {
        id: 'black_tea_bag',
        name: 'Siyah Çay (Sallama / Batı Usulü)',
        category: 'Çaylar',
        mode: 'volume',
        caffeineMgPerUnit: USDA_REFS.BLACK_TEA.value,
        unitLabel: 'ml',
        servings: TEA_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.BLACK_TEA, 'kuru çay kodu 11.02.0002 var, kafein verisi yok'),
        polyphenols: {
            polyphenolMgPerUnit: 100, // ~200-250 mg / 250 ml kupa (Hurrell 1999)
            ironInhibitionClass: 'VERY_HIGH',
            referenceInhibitionPct: [59, 94],
            dominantCompounds: 'Polimerize polifenoller, galloil esterleri, tanenler',
            folateInteraction: 'HIGH',
            thiamineInteraction: 'HIGH',
            supportsMilkModifier: true
        }
    },
    {
        id: 'green_tea',
        name: 'Yeşil Çay (Demleme / Yaprak)',
        category: 'Çaylar',
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
            dominantCompounds: 'Monomerik kateşinler (EGCG, ECG, EGC, EC)',
            folateInteraction: 'HIGH', // DHFR + PCFT blokajı & H2O2 oksidasyonu
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: true
        }
    },
    {
        // Akademik HPLC literatüründe seremoniyel matcha tozu ~32 mg/g kafein (1.5 g = 48 mg, 2 g = 64 mg)
        id: 'matcha',
        name: 'Matcha Çayı (Tam Yaprak Tozu)',
        category: 'Çaylar',
        mode: 'count',
        caffeineMgPerUnit: 32,
        unitLabel: 'g toz',
        servings: counts('g toz', [1, 1.5, 2, 3]),
        defaultServingId: 'x1.5',
        valueBasis: 'Akademik HPLC',
        sources: pairSources(USDA_REFS.NO_DIRECT_USDA),
        polyphenols: {
            polyphenolMgPerUnit: 135, // Tam yaprak tüketildiği için EGCG çok yüksek
            ironInhibitionClass: 'HIGH',
            referenceInhibitionPct: [50, 75],
            dominantCompounds: 'Yüksek konsantrasyonlu EGCG ve galloil kateşinler',
            folateInteraction: 'HIGH',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: true
        }
    },
    {
        id: 'yerba_mate',
        name: 'Yerba Mate Çayı',
        category: 'Çaylar',
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
            dominantCompounds: 'Klorojenik asit türevleri, kafeoilkinik asitler',
            folateInteraction: 'MODERATE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: false
        }
    },
    {
        id: 'white_tea',
        name: 'Beyaz Çay / Oolong',
        category: 'Çaylar',
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
        }
    },

    // =========================================================================
    // 6. KAFEİNSİZ BİTKİ ÇAYLARI & KAKAO (Hurrell 1999 Literatür Tablosu)
    //    Kafein ~0 mg olduğu için uyku eğrisini bozmaz, ancak polifenolleriyle
    //    bitkisel non-hem demir emilimini güçlü biçimde bloke eder!
    // =========================================================================
    {
        id: 'peppermint_tea',
        name: 'Nane Çayı (Mentha piperita — Kafeinsiz)',
        category: 'Bitki Çayları & Kakao',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 110,
            ironInhibitionClass: 'VERY_HIGH',
            referenceInhibitionPct: [84, 84],
            dominantCompounds: 'Rozmarinik asit, eriokitrin, fenolik flavonoidler (Hurrell 1999: %84 blokaj)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'MODERATE',
            supportsMilkModifier: false
        }
    },
    {
        id: 'pennyroyal_tea',
        name: 'Yarpuz Çayı (Mentha pulegium — Kafeinsiz)',
        category: 'Bitki Çayları & Kakao',
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
        }
    },
    {
        id: 'hot_cocoa',
        name: 'Kakao / Sıcak Çikolata',
        category: 'Bitki Çayları & Kakao',
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
            dominantCompounds: 'Kondanse tanenler, kakao polifenol polimerleri, fitatlar (Fe ve Zn blokajı)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: true
        }
    },
    {
        id: 'vervain_tea',
        name: 'Mine Çiçeği Çayı (Verbena — Kafeinsiz)',
        category: 'Bitki Çayları & Kakao',
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
        }
    },
    {
        id: 'linden_tea',
        name: 'Ihlamur Çayı (Tilia cordata — Kafeinsiz)',
        category: 'Bitki Çayları & Kakao',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.HERBAL_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 65,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [52, 52],
            dominantCompounds: 'Tilirozit, kuersetin/kaempferol glikozitleri, kondanse tanenler (%52 blokaj)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        }
    },
    {
        id: 'chamomile_tea',
        name: 'Papatya Çayı (Matricaria recutita — Kafeinsiz)',
        category: 'Bitki Çayları & Kakao',
        mode: 'volume',
        caffeineMgPerUnit: 0,
        unitLabel: 'ml',
        servings: HERBAL_CUPS,
        defaultServingId: 'mug',
        valueBasis: 'USDA',
        sources: pairSources(USDA_REFS.CHAMOMILE_ZERO),
        polyphenols: {
            polyphenolMgPerUnit: 55,
            ironInhibitionClass: 'MODERATE',
            referenceInhibitionPct: [47, 47],
            dominantCompounds: 'Apigenin ve luteolin glikozitleri (Hurrell 1999: %47 blokaj)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        }
    },
    {
        id: 'rooibos_tea',
        name: 'Rooibos Çayı (Kafeinsiz · Düşük Tanenli Güvenli Seçenek)',
        category: 'Bitki Çayları & Kakao',
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
            dominantCompounds: 'Aspalatin (galloil/tanen oranı çok düşük — demir emilimini bozmaz)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: true
        }
    },

    // =========================================================================
    // 7. ENERJİ İÇECEKLERİ & TAKVİYELER (Tanen yok → demir şelasyonu yok, Ca/VDR etkisi var)
    // =========================================================================
    {
        id: 'energy_drink',
        name: 'Enerji İçeceği',
        category: 'Takviye & Enerji',
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
            dominantCompounds: 'Sentetik/izole kafein (tanen içermez; yalnızca renal Ca/VDR etkisi)',
            folateInteraction: 'NONE',
            thiamineInteraction: 'NONE',
            supportsMilkModifier: false
        }
    },
    {
        id: 'cola',
        name: 'Kola / Kafeinli Gazlı İçecek',
        category: 'Takviye & Enerji',
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
        }
    },
    {
        id: 'pre_workout',
        name: 'Pre-Workout / Antrenman Öncesi Toz',
        category: 'Takviye & Enerji',
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
        }
    },
    {
        id: 'caffeine_pill',
        name: 'Kafein Tableti (200 mg)',
        category: 'Takviye & Enerji',
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
        }
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