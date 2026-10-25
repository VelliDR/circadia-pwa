# Kafein, Polifenol ve Besin Emilimi Referans Tablosu (Faz 0 – Faz 5)

Bu belge, **Circadia PWA** içerisindeki içecek miktar hesaplamalarının revizyonunu (Faz 0), **USDA FoodData Central** ve **TÜRKOMP** karşılaştırmasını ve besin emilimi etkileşim katsayılarının birincil klinik kaynaklarını belgeler.

---

## 1. Veri Kaynakları Hakkında Metodolojik Not

1. **USDA FoodData Central (SR Legacy 2018-04 & FNDDS 2024-10):**
   - Kafein değerleri `Nutrient ID: 1057` üzerinden **mg / 100 g** cinsinden yayımlanmaktadır. Su/süt bazlı demlenmiş içeceklerde özgül ağırlık $\approx 1{,}0\text{ g/ml}$ kabul edilerek hacim bazlı içeceklerde **mg / 100 ml** olarak uygulanmıştır.
2. **TÜRKOMP (Ulusal Gıda Kompozisyon Veri Tabanı — T.C. Tarım ve Orman Bakanlığı):**
   - TÜRKOMP veri tabanında çay (*Gıda Kodu: 11.02.0002 — Çay, siyah, kuru*), kahve ve kakao kayıtları ile bunların makro besin, vitamin ve mineral (Fe, Ca, Mg, Zn vb.) bileşenleri yer almakla birlikte, sistemin ~100 bileşenlik analiz tablosunda **kafein (mg)** parametresi bulunmamaktadır.
   - Şeffaflık ilkesi gereği tüm içeceklerde iki kaynak parantez içinde karşılaştırmalı olarak gösterilir:
     `(USDA: ... | TÜRKOMP: kafein verisi yok)`.
   - Geleneksel Türk içeceklerinde (cezvede Türk kahvesi, çaydanlıkta demleme siyah çay) ulusal HPLC kromatografi çalışmaları ve *Türk Gıda Kodeksi (TGK)* alt sınırları ek referans olarak belirtilmiştir.

---

## 2. Faz 0 Miktar Revizyonu ve `(USDA | TÜRKOMP)` Karşılaştırma Tablosu

