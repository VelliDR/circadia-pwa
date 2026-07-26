#☕ Circadia // Biyoritim & Kafein Simülatörü

**Circadia**, bireysel kafein eliminasyon kinetiğini, karaciğer enzimatik indüksiyonunu (CYP1A2) ve biyoritim dengesini matematiksel modellerle simüle eden açık kaynaklı bir Progressive Web App (PWA) uygulamasıdır.

Sıradan sayaçların aksine; sigara kullanımı, sigara bırakma süreci, oral kontraseptif kullanımı ve mide emilim sürelerini hesaba katarak kişiselleştirilmiş bir eliminasyon eğrisi çizer.

---

## 🔬 Temel Özellikler & Klinik Model

- **CYP1A2 Enzim Dinamikleri:** Sigara kullanımına bağlı karaciğer enzim indüksiyonunu ve değişen yarılanma ömürlerini ($t_{1/2}$) anlık simüle eder.
- **Sigara Bırakma (De-indüksiyon) Eğrisi:** Sigara bırakıldıktan sonraki 14 günlük süreçte enzim aktivitesinin normale dönme hızını doğrusal olarak hesaplar.
- **Oral Kontraseptif (OCP) İnhibisyonu:** Östrojen/progestin kullanımına bağlı enzim inhibisyonunu hesaba katar ($t_{1/2} \times 2$).
- **$t_{\max}$ Emilim Rampası:** Tüketimden sonraki ilk 30 dakikalık gastrointestinal emilim evresini ve ardından başlayan 1. derece eliminasyon kinetiğini çizer.
- **FDA / EFSA Toksisite Uyarıları:** Kandaki aktif kafein $400\text{ mg}$, $600\text{ mg}$ ve $1000\text{ mg}$ kritik eşiklerini aştığında kademeli klinik uyarı pankartları çıkarır.
- **OLED Red-Shift (Nöbet Modu):** Gece vardiyaları ve nöbetler için melatonin salgılanmasını baskılamayan saf kırmızı/siyah tema.
- **Veri Güvenliği & Çevrimdışı Çalışma:** `Persistent Storage API` ile önbellek silinme koruması ve `.json` formatında yerel yedekleme/içe aktarma.

---

## 🧮 Matematiksel & Farmakokinetik Model

### 1. Eliminasyon Kinetiği ($30\text{ dk}$ Emilim Sonrası)
$$C(t) = C_0 \cdot e^{-k_e \cdot (t - t_{\max})}$$

Burada $k_e$ eliminasyon hız sabitidir:
$$k_e = \frac{\ln(2)}{t_{1/2\_etkin}}$$

### 2. Sigara Bırakma De-indüksiyonu ($0 - 14\text{ Gün}$)
$$t_{1/2}(d) = t_{1/2\_sigara} + \left( (t_{1/2\_baz} - t_{1/2\_sigara}) \cdot \frac{d}{14} \right)$$

---

## 🛠️ Teknolojik Mimari

- **Frontend:** Vanilla JavaScript (ES6 Modules)
- **Çizim Motoru:** HTML5 Canvas API (Dinamik Y-skalası & Gradient Area Chart)
- **Stil:** Pure CSS3 (CSS Variables & Responsive Grid)
- **PWA / Offline:** Service Worker (`sw.js`) & Web App Manifest

---
⚠️ Yasal Uyarı

Circadia bir farmakokinetik simülasyon aracıdır. Sunulan veriler popülasyon ortalamalarına dayalı matematiksel tahminlerdir; tıbbi teşhis, tedavi veya klinik karar tavsiyesi niteliği taşımaz.