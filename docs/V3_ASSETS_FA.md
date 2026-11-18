# دارایی‌های نسخهٔ سوم کاغذ

## مصالح و منابع

| سطح | اسکن Poly Haven با مجوز CC0 | کاربرد |
|---|---|---|
| آجر و اندود | [Rough Plaster Brick](https://polyhaven.com/a/rough_plaster_brick) | طاق، ستون و دیوار برگشتی |
| گچ | [Rough Plaster 03](https://polyhaven.com/a/rough_plaster_03) | دیوار و سقف غرفه |
| کف | [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02) | سنگ‌دانه و سایش کف، میز رندر |
| چوب | [Old Wood Floor](https://polyhaven.com/a/old_wood_floor) | پالت، تخته و قفسه |

برای هر سطح، رنگ، normal از نوع OpenGL و نقشهٔ ترکیبی AO/roughness/metallic محلی‌اند. مرورگر از کانال قرمز و سبز این نقشه برای تیرگی موضعی و زبری استفاده می‌کند. جزئیات الیاف کاغذ، لفاف و برچسب فارسی، خط تا و پیچش مقطع رول در پروژه ساخته شده‌اند. [مجوز اسکن‌ها](https://polyhaven.com/license)

## مدل و رندر

شش مدل GLB تازه یا بازطراحی‌شده، ۲٬۴۲۹٬۵۱۶ بایت در مجموع. واحد ابعاد متر است و مختصات مدل در مرکز کف قرار دارد. در مش‌های داخلی از `part` برای کنترل‌های لفاف، ورق، تسمه، زبانه و هسته استفاده می‌شود. این نام‌ها از دادهٔ تجاری و SKU جدا هستند. ریزجزئیات مصالح از تصویرهای WebP تعبیه‌شده خوانده می‌شوند.

رندرها با Blender 4.3.2 و Cycles روی CPU از مدل‌های پروژه تولید شده‌اند. در مرحلهٔ فشرده‌سازی WebP از Open Image Denoise استفاده شد. قاب بازار ۱۴۴۰ × ۹۰۰، غرفه ۱۳۲۰ × ۸۸۰ و نماهای کالا ۱۲۴۸ × ۸۳۲ هستند. رندر بازار و غرفه‌ برای ارائه نورپردازی و ترکیب‌بندی اختصاصی دارند. نسخهٔ زنده بسته به کیفیت انتخابی از نور، سایه و هندسهٔ مناسب اجرای تعاملی استفاده می‌کند.

## بازتولید

Python با Pillow و NumPy و فونت Noto Naskh Arabic برای نوشته‌های مدل، Blender 4.3+، و در صورت نیاز بستهٔ اختیاری `oidn` برای مرحلهٔ آخر.

```bash
python tools/assets/prepare_v3.py --fetch
blender -b --factory-startup --python-exit-code 1 --python tools/assets/build_v3.py -- --frames market --samples 78
blender -b --factory-startup --python-exit-code 1 --python tools/assets/build_v3.py -- --frames workshop ream roll carton bundle --samples 86 --no-export
python tools/assets/pack_v3.py --denoise
```

دارایی‌های آماده داخل مخزن قرار دارند. خود مرورگر، Blender یا دانلود مجدد اسکن‌ها را برای استفاده از سایت لازم ندارد. دارایی‌های نسخهٔ دوم که دوباره استفاده شده‌اند در [اعتبارهای اولیه](ASSET_CREDITS.md) آمده‌اند.
