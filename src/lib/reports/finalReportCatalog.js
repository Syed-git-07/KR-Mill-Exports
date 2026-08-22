export const FINAL_REPORT_GROUPS = [
  {
    key: 'preparatory', title: 'Preparatory', subtitle: 'Carding, drawing, comber and simplex', accent: 'blue',
    reports: [
      { key: 'preparatory-abstract', title: 'Preparatory Abstract', href: '/reports/final/preparatory-abstract' },
      { key: 'preparatory-all-siders', title: 'All Siders Performance', href: '/reports/preparatory/sider-performance' },
      { key: 'preparatory-particular-sider', title: 'Particular Sider', href: '/reports/final/preparatory-particular-sider' },
      { key: 'preparatory-shift-production', title: 'Shift Wise Production', href: '/reports/final/preparatory-shift-production' },
      { key: 'preparatory-stoppage', title: 'Stoppage Percentage', href: '/reports/preparatory/stoppage-percentage' },
      { key: 'preparatory-waste', title: 'Waste Abstract', href: '/reports/preparatory/waste-abstract' }
    ]
  },
  {
    key: 'autoconer', title: 'Autoconer', subtitle: 'Production, efficiency and stoppage', accent: 'emerald',
    reports: [
      { key: 'autoconer-abstract', title: 'Abstract', href: '/reports/autoconer/abstract' },
      { key: 'autoconer-count-production', title: 'Count Wise Production', href: '/reports/autoconer/count-wise-production' },
      { key: 'autoconer-efficiency', title: 'Efficiency', href: '/reports/autoconer/efficiency' },
      { key: 'autoconer-low-efficiency', title: 'Low Efficiency', href: '/reports/autoconer/low-efficiency' },
      { key: 'autoconer-particular-sider', title: 'Particular Sider', href: '/reports/autoconer/particular-sider' },
      { key: 'autoconer-shift-production', title: 'Shift Wise Production', href: '/reports/final/autoconer-shift-production' },
      { key: 'autoconer-stoppage', title: 'Stoppage Percentage', href: '/reports/autoconer/stoppage-percentage' },
      { key: 'autoconer-sider-monthly', title: 'Sider Monthly Production', href: '/reports/final/autoconer-sider-monthly' }
    ]
  },
  {
    key: 'spinning', title: 'Spinning', subtitle: 'Ring frame production, GPS and waste', accent: 'violet',
    reports: [
      { key: 'spinning-count-gps', title: 'Count Wise GPS', href: '/reports/final/spinning-count-gps' },
      { key: 'spinning-sider-wise', title: 'Sider Wise Production', href: '/reports/final/spinning-sider-wise' },
      { key: 'spinning-production-abstract', title: 'Production Abstract', href: '/reports/spinning/production-abstract' },
      { key: 'spinning-daily-production', title: 'Daily Production', href: '/reports/spinning/daily-production' },
      { key: 'spinning-daily-shift', title: 'Daily Shift Production', href: '/reports/final/spinning-daily-shift' },
      { key: 'spinning-machine-production', title: 'Machine Wise Production', href: '/reports/spinning/machine-wise-production' },
      { key: 'spinning-particular-sider', title: 'Particular Sider', href: '/reports/final/spinning-particular-sider' },
      { key: 'spinning-shift-count', title: 'Shift & Count Wise Production', href: '/reports/spinning/shift-count-production' },
      { key: 'spinning-sider-monthly', title: 'Sider Monthly / Waste Frame', href: '/reports/spinning/sider-monthly' },
      { key: 'spinning-stoppage-abstract', title: 'Stoppage Percentage Abstract', href: '/reports/final/spinning-stoppage-abstract' },
      { key: 'spinning-stoppage-detail', title: 'Detailed Stoppage', href: '/reports/spinning/stoppage-percentage' }
    ]
  }
]

export const FINAL_REPORT_CONFIG = {
  'preparatory-abstract': { title: 'Preparatory Abstract Report', orientation: 'landscape' },
  'preparatory-particular-sider': { title: 'Preparatory Particular Sider Report', requiresEmployee: true },
  'preparatory-shift-production': { title: 'Preparatory Shift Wise Production Report', orientation: 'landscape' },
  'autoconer-shift-production': { title: 'Autoconer Shift Wise Production Report', orientation: 'landscape' },
  'autoconer-sider-monthly': { title: 'Sider Monthly Autoconer Production Report', orientation: 'landscape' },
  'spinning-count-gps': { title: 'Count Wise Spinning GPS Report', orientation: 'landscape' },
  'spinning-sider-wise': { title: 'Sider Wise Spinning Report', orientation: 'landscape' },
  'spinning-daily-shift': { title: 'Spinning Daily Shift Production', orientation: 'landscape' },
  'spinning-particular-sider': { title: 'Spinning Particular Sider Report', requiresEmployee: true },
  'spinning-stoppage-abstract': { title: 'Spinning Stoppage Percentage Abstract Report', orientation: 'landscape' }
}

export function getFinalReportConfig(reportKey) {
  return FINAL_REPORT_CONFIG[reportKey] || null
}
