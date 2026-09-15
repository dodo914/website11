import React, { useEffect, useState } from 'react';
import { trafficAPI } from '../api/traffic';

// ملحوظة: هذا الكومبوننت غير مستخدم حالياً في App.jsx (لوحة الترافيك الحقيقية
// موجودة داخل adminTab === 'traffic' في App.jsx وتستخدم نفس trafficAPI).
// تم إصلاحه هنا فقط ليعتمد على بيانات الزيارات الحقيقية (session tracking)
// بدل استدعاء endpoint غير موجود (/api/analytics/dashboard)، وحتى لا يبقى
// كود ميت يوهم بمصدر بيانات خاطئ لو تم استخدامه مستقبلاً.
export const Dashboard = () => {
  const [stats, setStats] = useState({
    uniqueVisitors: 0,
    sessions: 0,
    pageViews: 0,
    add_to_cart: 0,
    checkout: 0,
    purchases: 0
  });

  useEffect(() => {
    // جلب الإحصائيات الحقيقية من السيرفر — مبنية على TrafficEvent / FunnelEvent
    // (زيارات فعلية للمتجر)، وليس من عدد الطلبات أو السلات المتروكة.
    (async () => {
      try {
        const data = await trafficAPI.getStats(30);
        if (!data) return;
        const funnel = Array.isArray(data.funnel) ? data.funnel : [];
        const findStep = (step) => funnel.find((f) => f.step === step)?.count || 0;
        setStats({
          uniqueVisitors: data.summary?.totalVisitors ?? data.summary?.totalSessions ?? 0,
          sessions: data.summary?.totalSessions || 0,
          pageViews: data.summary?.totalPageViews || 0,
          add_to_cart: findStep('add_to_cart'),
          checkout: findStep('checkout'),
          purchases: data.summary?.totalOrders || findStep('purchase') || 0,
        });
      } catch (err) {
        console.error('Error fetching analytics:', err);
      }
    })();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>إحصائيات المتجر (آخر 30 يوم)</h2>
      
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        <div className="card">
          <h3>الزوار</h3>
          <p>{stats.uniqueVisitors}</p>
        </div>
        
        <div className="card">
          <h3>الجلسات (Sessions)</h3>
          <p>{stats.sessions}</p>
        </div>
        
        <div className="card">
          <h3>مشاهدات الصفحات</h3>
          <p>{stats.pageViews}</p>
        </div>
        
        <div className="card">
          <h3>الإضافة للسلة</h3>
          <p>{stats.add_to_cart}</p>
        </div>

        <div className="card">
          <h3>المبيعات</h3>
          <p>{stats.purchases}</p>
        </div>
      </div>
    </div>
  );
};