import { lazy } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppShell, type RouteHandle } from '@/components/layout/AppShell';
import { pageChunks } from './routeChunks';

/** Each page is its own lazy chunk in src/pages/<area>/ (page agents own their folder). */
const OverviewPage = lazy(pageChunks.overview);
const LivePage = lazy(pageChunks.live);
const EquipmentPage = lazy(pageChunks.equipment);
const EquipmentDetailPage = lazy(pageChunks.equipmentDetail);
const DecisionsPage = lazy(pageChunks.decisions);
const AnomaliesPage = lazy(pageChunks.anomalies);
const ForecastPage = lazy(pageChunks.forecast);
const CarbonPage = lazy(pageChunks.carbon);
const MvPage = lazy(pageChunks.mv);
const ReportsPage = lazy(pageChunks.reports);
const SettingsPage = lazy(pageChunks.settings);
const ShowcasePage = lazy(pageChunks.showcase);

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
