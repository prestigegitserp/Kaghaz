# دارایی‌های سالن مدرن

| سطح | مجموعهٔ اسکن‌شدهٔ CC0 | کاربرد |
|---|---|---|
| سنگ‌دانهٔ کف | [Terrazzo Tiles](https://polyhaven.com/a/terrazzo_tiles) | کف روشن و سایش موضعی |
| گچ سفید | [White Plaster 02](https://polyhaven.com/a/white_plaster_02) | دیوار غرفه و سقف |
| چوب لایه‌ای | [Plywood](https://polyhaven.com/a/plywood) | میز نمونه، پیشخوان، قفسه و نیمکت |

رنگ، normal و نقشهٔ ترکیبی AO و زبری برای هر سطح همراه سایت‌اند. فرم نورگیر، چیدمان سالن و جای میزها از [پلان متری](../src/domain/hall-layout.json) خوانده می‌شود. رندر Blender نورپردازی و قاب‌بندی جداگانه دارد. بستهٔ تحریر باز و بسته، کاغذ لایه‌ای و طرح چاپی اختصاصی دارند. شناسهٔ مدل از دادهٔ تجاری و کاتالوگ مستقل است. [مجوز Poly Haven](https://polyhaven.com/license)

چهار رندر نسخهٔ چهارم در Cycles با Blender 4.3.2 ساخته شده‌اند. مدل‌های نمونهٔ رول، کارتن، پالت و دیگر خانواده‌ها از دارایی‌های قبلی استفاده می‌کنند. دادهٔ وزن و اثر انگشت فایل‌ها در [مانیفست V4](../public/v4/asset-manifest.json) ثبت شده است.

## بازتولید

Python همراه Pillow و NumPy، Blender 4.3 یا جدیدتر، فونت‌های Noto Sans Arabic و DejaVu Sans. مرحلهٔ denoise اختیاری است و به بستهٔ `oidn` نیاز دارد.

```bash
python tools/assets/prepare_v3.py --fetch
python tools/assets/prepare_v4.py --fetch
blender -b --factory-startup --python-exit-code 1 --python tools/assets/build_v4.py -- --samples 64
python tools/assets/pack_v4.py --denoise
```