| İçecek | Ölçekleme Modu | Yeni Birim Değer | Varsayılan Porsiyon & Kafein | Eski Değer (Revizyon Öncesi) | Kaynak Karşılaştırması `(USDA \| TÜRKOMP)` |
|---|---|---|---|---|---|
| **Espresso** | Birim (`shot`, 30 ml) | 63,6 mg / shot | 1 shot → **64 mg** | 63 mg (sabit) | `(USDA: 212 mg/100 g [FDC 171891] \| TÜRKOMP: kafein verisi yok)` |
| **Americano** | Birim (`shot`) | 63,6 mg / shot | 2 shot → **127 mg** | 125 mg × bardak çarpanı ❌ | `(USDA: 212 mg/100 g [FDC 171891] \| TÜRKOMP: kafein verisi yok)` |
| **Latte / Flat White** | Birim (`shot`) | 63,6 mg / shot | 2 shot → **127 mg** | 125 mg × bardak çarpanı ❌ | `(USDA: 36 mg/100 g sütlü sıvı [FDC 2710386] \| TÜRKOMP: süt Ca verisi var, kafein verisi yok)` |
| **Cappuccino** | Birim (`shot`) | 63,6 mg / shot | 2 shot → **127 mg** | 125 mg × bardak çarpanı ❌ | `(USDA: 36 mg/100 g sütlü sıvı [FDC 2710472] \| TÜRKOMP: süt Ca verisi var, kafein verisi yok)` |
| **Cortado / Macchiato** | Birim (`shot`) | 63,6 mg / shot | 1 shot → **64 mg** | 63 mg | `(USDA: 142 mg/100 g [FDC 2710382] \| TÜRKOMP: kafein verisi yok)` |
| **Filtre / Drip Kahve** | Hacim (`ml`) | 40 mg / 100 ml | 250 ml → **100 mg** | 180 ml → 140 mg (~2× fazla) ❌ | `(USDA: 40 mg/100 g [FDC 171890] \| TÜRKOMP: kafein verisi yok)` |
| **V60 / Chemex** | Hacim (`ml`) | 40 mg / 100 ml | 250 ml → **100 mg** | 180 ml → 150 mg ❌ | `(USDA: 40 mg/100 g [FDC 171890] \| TÜRKOMP: kafein verisi yok)` |
| **French Press** | Hacim (`ml`) | 40 mg / 100 ml | 250 ml → **100 mg** | 180 ml → 130 mg ❌ | `(USDA: 40 mg/100 g [FDC 171890] \| TÜRKOMP: kafein verisi yok)` |
| **Aeropress** | Hacim (`ml`) | 40 mg / 100 ml | 180 ml → **72 mg** | 180 ml → 120 mg ❌ | `(USDA: 40 mg/100 g [FDC 171890] \| TÜRKOMP: kafein verisi yok)` |
| **Moka Pot** | Hacim (`ml`) | 199 mg / 100 ml | 50 ml → **100 mg** | 110 mg | `(USDA: 199 mg/100 g [FDC 2710381] \| TÜRKOMP: kafein verisi yok)` |
| **Cold Brew** | Hacim (`ml`) | 43 mg / 100 ml | 350 ml → **151 mg** | 350 ml → 360 mg ❌ | `(USDA: 40 mg/100 g [FDC 2710375] \| TÜRKOMP: kafein verisi yok)` |
| **Nitro Cold Brew** | Hacim (`ml`) | 56 mg / 100 ml | 350 ml → **196 mg** | 350 ml → 387 mg ❌ | `(USDA: kayıt yok \| TÜRKOMP: kafein verisi yok)` |
| **Türk Kahvesi (Cezve)** | Birim (`fincan`, ~65 ml) | 60 mg / fincan | 1 fincan → **60 mg** | 65 mg | `(USDA: 37 mg/100 g [FDC 2710377 tarif tahmini] \| TÜRKOMP: kafein verisi yok; cezve HPLC ~60 mg/fincan)` |
| **Granül Kahve (Classic/Gold)** | Birim (`çay kaşığı`, ~2 g) | 62,8 mg / kaşık | 1 kaşık → **63 mg** | 75–80 mg × bardak çarpanı ❌ | `(USDA: 3142 mg/100 g kuru toz [FDC 171893] \| TÜRKOMP: kafein verisi yok)` |
| **Hazır Kahve (2'si 1 Arada)** | Birim (`paket`, ~10 g) | 60,8 mg / paket | 1 paket → **61 mg** | 55 mg | `(USDA: 608 mg/100 g kuru karışım [FDC 2710482] \| TÜRKOMP: kafein verisi yok)` |
| **Hazır Kahve (3'ü 1 Arada)** | Birim (`paket`, ~17,5 g) | 70,7 mg / paket | 1 paket → **71 mg** | 45 mg | `(USDA: 404 mg/100 g kuru karışım [FDC 2710483] \| TÜRKOMP: kafein verisi yok)` |
| **Demleme Türk Çayı (Çaydanlık)** | Hacim (`ml`) | 32 mg / 100 ml | 100 ml → **32 mg** | 35 mg | `(USDA: 20 mg/100 g sallama [FDC 173227] \| TÜRKOMP: kuru çay 11.02.0002 var, kafein verisi yok; TGK ≥%1,6)` |
| **Siyah Çay (Sallama / Batı)** | Hacim (`ml`) | 20 mg / 100 ml | 250 ml → **50 mg** | 65 mg | `(USDA: 20 mg/100 g [FDC 173227] \| TÜRKOMP: kafein verisi yok)` |
| **Yeşil Çay** | Hacim (`ml`) | 12 mg / 100 ml | 250 ml → **30 mg** | 180 ml → 30 mg | `(USDA: 12 mg/100 g [FDC 171917] \| TÜRKOMP: kafein verisi yok)` |
| **Matcha (Tam Yaprak Tozu)** | Birim (`g toz`) | 32 mg / g | 1,5 g → **48 mg** | 70 mg | `(USDA: doğrudan kayıt yok \| TÜRKOMP: kafein verisi yok)` |
| **Bitki Çayları (Nane, Papatya, Ihlamur, Rooibos vb.)** | Hacim (`ml`) | 0 mg / 100 ml | 250 ml → **0 mg** | *(yoktu)* | `(USDA: 0 mg/100 g [FDC 173232 / 174156] \| TÜRKOMP: kafein verisi yok)` |
| **Kakao / Sıcak Çikolata** | Hacim (`ml`) | 3 mg / 100 ml | 250 ml → **8 mg** | *(yoktu)* | `(USDA: 3 mg/100 g [FDC 2705472] \| TÜRKOMP: kafein verisi yok)` |
| **Enerji İçeceği** | Hacim (`ml`) | 29 mg / 100 ml | 250 ml → **73 mg** | 80 mg | `(USDA: 29 mg/100 g [FDC 173210] \| TÜRKOMP: kafein verisi yok; TGK ≤150 mg/L)` |
| **Kola** | Hacim (`ml`) | 9 mg / 100 ml | 330 ml → **30 mg** | 35 mg | `(USDA: 9 mg/100 g [FDC 174852] \| TÜRKOMP: kafein verisi yok)` |

---

## 3. İçeceklerin Besin Emilimi İnhibisyon Katsayıları (Tek Öğün İzotop Çalışmaları)

| İçecek / Matris | Non-Hem Demir İnhibisyonu | Folat (B9) Blokajı | Tiamin (B1) Antagonizması | Birincil Kanıt |
|---|---|---|---|---|
| **Siyah Çay** | %59–94 | Yüksek (EGCG/ECG → DHFR & PCFT) | Yüksek (Tannik asit) | Hurrell et al., 1999; Alemdaroglu et al., 2008 |
| **Nane Çayı** (*Mentha piperita*) | %84 | Yok | Orta | Hurrell et al., 1999 |
| **Granül / Hazır Kahve** | %72–83 | Düşük | Yüksek (Kafeik/klorojenik asit) | Morck et al., 1983; Somogyi et al., 1976 |
| **Yarpuz / Kakao / Mine Çiçeği** | %73 / %71 / %59 | Yok | Yok | Hurrell et al., 1999 |
| **Ihlamur / Papatya** | %52 / %47 | Yok | Yok | Hurrell et al., 1999 |
| **Filtre Kahve / Espresso** | %39 (karma) – %72 (bitkisel) | Düşük | Yüksek | Morck et al., 1983 |
| **Yeşil Çay** | %25–45 (uzun vadede ılımlı) | Yüksek ($IC_{50}\approx 7{,}5\text{ mg/mL}$) | Orta | Alemdaroglu et al., 2008 |
| **Rooibos Çayı** | ~%0–5 (Güvenli alternatif) | Yok | Yok | Düşük tanen matrisi |

---

## 4. Birincil Hakemli Kaynakça

1. **Hurrell, R. F., Reddy, M., & Cook, J. D. (1999).** Inhibition of non-haem iron absorption in man by polyphenolic-containing beverages. *British Journal of Nutrition*, 81(4), 289–295.
2. **Morck, T. A., Lynch, S. R., & Cook, J. D. (1983).** Inhibition of food iron absorption by coffee. *The American Journal of Clinical Nutrition*, 37(3), 416–420.
3. **Ahmad Fuzi, S. F., Koller, D., Bruggraber, S., Pereira, D. I., Dainty, J. R., & Mushtaq, S. (2017).** A 1-h time interval between a meal containing iron and consumption of tea attenuates the inhibitory effects on iron absorption: a controlled trial in a cohort of healthy UK women using a stable iron isotope. *The American Journal of Clinical Nutrition*, 106(6), 1413–1421.
4. **Lazrak, M., El Kari, K., Stoffel, N. U., et al. (2021).** Tea consumption reduces iron bioavailability from NaFeEDTA in nonanemic women and women with iron deficiency anemia: stable iron isotope studies in Morocco. *The Journal of Nutrition*, 151(9), 2714–2720.
5. **Alemdaroglu, N. C., Dietz, U., Wolffram, S., Spahn-Langguth, H., & Langguth, P. (2008).** Influence of green and black tea on folic acid pharmacokinetics in healthy volunteers: potential risk of diminished folic acid bioavailability. *Biopharmaceutics & Drug Disposition*, 29(6), 335–348.
6. **Somogyi, J. C., & Nägeli, U. (1976).** Antithiamine effect of coffee. *International Journal for Vitamin and Nutrition Research*, 46(2), 149–153.
7. **Rapuri, P. B., Gallagher, J. C., & Nawaz, Z. (2007).** Caffeine decreases vitamin D receptor protein expression and $1,25(\text{OH})_2\text{D}_3$ stimulated alkaline phosphatase activity in human osteoblast cells. *The Journal of Steroid Biochemistry and Molecular Biology*, 103(3–5), 368–371.
8. **Faber, M. S., & Fuhr, U. (2004).** Time response of cytochrome P450 1A2 activity on cessation of heavy smoking. *Clinical Pharmacology & Therapeutics*, 76(2), 178–184.
9. **EFSA NDA Panel (2015).** Scientific Opinion on the safety of caffeine. *EFSA Journal*, 13(5), 4102.
