export const CUP_SIZES = {
    SMALL: { name: 'Küçük / Kağıt Bardak (~180 ml)', multiplier: 1.0 },
    MEDIUM: { name: 'Normal Kupa (~250 ml)', multiplier: 1.4 },
    LARGE: { name: 'Büyük / XL Mug (~400 ml)', multiplier: 2.0 }
};

export const DRINK_DATABASE = [
    // --- ESPRESSO TABANLI ---
    { id: 'espresso_single', name: 'Single Shot Espresso', category: 'Espresso', baseCaffeineMg: 63, isVolumeScaled: false },
    { id: 'espresso_double', name: 'Double Shot Espresso', category: 'Espresso', baseCaffeineMg: 125, isVolumeScaled: false },
    { id: 'americano', name: 'Americano (2 Shot)', category: 'Espresso', baseCaffeineMg: 125, isVolumeScaled: true },
    { id: 'latte_cappuccino', name: 'Latte / Cappuccino / Flat White', category: 'Espresso', baseCaffeineMg: 63, isVolumeScaled: true },

    // --- GRANÜL / HAZIR KAHVELER ---
    { id: 'granule_classic', name: 'Granül Kahve (Classic / Tepeleme Kaşık)', category: 'Granül', baseCaffeineMg: 75, isVolumeScaled: true },
    { id: 'granule_gold', name: 'Granül Kahve (Gold / Freeze-Dried)', category: 'Granül', baseCaffeineMg: 80, isVolumeScaled: true },
    { id: 'granule_2in1', name: 'Hazır Kahve (2\'si 1 Arada)', category: 'Granül', baseCaffeineMg: 55, isVolumeScaled: false },
    { id: 'granule_3in1', name: 'Hazır Kahve (3\'ü 1 Arada)', category: 'Granül', baseCaffeineMg: 45, isVolumeScaled: false },

    // --- DEMLEME & GELENEKSEL ---
    { id: 'turkish_coffee', name: 'Türk Kahvesi (Standart Fincan)', category: 'Geleneksel', baseCaffeineMg: 65, isVolumeScaled: false },
    { id: 'filter_coffee', name: 'Filtre / Drip Kahve', category: 'Demleme', baseCaffeineMg: 140, isVolumeScaled: true },
    { id: 'french_press', name: 'French Press Kahve', category: 'Demleme', baseCaffeineMg: 130, isVolumeScaled: true },
    { id: 'moka_pot', name: 'Moka Pot Ekstraktı', category: 'Demleme', baseCaffeineMg: 100, isVolumeScaled: false },
    { id: 'cold_brew', name: 'Cold Brew (Soğuk Demleme)', category: 'Demleme', baseCaffeineMg: 210, isVolumeScaled: true },

    // --- ÇAYLAR & ALTERNATİFLER ---
    { id: 'black_tea', name: 'Siyah Çay (Demleme Bardağı)', category: 'Çay & Takviye', baseCaffeineMg: 45, isVolumeScaled: true },
    { id: 'green_tea', name: 'Yeşil Çay', category: 'Çay & Takviye', baseCaffeineMg: 30, isVolumeScaled: true },
    { id: 'matcha', name: 'Matcha Çayı (1.5g Toz)', category: 'Çay & Takviye', baseCaffeineMg: 65, isVolumeScaled: false },
    { id: 'energy_drink', name: 'Enerji İçeceği (250 ml Kutu)', category: 'Çay & Takviye', baseCaffeineMg: 80, isVolumeScaled: false },
    { id: 'pre_workout', name: 'Pre-Workout / Kafein Hapı', category: 'Çay & Takviye', baseCaffeineMg: 200, isVolumeScaled: false }
];