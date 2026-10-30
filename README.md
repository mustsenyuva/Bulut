# Finansal Düzen

Kişisel gelir-gider takibi için tek sayfalık, bağımlılıksız bir web uygulaması.

- Aylık gelir, gider, net ve tasarruf oranı özeti
- Kategori bazlı gider dağılımı
- Aylık gider bütçesi ve birikim hedefi takibi
- Sabit giderler / abonelikler listesi ve tek tıkla aya işleme
- JSON ile yedek alma / geri yükleme

Veriler yalnızca tarayıcının `localStorage` alanında tutulur; sunucu yoktur.

## Çalıştırma

`index.html` dosyasını tarayıcıda açmanız yeterli. İsterseniz:

```
python3 -m http.server 8000
```

komutuyla `http://localhost:8000` adresinden de açabilirsiniz.
