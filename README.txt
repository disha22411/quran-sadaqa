مشروع صدقة جارية - نسخة أولية جاهزة للربط مع Supabase

الخطوات:
1) أنشئ مشروع Supabase مجاني.
2) افتح SQL Editor وشغّل كل محتوى supabase.sql.
3) فعّل Anonymous Sign-Ins من Authentication > Providers > Anonymous.
4) انسخ Project URL و anon/public key وضعهما في config.js.
5) ارفع الملفات إلى أي استضافة static مثل Netlify أو GitHub Pages/Cloudflare Pages.
6) افتح index.html من الرابط الناتج.

مهم:
- لا تضع Service Role Key داخل config.js.
- نظام الحجز يتم على قاعدة البيانات نفسها، وليس localStorage.
- مدة الحجز 5 ساعات من وقت الحجز.
- الختمات = أقل عدد قراءات بين الأجزاء الثلاثين، وبالتالي لا تُحسب ختمة إلا بعد اكتمال دورة كاملة.
