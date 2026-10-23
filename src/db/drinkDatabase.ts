// src/db/drinkDatabase.ts

export interface CupSize {
    name: string;
    multiplier: number;
}

export const CUP_SIZES: Record<string, CupSize> = {
    ESPRESSO_SHOT: { name: 'Tek Shot (Single ~30 ml)', multiplier: 1.0 },
    SMALL: { name: 'Küçük / Standart Bardağı (~180 ml)', multiplier: 1.0 },
    MEDIUM: { name: 'Normal Kupa / Orta Boy (~250 ml)', multiplier: 1.35 },
    LARGE: { name: 'Büyük / XL Mug (~350-400 ml)', multiplier: 1.8 }
};

export interface Drink {
    id: string;
    name: string;
    category: string;
    baseCaffeineMg: number;
    isVolumeScaled: boolean;
}

export const DRINK_DATABASE: Drink[] = [
    // --- ESPRESSO TABANLI ---
    { id: 'espresso_single', name: 'Single Shot Espresso', category: 'Espresso', baseCaffeineMg: 63, isVolumeScaled: false },
    { id: 'espresso_double', name: 'Double Shot Espresso', category: 'Espresso', baseCaffeineMg: 125, isVolumeScaled: false },
    { id: 'americano', name: 'Americano (2 Shot)', category: 'Espresso', baseCaffeineMg: 125, isVolumeScaled: true },
    { id: 'latte_cappuccino', name: 'Latte / Cappuccino / Flat White', category: 'Espresso', baseCaffeineMg: 125, isVolumeScaled: true },
    { id: 'cortado_macchiato', name: 'Cortado / Espresso Macchiato', category: 'Espresso', baseCaffeineMg: 63, isVolumeScaled: false },

    // --- FİLTRE & MANTİK DEMLEME (MANUAL BREW) ---
    { id: 'filter_coffee', name: 'Filtre / Drip Kahve (Makine)', category: 'Demleme', baseCaffeineMg: 140, isVolumeScaled: true },
    { id: 'v60_pour_over', name: 'V60 / Chemex Manual Pour-Over', category: 'Demleme', baseCaffeineMg: 150, isVolumeScaled: true },
    { id: 'french_press', name: 'French Press Kahve', category: 'Demleme', baseCaffeineMg: 130, isVolumeScaled: true },
    { id: 'aeropress', name: 'Aeropress Kahve', category: 'Demleme', baseCaffeineMg: 120, isVolumeScaled: true },
    { id: 'moka_pot', name: 'Moka Pot Ekstraktı (2 Shot)', category: 'Demleme', baseCaffeineMg: 110, isVolumeScaled: false },
    { id: 'cold_brew', name: 'Cold Brew (Soğuk Demleme)', category: 'Demleme', baseCaffeineMg: 200, isVolumeScaled: true },
    { id: 'nitro_cold_brew', name: 'Nitro Cold Brew', category: 'Demleme', baseCaffeineMg: 215, isVolumeScaled: true },

    // --- GELENEKSEL & TÜRK KAHVESİ ÇEŞİTLERİ ---
    { id: 'turkish_coffee', name: 'Türk Kahvesi (Standart Fincan)', category: 'Geleneksel', baseCaffeineMg: 65, isVolumeScaled: false },
    { id: 'turkish_coffee_double', name: 'Dubleng / Süvari Türk Kahvesi', category: 'Geleneksel', baseCaffeineMg: 115, isVolumeScaled: false },
    { id: 'dibek_coffee', name: 'Dibek Kahvesi (Aromalı/Kelimeli)', category: 'Geleneksel', baseCaffeineMg: 40, isVolumeScaled: false },
    { id: 'menengic_coffee', name: 'Menengiç Kahvesi (Kafeinsiz)', category: 'Geleneksel', baseCaffeineMg: 0, isVolumeScaled: false },

    // --- GRANÜL & HAZIR KAHVELER ---
    { id: 'granule_classic', name: 'Granül Kahve (Classic / Tepeleme Kaşık)', category: 'Granül', baseCaffeineMg: 75, isVolumeScaled: true },
    { id: 'granule_gold', name: 'Granül Kahve (Gold / Freeze-Dried)', category: 'Granül', baseCaffeineMg: 80, isVolumeScaled: true },
    { id: 'granule_2in1', name: 'Hazır Kahve (2\'si 1 Arada)', category: 'Granül', baseCaffeineMg: 55, isVolumeScaled: false },
    { id: 'granule_3in1', name: 'Hazır Kahve (3\'ü 1 Arada)', category: 'Granül', baseCaffeineMg: 45, isVolumeScaled: false },

    // --- ÇAYLAR & BİTKİSEL İÇECEKLER ---
    { id: 'black_tea_glass', name: 'Demleme Siyah Çay (İnce Belli)', category: 'Çaylar', baseCaffeineMg: 35, isVolumeScaled: false },
    { id: 'black_tea_mug', name: 'Demleme Siyah Çay (Kupa Bardağı)', category: 'Çaylar', baseCaffeineMg: 65, isVolumeScaled: false },
    { id: 'green_tea', name: 'Yeşil Çay (Sallama veya Yaprak)', category: 'Çaylar', baseCaffeineMg: 30, isVolumeScaled: true },
    { id: 'matcha', name: 'Matcha Çayı (1.5g Seremoniyel Toz)', category: 'Çaylar', baseCaffeineMg: 70, isVolumeScaled: false },
    { id: 'yerba_mate', name: 'Yerba Mate Çayı', category: 'Çaylar', baseCaffeineMg: 85, isVolumeScaled: true },
    { id: 'white_tea', name: 'Beyaz Çay', category: 'Çaylar', baseCaffeineMg: 15, isVolumeScaled: true },

    // --- ENERJİ İÇECEKLERİ & SPOR TAKVİYELERİ ---
    { id: 'energy_drink_standard', name: 'Enerji İçeceği (250 ml Kutu)', category: 'Takviye & Enerji', baseCaffeineMg: 80, isVolumeScaled: false },
    { id: 'energy_drink_large', name: 'Enerji İçeceği Büyük (500 ml Kutu)', category: 'Takviye & Enerji', baseCaffeineMg: 160, isVolumeScaled: false },
    { id: 'pre_workout', name: 'Pre-Workout / Antrenman Öncesi Toz', category: 'Takviye & Enerji', baseCaffeineMg: 200, isVolumeScaled: false },
    { id: 'caffeine_pill', name: 'Kafein Hapı / Tablet', category: 'Takviye & Enerji', baseCaffeineMg: 200, isVolumeScaled: false },
    { id: 'cola_can', name: 'Kola / Gazlı İçecek (330 ml Kutu)', category: 'Takviye & Enerji', baseCaffeineMg: 35, isVolumeScaled: false }
];