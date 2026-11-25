import { lazy } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppShell, type RouteHandle } from '@/components/layout/AppShell';

/** Each page is its own lazy chunk in src/pages/<area>/ (page agents own their folder). */
const OverviewPage = lazy(() => import('@/pages/overview'));
const LivePage = lazy(() => import('@/pages/live'));
const EquipmentPage = lazy(() => import('@/pages/equipment'));
const EquipmentDetailPage = lazy(() => import('@/pages/equipment/detail'));
const DecisionsPage = lazy(() => import('@/pages/decisions'));
const AnomaliesPage = lazy(() => import('@/pages/anomalies'));
const ForecastPage = lazy(() => import('@/pages/forecast'));
const CarbonPage = lazy(() => import('@/pages/carbon'));
const MvPage = lazy(() => import('@/pages/mv'));
const ReportsPage = lazy(() => import('@/pages/reports'));
const SettingsPage = lazy(() => import('@/pages/settings'));
const ShowcasePage = lazy(() => import('@/pages/_showcase'));

const h = (titleKey: string): RouteHandle => ({ titleKey });

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewPage />, handle: h('layout:nav.overview') },
      { path: 'live', element: <LivePage />, handle: h('layout:nav.live') },
      { path: 'equipment', element: <EquipmentPage />, handle: h('layout:nav.equipment') },
      {
        path: 'equipment/:id',
        element: <EquipmentDetailPage />,
        handle: h('layout:nav.equipment'),
      },
      { path: 'decisions', element: <DecisionsPage />, handle: h('layout:nav.decisions') },
      { path: 'anomalies', element: <AnomaliesPage />, handle: h('layout:nav.anomalies') },
      { path: 'forecast', element: <ForecastPage />, handle: h('layout:nav.forecast') },
      { path: 'carbon', element: <CarbonPage />, handle: h('layout:nav.carbon') },
      { path: 'mv', element: <MvPage />, handle: h('layout:nav.mv') },
      { path: 'reports', element: <ReportsPage />, handle: h('layout:nav.reports') },
      { path: 'settings', element: <SettingsPage />, handle: h('layout:nav.settings') },
      { path: 'dev/components', element: <ShowcasePage />, handle: h('common:app.name') },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
