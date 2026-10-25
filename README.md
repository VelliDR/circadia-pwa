# ☕ Circadia // Biyoritim, Kafein & Besin Emilim Simülatörü

**Circadia**, bireysel kafein eliminasyon kinetiğini, karaciğer enzimatik modülasyonunu (CYP1A2), biyoritim dengesini ve çay/kahve biyoaktif bileşiklerinin (polifenol, tanen, kateşin) mikrobesin emilimi üzerindeki kronobiyolojik etkilerini matematiksel modellerle simüle eden açık kaynaklı bir Progressive Web App (PWA) uygulamasıdır.

Sıradan sayaçların aksine; sigara kullanımı, sigara bırakma süreci, oral kontraseptif/gebelik durumu, mide doluluk hızı ve **%100 isteğe bağlı** öğün/takviye zamanlamasını hesaba katarak kişiselleştirilmiş bir eliminasyon ve emilim penceresi çizer.

---

## 🔬 Temel Özellikler & Klinik Model

- **Çift Kaynaklı Dozaj Modeli (`USDA | TÜRKOMP`):** Hacim bazlı (`mg/100 ml`) ve birim bazlı (`shot`, `kaşık`, `fincan`, `tablet`) içecekleri birbirinden ayırır; her içecek için parantez içinde karşılaştırmalı `(USDA | TÜRKOMP)` referans değerlerini gösterir (bkz. [docs/caffeine-reference.md](docs/caffeine-reference.md)).
- **CYP1A2 Enzim Dinamikleri:** Sigara kullanımına bağlı karaciğer enzim indüksiyonunu, oral kontraseptif (OCP) ve gebelik kaynaklı enzim inhibisyonunu ($t_{1/2}$ uzaması) anlık simüle eder.
- **Üstel Sigara Bırakma (De-indüksiyon) Eğrisi:** Sigara bırakıldıktan sonraki 14 günlük süreçte CYP1A2 enzim aktivitesinin bazal seviyeye dönüşünü üstel yarı ömürle ($\tau \approx 2.3\text{ gün}$, Faber & Fuhr 2004) hesaplar.
- **Analitik $t_{\max}$ Emilim & Bateman Kinetiği:** Tüketim sonrası gastrointestinal emilim hızına göre aç karnına ($k_a = 5.0\text{ sa}^{-1} \Rightarrow t_{\max} \approx 44\text{ dk}$) ve tok karnına ($k_a = 2.0\text{ sa}^{-1} \Rightarrow t_{\max} \approx 86\text{ dk}$) doruk süresini ve 1. derece eliminasyon eğrisini çizer.
- **Sistemik Yük, Plazma Konsantrasyonu & EFSA Sınırları:** Anlık aktif vücut yükü ($mg$) ve tahmini plazma konsantrasyonunu ($mg/L$, $V_d = 0.65\text{ L/kg}$) günlük kümülatif alım limitlerinden ($400\text{ mg}$ yetişkin, $200\text{ mg}$ gebelik) ve tek doz sınırından ($200\text{ mg}$ / $3\text{ mg/kg}$) ayrı değerlendirir; gece vardiyaları için **Son 24 Saat** kayan pencere modunu destekler.
- **İsteğe Bağlı Besin Emilim & Zamanlama Motoru:** Öğün veya takviye girildiğinde `-60 dk` / `+60..120 dk` güvenli pencereleri, hayvansal hem demir (porfirin kalkanı) ile bitkisel non-hem demir ($Fe^{3+}$) farkını, süt kalsiyumu DMT1 rekabetini, sabah `05:30–11:30` sirkadiyen hepsidin penceresini, folat (DHFR/PCFT), tiamin (B1), üriner kalsiyum/VDR dengesini ve hemokromatozis/talasemi terapötik modunu hesaplar. **Öğün girilmezse kafein ve uyku hesaplamaları sıfır sapmayla bağımsız çalışır.**
- **Uygulama İçi Tıklanır Sayaç:** Tarayıcı bildirim servisine ihtiyaç duymadan, güvenli içecek/öğün penceresini veya uyku eşiğini takip eden tıklanır pop-up geri sayım sayacı sunar.
- **OLED Red-Shift (Nöbet Modu) & Çevrimdışı Çalışma:** Melatonin baskılanmasını önleyen saf kırmızı/siyah tema, `Persistent Storage API` koruması ve `.json` yerel yedekleme/içe aktarma.

---

## 🧮 Matematiksel & Farmakokinetik Model

### 1. Emilim, Eliminasyon & Plazma Konsantrasyonu (Bateman Fonksiyonu)
$$A(t) = D \cdot \frac{k_a}{k_a - k_e} \cdot \left( e^{-k_e \cdot t} - e^{-k_a \cdot t} \right), \qquad C_p(t) = \frac{A(t)}{V_d \cdot W}$$

$$t_{\max} = \frac{\ln(k_a / k_e)}{k_a - k_e}$$

Burada:
- $D$: Tüketilen kafein dozu ($mg$)
- $A(t)$: $t$ saat sonra vücuttaki aktif kafein yükü ($mg$)
- $C_p(t)$: Tahmini plazma kafein konsantrasyonu ($mg/L$, $V_d = 0.65\text{ L/kg}$, $W$: vücut ağırlığı $kg$)
- $k_a$: Gastrointestinal emilim hız sabiti (Aç karnına: $5.0\text{ sa}^{-1}$, Tok karnına: $2.0\text{ sa}^{-1}$)
- $k_e = \frac{\ln(2)}{t_{1/2\_etkin}}$: Eliminasyon hız sabiti

### 2. Üstel Sigara Bırakma De-indüksiyonu ($0 - 14\text{ Gün}$)
$$I(d) = 1 + (I_0 - 1) \cdot \frac{e^{-d/\tau} - e^{-14/\tau}}{1 - e^{-14/\tau}}, \qquad t_{1/2}(d) = \frac{t_{1/2\_baz}}{I(d)} \quad (\tau = 2.3\text{ gün})$$

---

## 🛠️ Teknolojik Mimari

- **Frontend:** TypeScript + Modern Glassmorphism UI
- **Motorlar:** `Pharmacokinetics`, `ToleranceEngine`, `AbsorptionEngine` (DOM-bağımsız saf modüller)
- **Grafik Motoru:** Chart.js 4 + `chartjs-plugin-annotation` (Reaktif Eliminasyon & Emilim Penceresi Katmanları)
- **Depolama:** IndexedDB (`idb` v2) + Persistent Storage API
- **PWA & Test:** Vite + `vite-plugin-pwa` + Workbox Service Worker + Vitest

---
⚠️ **Yasal Uyarı**

Circadia bir farmakokinetik ve biyokimyasal simülasyon aracıdır. Sunulan veriler popülasyon ortalamalarına ve hakemli literatür katsayılarına dayalı matematiksel tahminlerdir; tıbbi teşhis, tedavi veya klinik karar tavsiyesi niteliği taşımaz.